import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@12.0.0";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") as string;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const STRIPE_PRICE_ID = Deno.env.get("STRIPE_PRICE_ID");

const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: "2023-10-16",
});

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });

        console.log("🔄 Authenticating user...");
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser(
            req.headers.get("Authorization")?.split(" ")[1] ?? ""
        );

        if (authError || !user) {
            throw new Error("Authentication failed");
        }

        console.log(`✅ User authenticated: ${user.id}`);

        // Check if user already has a subscription
        const { data: subscription, error: subError } = await supabase
            .from("user_subscriptions")
            .select("*")
            .eq("user_id", user.id)
            .single();

        if (subError && subError.code !== "PGRST116") {
            console.error("Subscription lookup error:", subError);
        }

        let stripeCustomerId = subscription?.stripe_customer_id;

        // Create Stripe customer if one doesn't exist
        if (!stripeCustomerId) {
            console.log("🆕 Creating new Stripe customer...");
            const customer = await stripe.customers.create({
                email: user.email,
                metadata: {
                    supabase_user_id: user.id,
                },
            });

            stripeCustomerId = customer.id;
            console.log(`✅ Created Stripe customer: ${customer.id}`);

            // Create initial subscription record
            const { error: insertError } = await supabase
                .from("user_subscriptions")
                .insert({
                    user_id: user.id,
                    stripe_customer_id: customer.id,
                    status: "incomplete",
                });

            if (insertError) {
                console.error("Failed to create subscription record:", insertError);
            }
        }

        const originUrl = req.headers.get("origin") ?? "http://localhost:3000";

        // If already has active subscription, redirect to billing portal
        if (subscription?.status === "active") {
            console.log("🎯 User has active subscription, creating portal session...");
            const portalSession = await stripe.billingPortal.sessions.create({
                customer: stripeCustomerId,
                return_url: `${originUrl}/?tab=profile`,
            });

            return new Response(JSON.stringify({ url: portalSession.url }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        // Create checkout session for new subscribers
        console.log("💳 Creating checkout session...");
        const session = await stripe.checkout.sessions.create({
            customer: stripeCustomerId,
            line_items: [
                {
                    price: STRIPE_PRICE_ID,
                    quantity: 1,
                },
            ],
            mode: "subscription",
            success_url: `${originUrl}/?success=true&tab=profile`,
            cancel_url: `${originUrl}/?canceled=true&tab=profile`,
            metadata: {
                userId: user.id,
            },
        });

        console.log(`✅ Checkout session created: ${session.id}`);

        return new Response(JSON.stringify({ url: session.url }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("❌ Error:", error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
