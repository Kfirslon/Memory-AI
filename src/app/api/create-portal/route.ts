import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: '2025-11-17.clover',
});

export async function POST(req: Request) {
    try {
        const { userId, customerId } = await req.json();

        if (!userId) {
            return NextResponse.json({ error: 'User ID required' }, { status: 400 });
        }

        // If we don't have a customerId passed from the client, we might need to look it up.
        // For now, we'll assume the client passes it or we find it via other means if stored.
        // Ideally, we store stripe_customer_id in user_metadata or a profiles table.
        // If not stored, we might need to search Stripe (less efficient).

        // Simplified approach: If we don't have a customer ID easily accessible, 
        // we might rely on the email if it's unique in Stripe.

        // For this implementation, let's assume we can pass the email to find the customer
        // or the client has the ID. 
        // A robust way is to store stripe_customer_id in user_metadata during the webhook.

        // Let's try to find the customer by email if no ID is provided
        let stripeCustomerId = customerId;

        if (!stripeCustomerId) {
            // This is a fallback. Ideally, store the customer ID!
            // We'll need the user's email.
            const { email } = await req.json().catch(() => ({}));
            if (email) {
                const customers = await stripe.customers.list({ email: email, limit: 1 });
                if (customers.data.length > 0) {
                    stripeCustomerId = customers.data[0].id;
                }
            }
        }

        if (!stripeCustomerId) {
            return NextResponse.json({ error: 'Stripe Customer ID not found' }, { status: 404 });
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: stripeCustomerId,
            return_url: `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}?tab=profile`,
        });

        return NextResponse.json({ url: session.url });
    } catch (error: any) {
        console.error('Portal error:', error);
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
