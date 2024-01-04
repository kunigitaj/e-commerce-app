// order-processing-app/app.js

const express = require('express');
const { DaprClient, HTTP_METHODS } = require('@dapr/dapr');

const { Tracer, BatchRecorder, jsonEncoder: { JSON_V2 } } = require('zipkin');
const CLSContext = require('zipkin-context-cls');
const { HttpLogger } = require('zipkin-transport-http');

// Zipkin setup
const zipkinBaseUrl = 'http://zipkin.default.svc.cluster.local:9411';

const tracer = new Tracer({
    ctxImpl: new CLSContext('zipkin'), 
    recorder: new BatchRecorder({
        logger: new HttpLogger({
            endpoint: `${zipkinBaseUrl}/api/v2/spans`,
            jsonEncoder: JSON_V2
        })
    }),
    localServiceName: 'order-processing-app'
});

const zipkinMiddleware = require('zipkin-instrumentation-express').expressMiddleware;
const app = express();

// Use Zipkin middleware to trace requests
app.use(zipkinMiddleware({ tracer }));

// Dapr HTTP Port and Client Setup
const daprPort = process.env.DAPR_HTTP_PORT || 3500;
const daprClient = new DaprClient(`http://localhost:${daprPort}`);
const stateStoreName = "statestore";

app.use(express.json());

// Utility function for logging
function log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${type.toUpperCase()}] ${message}`);
}

// Health check endpoint
app.get('/healthz', (req, res) => {
    res.status(200).send('Healthy');
});

// Readiness check endpoint
app.get('/ready', (req, res) => {
    res.status(200).send('Ready');
});

// POST /order endpoint to receive and process new orders
app.post('/order', async (req, res) => {
    log('Received order request: ' + JSON.stringify(req.body, null, 2));

    const { items, total, paymentInfo } = req.body;

    try {
        const orderId = 'ORD' + Math.random().toString(36).substr(2, 9).toUpperCase();
        const estimatedDeliveryDate = new Date();
        estimatedDeliveryDate.setDate(estimatedDeliveryDate.getDate() + 7);

        const orderSummary = {
            orderId,
            status: "Confirmed",
            orderSummary: { total, items },
            paymentStatus: "Processing",
            estimatedDeliveryDate: estimatedDeliveryDate.toISOString().split('T')[0],
            billingAddress: paymentInfo.billingAddress,
            customerNotification: {
                email: paymentInfo.email,
                notificationStatus: "Email sent"
            }
        };

        await daprClient.state.save(stateStoreName, [{ key: orderId, value: orderSummary }]);
        log(`Order ID ${orderId} saved to state store`);

        // Stock update logic
        const stockUpdates = items.map(item => ({ id: item.id, purchaseQty: item.quantity }));
        await daprClient.pubsub.publish("orderpubsub", "stockUpdate", { updates: stockUpdates });
        log("Published stock updates to 'stockUpdate' topic");

        await daprClient.pubsub.publish("orderpubsub", "orderProcessed", orderSummary);
        log("Published order details to 'orderProcessed' topic");

        res.status(200).json(orderSummary);
    } catch (error) {
        log('Error processing order: ' + error.message, 'error');
        res.status(500).send({ message: "Error processing order", error: error.message });
    }
});

// GET /order/{id} endpoint to retrieve order status
app.get('/order/:id', async (req, res) => {
    const orderId = req.params.id;
    log(`Retrieving order with ID ${orderId}`);

    try {
        const order = await daprClient.state.get(stateStoreName, orderId);
        if (order) {
            log('Order retrieved: ' + JSON.stringify(order));
            res.status(200).send(order);
        } else {
            log(`Order ID ${orderId} not found`, 'warn');
            res.status(404).send({ message: "Order not found" });
        }
    } catch (error) {
        log('Error retrieving order: ' + error.message, 'error');
        res.status(500).send({ message: "Error retrieving order", error: error.message });
    }
});

// GET /orders endpoint to retrieve all orders
app.get('/orders', async (req, res) => {
    log('Retrieving all orders');

    try {
        const allOrders = await daprClient.state.getAll(stateStoreName);

        if (allOrders && allOrders.length > 0) {
            log('Orders retrieved successfully');
            res.status(200).json(allOrders);
        } else {
            log('No orders found', 'warn');
            res.status(404).send({ message: "No orders found" });
        }
    } catch (error) {
        log('Error retrieving orders: ' + error.message, 'error');
        res.status(500).send({ message: "Error retrieving orders", error: error.message });
    }
});

// Start the server
const port = 3000;
app.listen(port, () => {
    log(`Order service listening on port ${port}`);
});