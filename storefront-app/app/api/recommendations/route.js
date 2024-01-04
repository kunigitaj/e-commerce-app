// storefront-app/app/api/recommendations/route.js

import { DaprClient, HttpMethod } from "@dapr/dapr";

// Use environment variables with default values
const daprHost = process.env.DAPR_HOST || "127.0.0.1";
const daprPort = process.env.DAPR_HTTP_PORT || "3500";

export async function GET() {
    try {
        console.log('Received a GET request on /api/recommendations');

        const client = new DaprClient(daprHost, daprPort);
        const serviceAppId = "recommendation-app";
        const serviceMethod = "recommendations";

        console.log('Preparing to invoke service with App ID:', serviceAppId, 'and Method:', serviceMethod);

        // Sending GET request to DaprClient
        console.log('Sending GET request to DaprClient...');
        const response = await client.invoker.invoke(serviceAppId, serviceMethod, HttpMethod.GET);

        console.log('Response received from service:', response);

        const data = response;
        console.log('Processing response data:', data);

        console.log('Returning response with no-store cache setting...');
        return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store'  // This header prevents caching of the response
            }
        });
    } catch (error) {
        console.error('Error occurred during GET request on /api/recommendations:', error.message);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}