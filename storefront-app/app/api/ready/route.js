// storefront-app/app/api/ready/route.js

// Readiness check endpoint
export async function GET() {
    console.log('Received a GET request on /api/ready');
    try {
        return new Response(JSON.stringify({ status: "Ready" }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error occurred during GET request on /api/ready:', error.message);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
