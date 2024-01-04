// storefront-app/app/api/products/route.js

import { DaprClient, HttpMethod } from "@dapr/dapr";

// Use environment variables with default values
const daprHost = process.env.DAPR_HOST || "127.0.0.1";
const daprPort = process.env.DAPR_HTTP_PORT || "3500";

export async function GET() {
  console.log("Creating DaprClient with Host:", daprHost, "and Port:", daprPort);
  const client = new DaprClient(daprHost, daprPort);

  const serviceAppId = "stock-management-app";
  const serviceMethod = "products";
  console.log("Preparing to invoke service with App ID:", serviceAppId, "and Method:", serviceMethod);

  try {
    console.log("Sending GET request to DaprClient...");
    const response = await client.invoker.invoke(serviceAppId, serviceMethod, HttpMethod.GET);
    console.log("Response received from service:", response);

    const data = response;
    console.log("Processing response data:", data);

    console.log("Returning response with no-store cache setting...");
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'  // This header prevents caching of the response
      }
    });
  } catch (error) {
    console.error("Error occurred fetching stock data:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}