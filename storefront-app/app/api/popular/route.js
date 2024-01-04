// storefront-app/app/api/popular/route.js

import { DaprClient, HttpMethod } from "@dapr/dapr";

// Use environment variables with default values
const daprHost = process.env.DAPR_HOST || "127.0.0.1";
const daprPort = process.env.DAPR_HTTP_PORT || "3500";

export async function GET() {
  try {
    console.log('Received a GET request on /api/popular');

    const client = new DaprClient(daprHost, daprPort);
    const serviceAppId = "recommendation-app";
    const serviceMethod = "popular";

    console.log(`Preparing to invoke service with App ID: ${serviceAppId} and Method: ${serviceMethod}`);

    // Sending GET request to DaprClient
    console.log('Sending GET request to DaprClient...');
    const response = await client.invoker.invoke(serviceAppId, serviceMethod, HttpMethod.GET);

    console.log('Response received from service:', response);

    const data = response;
    console.log('Data received:', data);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'  // This header prevents caching of the response
      }
    });
  } catch (error) {
    console.error('Error occurred fetching popular data:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}