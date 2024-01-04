// storefront-app/app/api/product/[productId]/route.js

import { DaprClient, HttpMethod } from "@dapr/dapr";

// Use environment variables with default values
const daprHost = process.env.DAPR_HOST || "127.0.0.1";
const daprPort = process.env.DAPR_HTTP_PORT || "3500";

export async function GET(request, { params }) {
  try {
    const productId = params.productId;
    console.log('Received a GET request on /api/product/[productId] for Product ID:', productId);

    const client = new DaprClient(daprHost, daprPort);
    const serviceAppId = "stock-management-app";
    const serviceMethod = `product/${productId}`;

    console.log(`Preparing to invoke service with App ID: ${serviceAppId} and Method: ${serviceMethod}`);

    // Sending GET request to DaprClient
    console.log('Sending GET request to DaprClient...');
    const response = await client.invoker.invoke(serviceAppId, serviceMethod, HttpMethod.GET);

    console.log(`Response received for product ID ${productId} from service:`, response);

    const data = response;
    console.log(`Data received for product ID ${productId}:`, data);

    console.log(`Sending response back with data for product ID ${productId}`);
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'  // This header prevents caching of the response
      }
    });
  } catch (error) {
    console.error(`Error occurred fetching data for product ID ${productId}:`, error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}