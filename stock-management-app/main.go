// stock-management-app/main.go

package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	dapr "github.com/dapr/go-sdk/client"
	"github.com/gin-gonic/gin"
)

var (
	stateStoreName = getEnv("STATE_STORE_NAME", "statestore")
	pubsubName     = getEnv("PUBSUB_NAME", "orderpubsub")
	maxRetries     = getEnvAsInt("MAX_RETRIES", 3)
	port           = getEnv("PORT", "8080")
)

type Product struct {
	Id          int      `json:"id"`
	Name        string   `json:"name"`
	Category    string   `json:"category"`
	Price       float64  `json:"price"`
	Description string   `json:"description"`
	ImageUrl    string   `json:"imageUrl"`
	Quantity    int      `json:"quantity"`
	Tags        []string `json:"tags"`
}

type StockUpdateRequest struct {
	Updates []ProductUpdate `json:"updates"`
}

type ProductUpdate struct {
	Id          int `json:"id"`
	PurchaseQty int `json:"purchaseQty"`
}

type DaprStockUpdateRequest struct {
	Data StockUpdateRequest `json:"data"`
}

// APIResponse struct for consistent API response
type APIResponse struct {
	Status  string      `json:"status"`
	Message string      `json:"message,omitempty"`
	Error   string      `json:"error,omitempty"`
	Data    interface{} `json:"data,omitempty"`
}

func main() {
	// Initialize Gin router
	r := gin.Default()

	var client dapr.Client
	var err error

	// Attempt to create a Dapr client with retries
	for attempt := 0; attempt < maxRetries; attempt++ {
		client, err = dapr.NewClient()
		if err == nil {
			break
		}
		log.Printf("Failed to create Dapr client (attempt %d/%d): %v", attempt+1, maxRetries, err)
		time.Sleep(2 * time.Second) // Wait for 2 seconds before retrying
	}

	if err != nil {
		log.Printf("All retries failed: %v", err)
		os.Exit(1)
	}

	defer client.Close()

	// Health Check Endpoints
	r.GET("/healthz", healthCheck)
	r.GET("/ready", readinessCheck)

	// Dapr Endpoints
	r.GET("/dapr/config", daprConfig)
	r.GET("/dapr/subscribe", daprSubscribe)

	// Endpoints
	r.POST("/product", func(c *gin.Context) { storeProduct(c, client) })
	r.GET("/products", func(c *gin.Context) { getAllProducts(c, client) })
	r.POST("/updateStock", func(c *gin.Context) { updateStock(c, client) })
	r.GET("/product/:productid", func(c *gin.Context) { getProductByID(c, client) })

	// Call initializeSampleProducts to preload products into the state store
	if err := initializeSampleProducts(client); err != nil {
		log.Printf("Error initializing sample products: %v", err)
		// Handle the error as needed
		return
	}

	// Start the server on the specified port
	if err := r.Run(":" + port); err != nil {
		log.Printf("Failed to start the server: %v", err)
		// Handle the server startup error as needed
		return
	}
}

// Utility function to get environment variable as string
func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}

// Utility function to get environment variable as integer
func getEnvAsInt(name string, defaultVal int) int {
	if value, ok := os.LookupEnv(name); ok {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultVal
}

// healthCheck responds to health check requests, used for liveness probe
func healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "healthy"})
}

// readinessCheck responds to readiness check requests, used for readiness probe
func readinessCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ready"})
}

// Dapr Config
func daprConfig(c *gin.Context) {
	config := map[string]interface{}{
		"subscriptions": []map[string]interface{}{
			{
				"pubsubname": pubsubName,
				"topic":      "stockUpdate",
				"route":      "/updateStock",
			},
		},
	}
	c.JSON(http.StatusOK, config)
}

// Dapr Subscription
func daprSubscribe(c *gin.Context) {
	subscriptions := []map[string]string{
		{
			"pubsubname": pubsubName,
			"topic":      "stockUpdate",
			"route":      "/updateStock",
		},
	}
	c.JSON(http.StatusOK, subscriptions)
}

func storeProduct(c *gin.Context, client dapr.Client) {
	var product Product
	if err := c.BindJSON(&product); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Save product to state store
	if err := saveToStateStore(client, product.Id, product); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Product stored successfully!"})
}

// getAllProducts retrieves all products from the state store
func getAllProducts(c *gin.Context, client dapr.Client) {
	productIDs, err := getProductIDs(client)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if len(productIDs) == 0 {
		log.Println("No products found in state store")
		c.JSON(http.StatusOK, gin.H{"products": []Product{}})
		return
	}

	products := make([]Product, 0)
	for _, id := range productIDs {
		var product Product
		err := getFromStateStore(client, id, &product)
		if err != nil {
			log.Printf("Failed to retrieve product with ID %d: %v", id, err)
			continue
		}
		products = append(products, product)
	}

	c.JSON(http.StatusOK, products)
}

// The updateStock function will read the request body, iterate over the product updates, and adjust the stock quantities.
func updateStock(c *gin.Context, client dapr.Client) {
	log.Println("Starting stock update process")

	var daprReq DaprStockUpdateRequest
	var req StockUpdateRequest
	var err error

	requestBody, err := io.ReadAll(c.Request.Body)
	if err != nil {
		log.Printf("Error reading request body: %v", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Error reading request body"})
		return
	}
	log.Printf("Request Body: %s", string(requestBody))

	// Try to unmarshal as a Dapr request
	err = json.Unmarshal(requestBody, &daprReq)
	if err != nil {
		log.Printf("Error unmarshalling as Dapr request: %v", err)
	}
	if err == nil && daprReq.Data.Updates != nil {
		// It's a Dapr request
		req = daprReq.Data
		log.Println("Processed as Dapr request")
	} else {
		// Try to unmarshal as a direct request
		err = json.Unmarshal(requestBody, &req)
		if err != nil {
			log.Printf("Error unmarshalling as direct request: %v", err)
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format"})
			return
		}
		log.Println("Processed as direct request")
	}

	for _, update := range req.Updates {
		log.Printf("Processing stock update for Product ID %d, Purchase Quantity: %d", update.Id, update.PurchaseQty)

		var product Product
		err := getFromStateStore(client, update.Id, &product)
		if err != nil {
			log.Printf("Error getting product with ID %d from state store: %v", update.Id, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to get product with ID %d: %v", update.Id, err)})
			continue
		}
		log.Printf("Retrieved product from state store: %+v", product)

		product.Quantity -= update.PurchaseQty
		log.Printf("Updated quantity for Product ID %d, New Quantity: %d", update.Id, product.Quantity)

		if err := saveToStateStore(client, update.Id, product); err != nil {
			log.Printf("Error saving product with ID %d to state store: %v", update.Id, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		log.Printf("Saved product with ID %d to state store successfully", update.Id)
	}

	log.Println("Stock update process completed successfully")
	c.JSON(http.StatusOK, gin.H{"message": "Stock updated successfully!"})
}

// This function will extract the product ID from the URL, validate it, and retrieve the corresponding product details from the state store.
func getProductByID(c *gin.Context, client dapr.Client) {
	// Extracting product ID from the path parameter
	productIDStr := c.Param("productid")
	productID, err := strconv.Atoi(productIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid product ID"})
		return
	}

	// Fetching product details from the state store
	var product Product
	err = getFromStateStore(client, productID, &product)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	// Responding with the product details
	c.JSON(http.StatusOK, product)
}

// getProductIDs retrieves the list of product IDs from the state store
func getProductIDs(client dapr.Client) ([]int, error) {
	log.Println("Retrieving product IDs from state store")

	item, err := client.GetState(context.Background(), stateStoreName, "productIDs", nil)
	if err != nil {
		log.Printf("Failed to get product IDs: %v", err)
		return nil, err
	}

	if item.Value == nil {
		log.Println("No product IDs found in state store")
		return make([]int, 0), nil // Returns an empty slice instead of nil
	}

	var productIDs []int
	err = json.Unmarshal(item.Value, &productIDs)
	if err != nil {
		log.Printf("Failed to decode product IDs: %v", err)
		return nil, err
	}

	return productIDs, nil
}

// getFromStateStore retrieves a single product from the state store
func getFromStateStore(client dapr.Client, id int, product *Product) error {
	log.Printf("Retrieving product ID %d from state store", id)

	item, err := client.GetState(context.Background(), stateStoreName, "product-"+strconv.Itoa(id), nil)
	if err != nil {
		log.Printf("Failed to get product with ID %d: %v", id, err)
		return err
	}

	if item.Value == nil {
		log.Printf("State store returned nil for product ID %d", id)
		return fmt.Errorf("product with ID %d not found", id)
	}

	// First, try to unmarshal directly without Base64 decoding
	err = json.Unmarshal(item.Value, product)
	if err == nil {
		log.Printf("Successfully retrieved and unmarshalled product ID %d directly: %+v", id, product)
		return nil // Successfully unmarshalled without Base64 decoding
	}

	// If direct unmarshal fails, try Base64 decoding
	trimmedRespBody := strings.Trim(string(item.Value), "\"")
	decodedBytes, err := base64.StdEncoding.DecodeString(trimmedRespBody)
	if err != nil {
		log.Printf("Failed to decode base64 string for product ID %d: %v", id, err)
		return err // Failed to decode Base64
	}

	// Try to unmarshal decoded JSON into Product struct
	err = json.Unmarshal(decodedBytes, product)
	if err != nil {
		log.Printf("Failed to unmarshal JSON for product ID %d after Base64 decoding: %v", id, err)
		return fmt.Errorf("failed to unmarshal JSON into product with ID %d after Base64 decoding: %v", id, err)
	}

	log.Printf("Successfully retrieved and unmarshalled product ID %d after Base64 decoding: %+v", id, product)
	return nil
}

// saveToStateStore saves a product to the state store using Dapr's state store API
func saveToStateStore(client dapr.Client, id int, product Product) error {
	log.Printf("Saving product ID %d to state store", id)
	productJSON, err := json.Marshal(product)
	if err != nil {
		log.Printf("Failed to marshal product: %v", err)
		return err
	}

	// Using a consistent key format for products
	key := "product-" + strconv.Itoa(id)

	// Provide an empty map for metadata and omit state options
	err = client.SaveState(context.Background(), stateStoreName, key, productJSON, map[string]string{})
	if err != nil {
		log.Printf("Failed to save product ID %d: %v", id, err)
		return err
	}

	log.Printf("Product ID %d saved successfully", id)
	return nil
}

func initializeSampleProducts(client dapr.Client) error {
	log.Println("Starting to initialize sample products")

	initialProducts := []Product{
		{Id: 1, Name: "Ultra HD Smart TV", Category: "Electronics", Price: 799.99, Description: "65\" 4K Ultra HD screen, Smart TV with streaming capabilities.", ImageUrl: "https://loremflickr.com/320/240/Ultra+HD+Smart+TV", Quantity: 10, Tags: []string{"tv", "smart", "4k"}},
		{Id: 2, Name: "Professional DSLR Camera", Category: "Photography", Price: 1200.99, Description: "24.1 MP DSLR camera with 4K video recording and dual pixel CMOS AF.", ImageUrl: "https://loremflickr.com/320/240/DSLR+Camera", Quantity: 8, Tags: []string{"camera", "dslr", "photography"}},
		{Id: 3, Name: "Wireless Bluetooth Headphones", Category: "Audio", Price: 199.99, Description: "Noise-cancelling over-ear headphones with 20 hours of battery life.", ImageUrl: "https://loremflickr.com/320/240/Bluetooth+Headphones", Quantity: 15, Tags: []string{"headphones", "audio", "bluetooth"}},
		{Id: 4, Name: "Smartphone 12 Pro", Category: "Electronics", Price: 999.99, Description: "6.1-inch Super Retina XDR display, A14 Bionic chip, 5G capable.", ImageUrl: "https://loremflickr.com/320/240/Smartphone+12+Pro", Quantity: 20, Tags: []string{"smartphone", "electronics", "mobile"}},
		{Id: 5, Name: "Portable External Hard Drive", Category: "Computing", Price: 89.99, Description: "1TB external hard drive with USB 3.0 connectivity and durable design.", ImageUrl: "https://loremflickr.com/320/240/External+Hard+Drive", Quantity: 25, Tags: []string{"hard drive", "storage", "computing"}},
		{Id: 6, Name: "Gaming Laptop", Category: "Computing", Price: 1499.99, Description: "High-performance laptop with 16GB RAM, 1TB SSD, and dedicated graphics card.", ImageUrl: "https://loremflickr.com/320/240/Gaming+Laptop", Quantity: 10, Tags: []string{"laptop", "gaming", "computing"}},
		{Id: 7, Name: "Wireless Gaming Mouse", Category: "Accessories", Price: 59.99, Description: "Ergonomic design with customizable buttons and adjustable DPI settings.", ImageUrl: "https://loremflickr.com/320/240/Gaming+Mouse", Quantity: 30, Tags: []string{"mouse", "gaming", "accessories"}},
		{Id: 8, Name: "Smart Watch", Category: "Wearables", Price: 299.99, Description: "Feature-packed smartwatch with fitness tracking, heart rate monitor, and waterproof design.", ImageUrl: "https://loremflickr.com/320/240/Smart+Watch", Quantity: 15, Tags: []string{"smartwatch", "wearables", "fitness"}},
		{Id: 9, Name: "Action Camera", Category: "Photography", Price: 349.99, Description: "4K action camera with image stabilization, waterproof casing, and wide-angle lens.", ImageUrl: "https://loremflickr.com/320/240/Action+Camera", Quantity: 12, Tags: []string{"camera", "action", "photography"}},
		{Id: 10, Name: "Tablet Device", Category: "Electronics", Price: 499.99, Description: "10.5-inch display tablet with stylus support and powerful processing capabilities.", ImageUrl: "https://loremflickr.com/320/240/Tablet+Device", Quantity: 18, Tags: []string{"tablet", "electronics", "mobile"}},
		{Id: 11, Name: "Wireless Earbuds", Category: "Audio", Price: 129.99, Description: "Compact and lightweight earbuds with crystal-clear sound quality and a charging case.", ImageUrl: "https://loremflickr.com/320/240/Wireless+Earbuds", Quantity: 20, Tags: []string{"earbuds", "audio", "wireless"}},
		{Id: 12, Name: "Fitness Tracker", Category: "Wearables", Price: 99.99, Description: "Advanced fitness tracker with sleep monitoring, step counting, and calorie tracking.", ImageUrl: "https://loremflickr.com/320/240/Fitness+Tracker", Quantity: 25, Tags: []string{"fitness", "tracker", "wearables"}},
		{Id: 13, Name: "Electric Toothbrush", Category: "Personal Care", Price: 79.99, Description: "Rechargeable electric toothbrush with multiple brushing modes and pressure sensor.", ImageUrl: "https://loremflickr.com/320/240/Electric+Toothbrush", Quantity: 30, Tags: []string{"toothbrush", "personal care", "dental"}},
		{Id: 14, Name: "Espresso Machine", Category: "Home Appliances", Price: 249.99, Description: "Automatic espresso machine with customizable settings and milk frother.", ImageUrl: "https://loremflickr.com/320/240/Espresso+Machine", Quantity: 10, Tags: []string{"espresso", "coffee", "kitchen"}},
		{Id: 15, Name: "Robot Vacuum", Category: "Home Appliances", Price: 399.99, Description: "Smart robot vacuum cleaner with app control and powerful suction.", ImageUrl: "https://loremflickr.com/320/240/Robot+Vacuum", Quantity: 12, Tags: []string{"vacuum", "robot", "cleaning"}},
		{Id: 16, Name: "Bluetooth Speaker", Category: "Audio", Price: 119.99, Description: "Portable Bluetooth speaker with long battery life and waterproof design.", ImageUrl: "https://loremflickr.com/320/240/Bluetooth+Speaker", Quantity: 20, Tags: []string{"speaker", "audio", "bluetooth"}},
		{Id: 17, Name: "4K Streaming Device", Category: "Electronics", Price: 49.99, Description: "Stream your favorite content in 4K resolution with voice control and HDR support.", ImageUrl: "https://loremflickr.com/320/240/4K+Streaming+Device", Quantity: 25, Tags: []string{"streaming", "4k", "electronics"}},
		{Id: 18, Name: "Mechanical Keyboard", Category: "Accessories", Price: 109.99, Description: "Mechanical gaming keyboard with customizable RGB lighting and tactile switches.", ImageUrl: "https://loremflickr.com/320/240/Mechanical+Keyboard", Quantity: 15, Tags: []string{"keyboard", "gaming", "mechanical"}},
		{Id: 19, Name: "Smart Home Hub", Category: "Smart Home", Price: 129.99, Description: "Centralized control for your smart home devices with voice command support.", ImageUrl: "https://loremflickr.com/320/240/Smart+Home+Hub", Quantity: 12, Tags: []string{"home", "smart", "hub"}},
		{Id: 20, Name: "High-Performance Blender", Category: "Kitchen Appliances", Price: 199.99, Description: "Multi-speed blender with large capacity, perfect for smoothies and soups.", ImageUrl: "https://loremflickr.com/320/240/Blender", Quantity: 15, Tags: []string{"blender", "kitchen", "appliances"}},
		{Id: 21, Name: "Wireless Charger Pad", Category: "Accessories", Price: 39.99, Description: "Fast charging wireless pad for smartphones and earbuds.", ImageUrl: "https://loremflickr.com/320/240/Wireless+Charger", Quantity: 30, Tags: []string{"charger", "wireless", "accessories"}},
		{Id: 22, Name: "Smart Home Security Camera", Category: "Smart Home", Price: 149.99, Description: "1080p HD security camera with night vision and motion detection.", ImageUrl: "https://loremflickr.com/320/240/Security+Camera", Quantity: 20, Tags: []string{"security", "camera", "smart home"}},
		{Id: 23, Name: "Virtual Reality Headset", Category: "Gaming", Price: 399.99, Description: "Immersive VR headset with high-resolution display and built-in audio.", ImageUrl: "https://loremflickr.com/320/240/VR+Headset", Quantity: 15, Tags: []string{"vr", "gaming", "headset"}},
		{Id: 24, Name: "Fitness Yoga Mat", Category: "Fitness", Price: 29.99, Description: "Non-slip yoga mat with cushioning for yoga and workout routines.", ImageUrl: "https://loremflickr.com/320/240/Yoga+Mat", Quantity: 40, Tags: []string{"fitness", "yoga", "mat"}},
		{Id: 25, Name: "Electric Kettle", Category: "Kitchen Appliances", Price: 59.99, Description: "Stainless steel electric kettle with auto shut-off and boil-dry protection.", ImageUrl: "https://loremflickr.com/320/240/Electric+Kettle", Quantity: 25, Tags: []string{"kettle", "kitchen", "appliances"}},
		{Id: 26, Name: "Gaming Console", Category: "Gaming", Price: 499.99, Description: "Next-gen gaming console with 4K resolution and high-speed SSD.", ImageUrl: "https://loremflickr.com/320/240/Gaming+Console", Quantity: 20, Tags: []string{"console", "gaming", "entertainment"}},
		{Id: 27, Name: "LED Desk Lamp", Category: "Home Office", Price: 44.99, Description: "Adjustable LED desk lamp with touch control and USB charging port.", ImageUrl: "https://loremflickr.com/320/240/Desk+Lamp", Quantity: 35, Tags: []string{"lamp", "office", "lighting"}},
		{Id: 28, Name: "Portable Projector", Category: "Electronics", Price: 299.99, Description: "Compact projector with HD resolution, built-in speakers, and HDMI connectivity.", ImageUrl: "https://loremflickr.com/320/240/Portable+Projector", Quantity: 18, Tags: []string{"projector", "portable", "electronics"}},
		{Id: 29, Name: "Smart Thermostat", Category: "Smart Home", Price: 199.99, Description: "Wi-Fi enabled smart thermostat with voice control and energy-saving features.", ImageUrl: "https://loremflickr.com/320/240/Smart+Thermostat", Quantity: 20, Tags: []string{"thermostat", "smart home", "energy"}},
		{Id: 30, Name: "Noise Cancelling Earphones", Category: "Audio", Price: 159.99, Description: "High-quality earphones with active noise cancellation and ambient mode.", ImageUrl: "https://loremflickr.com/320/240/Noise+Cancelling+Earphones", Quantity: 25, Tags: []string{"earphones", "audio", "noise cancelling"}},
		{Id: 31, Name: "Wireless Mouse", Category: "Computing", Price: 49.99, Description: "Ergonomic wireless mouse with customizable buttons and long battery life.", ImageUrl: "https://loremflickr.com/320/240/Wireless+Mouse", Quantity: 30, Tags: []string{"mouse", "wireless", "computing"}},
		{Id: 32, Name: "Smart Doorbell", Category: "Smart Home", Price: 179.99, Description: "Wi-Fi smart doorbell with HD video, two-way audio, and motion detection.", ImageUrl: "https://loremflickr.com/320/240/Smart+Doorbell", Quantity: 22, Tags: []string{"doorbell", "smart home", "security"}},
		{Id: 33, Name: "Compact Refrigerator", Category: "Home Appliances", Price: 189.99, Description: "Energy-efficient compact refrigerator with freezer compartment.", ImageUrl: "https://loremflickr.com/320/240/Compact+Refrigerator", Quantity: 15, Tags: []string{"refrigerator", "appliances", "compact"}},
		{Id: 34, Name: "Digital Camera", Category: "Photography", Price: 549.99, Description: "Versatile digital camera with high-resolution sensor and versatile zoom lens.", ImageUrl: "https://loremflickr.com/320/240/Digital+Camera", Quantity: 12, Tags: []string{"camera", "digital", "photography"}},
		{Id: 35, Name: "Wireless Keyboard", Category: "Computing", Price: 69.99, Description: "Slim wireless keyboard with comfortable keys and long battery life.", ImageUrl: "https://loremflickr.com/320/240/Wireless+Keyboard", Quantity: 25, Tags: []string{"keyboard", "wireless", "computing"}},
		{Id: 36, Name: "Air Purifier", Category: "Home Appliances", Price: 129.99, Description: "HEPA air purifier with real-time air quality monitoring and quiet operation.", ImageUrl: "https://loremflickr.com/320/240/Air+Purifier", Quantity: 20, Tags: []string{"air purifier", "home", "health"}},
		{Id: 37, Name: "Digital Photo Frame", Category: "Home Decor", Price: 89.99, Description: "High-resolution digital photo frame with Wi-Fi connectivity and cloud storage.", ImageUrl: "https://loremflickr.com/320/240/Digital+Photo+Frame", Quantity: 30, Tags: []string{"photo frame", "digital", "decor"}},
		{Id: 38, Name: "Smart Scale", Category: "Fitness", Price: 59.99, Description: "Bluetooth enabled smart scale with body composition analysis.", ImageUrl: "https://loremflickr.com/320/240/Smart+Scale", Quantity: 25, Tags: []string{"scale", "fitness", "smart"}},
		{Id: 39, Name: "Gaming Chair", Category: "Gaming", Price: 249.99, Description: "Ergonomic gaming chair with adjustable armrests and lumbar support.", ImageUrl: "https://loremflickr.com/320/240/Gaming+Chair", Quantity: 15, Tags: []string{"chair", "gaming", "comfort"}},
		{Id: 40, Name: "Streaming Webcam", Category: "Computing", Price: 99.99, Description: "High-definition webcam with autofocus and built-in microphone for streaming.", ImageUrl: "https://loremflickr.com/320/240/Webcam", Quantity: 20, Tags: []string{"webcam", "streaming", "computing"}},
	}

	// Debug: Fetch product IDs and log them
	existingIDs, err := getProductIDs(client)
	if err != nil {
		log.Printf("Error retrieving product IDs: %v", err)
		return err
	}
	log.Printf("Retrieved product IDs: %v", existingIDs)

	// Check if products are already initialized
	if len(existingIDs) != 0 {
		log.Println("Products already initialized in state store.")
		return nil
	}

	log.Println("Adding initial products to state store...")
	var productIDs []int
	for _, product := range initialProducts {
		err := saveToStateStore(client, product.Id, product)
		if err != nil {
			log.Printf("Error saving product ID %d: %v", product.Id, err)
			continue
		}
		productIDs = append(productIDs, product.Id)
		log.Printf("Initialized product ID %d", product.Id)
	}

	// Save the index of product IDs
	if len(productIDs) > 0 {
		err := saveProductIDs(client, productIDs)
		if err != nil {
			log.Printf("Error saving product IDs: %v", err)
			return err
		}
	}

	// Debug: Test Dapr functionality by retrieving a known product ID
	// Example: Retrieve the first product if it exists
	if len(productIDs) > 0 {
		var product Product
		err := getFromStateStore(client, productIDs[0], &product)
		if err != nil {
			log.Printf("Error retrieving product with ID %d: %v", productIDs[0], err)
		} else {
			log.Printf("Successfully retrieved product with ID %d: %+v", productIDs[0], product)
		}
	}

	log.Println("Completed initializing sample products.")
	return nil
}

func saveProductIDs(client dapr.Client, productIDs []int) error {
	log.Println("Saving product IDs to state store")

	productIDsJSON, err := json.Marshal(productIDs)
	if err != nil {
		log.Printf("Failed to marshal product IDs: %v", err)
		return err
	}

	err = client.SaveState(context.Background(), stateStoreName, "productIDs", productIDsJSON, map[string]string{})
	if err != nil {
		log.Printf("Failed to save product IDs: %v", err)
		return err
	}

	log.Println("Product IDs saved successfully")
	return nil
}
