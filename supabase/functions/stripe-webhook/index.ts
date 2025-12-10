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
    console.log(`🚀 Webhook request received: ${req.method} ${req.url}`);
    console.log(`📋 Headers:`, Object.fromEntries(req.headers.entries()));
    
    const signature = req.headers.get("Stripe-Signature");

    if (!signature) {
        console.error("❌ No signature found");
        console.error("Available headers:", Object.keys(Object.fromEntries(req.headers.entries())));
        return new Response(JSON.stringify({ error: "No signature" }), { status: 400 });
    }

    const body = await req.text();
    console.log(`📦 Body length: ${body.length} bytes`);

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
                const session = event.data.object as any;
                console.log(`✅ Checkout completed for customer: ${session.customer}`);
                console.log(`Session metadata:`, session.metadata);
                console.log(`Session subscription ID: ${session.subscription}`);

                if (!session.subscription) {
                    console.error("❌ No subscription ID in session");
                    break;
                }

                try {
                    const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
                    console.log(`✅ Retrieved subscription: ${subscription.id}, status: ${subscription.status}`);

                    const userId = session.metadata?.userId;
                    if (!userId) {
                        console.error("❌ No userId in session metadata");
                        break;
                    }

                    const { error: updateError } = await supabase
                        .from("user_subscriptions")
                        .update({
                            stripe_customer_id: session.customer,
                            stripe_subscription_id: subscription.id,
                            status: subscription.status || "active",
                            price_id: subscription.items.data[0]?.price.id || null,
                            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                            cancel_at_period_end: subscription.cancel_at_period_end,
                            updated_at: new Date().toISOString(),
                        })
                        .eq("user_id", userId);

                    if (updateError) {
                        console.error("❌ Error updating subscription:", updateError);
                    } else {
                        console.log(`✅ Successfully updated user subscription ${userId} to status: ${subscription.status}`);
                    }
                } catch (subError: any) {
                    console.error("❌ Error processing subscription:", subError.message || subError);
                }
                break;
            }

            case "customer.subscription.created": {
                const subscription = event.data.object as any;
                console.log(`🆕 Subscription created: ${subscription.id}`);

                try {
                    const { data: existingSub } = await supabase
                        .from("user_subscriptions")
                        .select("user_id")
                        .eq("stripe_customer_id", subscription.customer)
                        .single();

                    if (existingSub) {
                        const { error: updateErr } = await supabase
                            .from("user_subscriptions")
                            .update({
                                stripe_subscription_id: subscription.id,
                                status: subscription.status,
                                price_id: subscription.items.data[0]?.price.id || null,
                                current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                                current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                                cancel_at_period_end: subscription.cancel_at_period_end,
                                updated_at: new Date().toISOString(),
                            })
                            .eq("stripe_customer_id", subscription.customer);

                        if (updateErr) {
                            console.error("❌ Error updating subscription on creation:", updateErr);
                        } else {
                            console.log(`✅ Updated subscription ${subscription.id} on creation`);
                        }
                    }
                } catch (err: any) {
                    console.error("❌ Error in subscription.created:", err.message || err);
                }
                break;
            }

            case "customer.subscription.updated": {
                const subscription = event.data.object as any;
                console.log(`🔄 Subscription updated: ${subscription.id}, status: ${subscription.status}`);

                try {
                    const { error: updateErr } = await supabase
                        .from("user_subscriptions")
                        .update({
                            status: subscription.status,
                            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
                            cancel_at_period_end: subscription.cancel_at_period_end,
                            updated_at: new Date().toISOString(),
                        })
                        .eq("stripe_subscription_id", subscription.id);

                    if (updateErr) {
                        console.error("❌ Error updating subscription:", updateErr);
                    }
                } catch (err: any) {
                    console.error("❌ Error in subscription.updated:", err.message || err);
                }
                break;
            }

            case "customer.subscription.deleted": {
                const subscription = event.data.object as any;
                console.log(`❌ Subscription deleted: ${subscription.id}`);

                try {
                    const { error: updateErr } = await supabase
                        .from("user_subscriptions")
                        .update({
                            status: "canceled",
                            updated_at: new Date().toISOString(),
                        })
                        .eq("stripe_subscription_id", subscription.id);

                    if (updateErr) {
                        console.error("❌ Error updating canceled subscription:", updateErr);
                    }
                } catch (err: any) {
                    console.error("❌ Error in subscription.deleted:", err.message || err);
                }
                break;
            }

            case "invoice.payment_succeeded": {
                const invoice = event.data.object as any;
                console.log(`💰 Payment succeeded for invoice: ${invoice.id}`);

                if (invoice.subscription) {
                    try {
                        const { error: updateErr } = await supabase
                            .from("user_subscriptions")
                            .update({
                                status: "active",
                                updated_at: new Date().toISOString(),
                            })
                            .eq("stripe_subscription_id", invoice.subscription);

                        if (updateErr) {
                            console.error("❌ Error updating on payment success:", updateErr);
                        }
                    } catch (err: any) {
                        console.error("❌ Error in payment.succeeded:", err.message || err);
                    }
                }
                break;
            }

            case "invoice.payment_failed": {
                const invoice = event.data.object as any;
                console.log(`❌ Payment failed for invoice: ${invoice.id}`);

                if (invoice.subscription) {
                    try {
                        const { error: updateErr } = await supabase
                            .from("user_subscriptions")
                            .update({
                                status: "past_due",
                                updated_at: new Date().toISOString(),
                            })
                            .eq("stripe_subscription_id", invoice.subscription);

                        if (updateErr) {
                            console.error("❌ Error updating on payment failed:", updateErr);
                        }
                    } catch (err: any) {
                        console.error("❌ Error in payment.failed:", err.message || err);
                    }
                }
                break;
            }

            default:
                console.log(`⏭️ Unhandled event type: ${event.type}`);
        }

        console.log("✅ Webhook processed successfully");
        return new Response(JSON.stringify({ received: true }), {
            headers: { "Content-Type": "application/json" },
            status: 200,
        });
    } catch (error: any) {
        console.error("❌ Webhook error:", error.message);
        console.error("Error details:", error);
        // ALWAYS return 200 to Stripe, even on errors
        return new Response(JSON.stringify({ received: true, error: error.message }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }
});