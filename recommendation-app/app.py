# recommendation-app/app.py

from flask import Flask, request, jsonify
from dapr.clients import DaprClient
import logging
import random

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

# Product class definition
class Product:
    def __init__(self, id, name, category, price, description, imageUrl, quantity, tags):
        self.id = id
        self.name = name
        self.category = category
        self.price = price
        self.description = description
        self.imageUrl = imageUrl
        self.quantity = quantity
        self.tags = tags

    @classmethod
    def from_dict(cls, data):
        return cls(**data)

# Health check endpoint
@app.route('/healthz', methods=['GET'])
def health_check():
    return jsonify({"status": "Healthy"}), 200

# Readiness check endpoint
@app.route('/ready', methods=['GET'])
def readiness_check():
    return jsonify({"status": "Ready"}), 200

# Endpoint for Dapr config
@app.route('/dapr/config', methods=['GET'])
def dapr_config():
    logging.info("Serving Dapr configuration.")
    config = {
        "subscriptions": [{
            "pubsubname": "orders",
            "topic": "orderProcessed",
            "route": "/updatePopularProducts"
        }]
    }
    return jsonify(config)

# Endpoint for subscribing to the orderProcessed topic
@app.route('/dapr/subscribe', methods=['GET'])
def subscribe():
    logging.info("Subscribing to the orderProcessed topic.")
    subscriptions = [{
        "pubsubname": "orders",
        "topic": "orderProcessed",
        "route": "/updatePopularProducts"
    }]
    return jsonify(subscriptions)

# Endpoint for general recommendations
@app.route('/recommendations', methods=['GET'])
def general_recommendations():
    logging.info("Request received for /recommendations endpoint.")
    try:
        recommendations = get_intelligent_recommendations()
        return jsonify(recommendations)
    except Exception as e:
        logging.error(f"Error in /recommendations: {e}")
        return jsonify({"error": "An error occurred during processing"}), 500

# Endpoint for updating popular products based on processed orders
@app.route('/updatePopularProducts', methods=['POST'])
def update_popular_products():
    logging.info("Received a request to update popular products based on processed orders.")
    try:
        order_data = request.json
        # Send update requests to Stock Management Service for each product in the order
        for item in order_data.get('items', []):
            product_id = item.get('id')
            quantity = item.get('quantity', 0)
            update_product_popularity(product_id, quantity)

        return jsonify({"message": "Processed order data for updating popular products"})
    except Exception as e:
        logging.error(f"Error processing order data: {e}")
        return jsonify({"error": "Failed to process order data"}), 500

# Endpoint for fetching popular products
@app.route('/popular', methods=['GET'])
def popular_products():
    logging.info("Request received for /popular endpoint.")
    try:
        popular_product_ids = [2, 3, 4, 5]  # Determine popular product IDs
        logging.info(f"Fetching details for products: {popular_product_ids}")
        products = fetch_product_details(popular_product_ids)
        logging.info(f"Products successfully fetched: {products}")
        return jsonify({"popular_products": products})
    except Exception as e:
        logging.error(f"Error in /popular: {e}", exc_info=True)
        return jsonify({"error": "An error occurred during processing"}), 500

# Endpoint for capturing interactions
@app.route('/interactions', methods=['POST'])
def capture_interactions():
    logging.info("Received a request to record an interaction.")
    try:
        interaction_data = request.json
        # Validate the interaction data
        required_keys = ['productId', 'timestamp', 'type', 'details']
        if not all(key in interaction_data for key in required_keys):
            raise ValueError("Missing required interaction data")
        
        # Implement the logic to process the interaction
        # For this example, let's just log the interaction
        logging.info(f"Recording interaction: {interaction_data}")
                
        return jsonify({"message": "Interaction recorded successfully"})
    except ValueError as ve:
        logging.error(f"ValueError in /interactions: {ve}")
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        logging.error(f"Unexpected error in /interactions: {e}")
        return jsonify({"error": "An internal error occurred"}), 500

# Fetch products from the Stock Management Service using Dapr
def fetch_products():
    logging.info("Fetching products from stock management service using Dapr...")
    try:
        with DaprClient() as d:
            response = d.invoke_method(
                app_id='stock-management-app',
                method_name='products',
                http_verb='GET'
            )
            if response.status_code == 200:
                products_data = response.json()
                logging.info("Products successfully fetched.")
                return [Product.from_dict(prod) for prod in products_data]
            else:
                logging.error(f"Failed to fetch products: Status Code {response.status_code}, Response: {response.text}")
                return []
    except Exception as e:
        logging.error(f"Exception in fetch_products: {e}")
        return []

# Generate intelligent product recommendations
def get_intelligent_recommendations():
    logging.info("Generating intelligent product recommendations...")
    try:
        products = fetch_products()
        if not products:
            logging.warning("No products available for recommendations")
            return {"products": []}

        sample_size = min(4, len(products))
        recommended_products = [prod.__dict__ for prod in random.sample(products, sample_size)]
        logging.info(f"Recommended products: {recommended_products}")
        return {"products": recommended_products}
    except Exception as e:
        logging.error(f"Exception in get_intelligent_recommendations: {e}")
        return {"products": []}

# Update product popularity
def update_product_popularity(product_id, quantity):
    try:
        with DaprClient() as d:
            response = d.invoke_method(
                app_id='stock-management-app',
                method_name=f'updateProductPopularity/{product_id}',
                data={"quantity": quantity},
                http_verb='POST'
            )
            if response.status_code == 200:
                logging.info(f"Popularity updated for product {product_id}")
            else:
                logging.error(f"Failed to update popularity for product {product_id}: Status Code {response.status_code}, Response: {response.text}")
    except Exception as e:
        logging.error(f"Exception in update_product_popularity for product {product_id}: {e}")

# Fetch product details from the Stock Management Service
def fetch_product_details(product_ids):
    logging.info(f"Starting fetch_product_details for IDs: {product_ids}")
    products = []
    try:
        with DaprClient() as d:
            for product_id in product_ids:
                logging.info(f"Fetching details for product ID: {product_id}")
                response = d.invoke_method(
                    app_id='stock-management-app',
                    method_name=f'product/{product_id}',
                    http_verb='GET'
                )
                if response.status_code == 200:
                    product_detail = response.json()
                    logging.info(f"Details fetched for product ID {product_id}: {product_detail}")
                    products.append(product_detail)
                else:
                    logging.error(f"Failed to fetch details for product ID {product_id}. Status code: {response.status_code}, Response: {response.text}")
        logging.info(f"Completed fetch_product_details. Total products fetched: {len(products)}")
        return products
    except Exception as e:
        logging.error(f"Exception in fetch_product_details: {e}", exc_info=True)
        return []

# Placeholder function for sending interaction data to an analytics service
def send_interaction_to_analytics_service(interaction_data):
    try:
        # Implement logic to send data to an analytics service or database
        logging.info(f"Sending interaction data to analytics service: {interaction_data}")
    except Exception as e:
        logging.error(f"Error sending interaction data to analytics service: {e}")

# Main function
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
