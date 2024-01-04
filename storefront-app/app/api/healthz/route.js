// storefront-app/app/api/healthz/route.js

// Health check endpoint
export async function GET() {
    console.log('Received a GET request on /api/healthz');
    try {
        return new Response(JSON.stringify({ status: "Healthy" }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error occurred during GET request on /api/healthz:', error.message);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
