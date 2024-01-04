// storefront-app/app/api/order/route.js

import { DaprClient, HttpMethod } from "@dapr/dapr";

// Use environment variables with default values
const daprHost = process.env.DAPR_HOST || "127.0.0.1";
const daprPort = process.env.DAPR_HTTP_PORT || "3500";

export async function POST(request) {
  try {
    console.log('Received a POST request');
    const orderDetails = await request.json();
    console.log('Order details received:', JSON.stringify(orderDetails));

    const client = new DaprClient(daprHost, daprPort);
    const serviceAppId = "order-processing-app";
    const serviceMethod = "order";

    console.log('Sending POST request to Dapr with body:', JSON.stringify(orderDetails));
    const response = await client.invoker.invoke(serviceAppId, serviceMethod, HttpMethod.POST, orderDetails);
    console.log('Response received:', response);

    if (!response.ok) {
      console.error('Response not OK:', response);
      throw new Error(`Error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Data received:', JSON.stringify(data));
    return new Response(JSON.stringify({ message: 'Order created successfully', data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error occurred:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
