import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@12.0.0";

const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") as string;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

console.log("🌍 Stripe Webhook is running...");

const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: "2023-10-16",
    httpClient: Stripe.createFetchHttpClient(),
});

const cryptoProvider = Stripe.createSubtleCryptoProvider();

Deno.serve(async (req) => {
    const signature = req.headers.get("Stripe-Signature");

    if (!signature) {
        console.error("❌ No signature found");
        return new Response(JSON.stringify({ error: "No signature" }), { status: 400 });
    }

    const body = await req.text();

    try {
        const event = await stripe.webhooks.constructEventAsync(
            body,
            signature,
            WEBHOOK_SECRET!,
            undefined,
            cryptoProvider
        );

        console.log(`📨 Received event: ${event.type}`);

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });

        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object;
                console.log(`✅ Checkout completed for customer: ${session.customer}`);
                console.log(`Session metadata:`, session.metadata);

                // Get subscription details
                const subscription = await stripe.subscriptions.retrieve(session.subscription as string);

                // Update or insert user subscription
                const { error: upsertError } = await supabase
                    .from("user_subscriptions")
                    .upsert({
                        user_id: session.metadata?.userId,
                        stripe_customer_id: session.customer,
                        stripe_subscription_id: session.subscription,
                        status: "active",
                        price_id: subscription.items.data[0].price.id,
                        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                        cancel_at_period_end: subscription.cancel_at_period_end,
                        updated_at: new Date().toISOString(),
                    }, {
                        onConflict: 'user_id'
                    });

                if (upsertError) {
                    console.error("❌ Error upserting subscription:", upsertError);
                    throw upsertError;
                }

                console.log("✅ Successfully updated user subscription to active");

                // Sync to user_metadata for frontend access
                await supabase.auth.admin.updateUserById(
                    session.metadata?.userId as string,
                    { user_metadata: { subscription_status: 'premium', stripe_customer_id: session.customer } }
                );
                break;
            }

            case "customer.subscription.created": {
                const subscription = event.data.object;
                console.log(`🆕 Subscription created: ${subscription.id}`);

                // Find user_id from customer
                const { data: existingSub } = await supabase
                    .from("user_subscriptions")
                    .select("user_id")
                    .eq("stripe_customer_id", subscription.customer)
                    .single();

                if (existingSub) {
                    await supabase
                        .from("user_subscriptions")
                        .update({
                            stripe_subscription_id: subscription.id,
                            status: subscription.status,
                            price_id: subscription.items.data[0].price.id,
                            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                            cancel_at_period_end: subscription.cancel_at_period_end,
                            updated_at: new Date().toISOString(),
                        })
                        .eq("stripe_customer_id", subscription.customer);
                }
                break;
            }

            case "customer.subscription.updated": {
                const subscription = event.data.object;
                console.log(`🔄 Subscription updated: ${subscription.id}, status: ${subscription.status}`);

                await supabase
                    .from("user_subscriptions")
                    .update({
                        status: subscription.status,
                        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                        cancel_at_period_end: subscription.cancel_at_period_end,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("stripe_subscription_id", subscription.id);
                break;
            }

            case "customer.subscription.deleted": {
                const subscription = event.data.object;
                console.log(`❌ Subscription deleted: ${subscription.id}`);

                await supabase
                    .from("user_subscriptions")
                    .update({
                        status: "canceled",
                        updated_at: new Date().toISOString(),
                    })
                    .eq("stripe_subscription_id", subscription.id);
                break;
            }

            case "invoice.payment_succeeded": {
                const invoice = event.data.object;
                console.log(`💰 Payment succeeded for invoice: ${invoice.id}`);

                // Ensure subscription is marked as active
                if (invoice.subscription) {
                    await supabase
                        .from("user_subscriptions")
                        .update({
                            status: "active",
                            updated_at: new Date().toISOString(),
                        })
                        .eq("stripe_subscription_id", invoice.subscription);
                }
                break;
            }

            case "invoice.payment_failed": {
                const invoice = event.data.object;
                console.log(`❌ Payment failed for invoice: ${invoice.id}`);

                if (invoice.subscription) {
                    await supabase
                        .from("user_subscriptions")
                        .update({
                            status: "past_due",
                            updated_at: new Date().toISOString(),
                        })
                        .eq("stripe_subscription_id", invoice.subscription);
                }
                break;
            }
        }

        console.log("✅ Webhook processed successfully");
        return new Response(JSON.stringify({ received: true }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
        });
    } catch (error) {
        console.error("❌ Webhook error:", error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }
});
