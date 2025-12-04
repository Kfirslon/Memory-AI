import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { buffer } from 'micro';
import { NextRequest } from 'next/server';

// App Router does not use 'export const config = { api: { bodyParser: false } };'
// Body parsing is disabled by reading the request stream/text directly.

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: '2025-11-17.clover',
});

// Helper function to get the raw body
async function getRawBody(req: NextRequest): Promise<Buffer> {
    const rawBody = await req.text();
    return Buffer.from(rawBody, 'utf-8');
}

export async function POST(req: NextRequest) {
    const signature = req.headers.get('stripe-signature');
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    // 1. Get the raw body buffer (essential for signature verification)
    const buf = await getRawBody(req);

    let event: Stripe.Event;

    try {
        // 2. Verify the signature using the raw buffer
        event = stripe.webhooks.constructEvent(
            buf,
            signature as string,
            webhookSecret as string
        );
    } catch (err: any) {
        console.error(`❌ Webhook signature verification failed: ${err.message}`);
        return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
    }

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
            // const session = event.data.object;
            console.log('✅ Checkout Session Completed!');
            // Implement your business logic here
            break;
        // Handle other event types...
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    return new NextResponse(JSON.stringify({ received: true }), { status: 200 });
}
