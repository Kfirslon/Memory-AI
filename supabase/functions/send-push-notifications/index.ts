// @deno-types="npm:web-push"
import webpush from "npm:web-push@3.6.7";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_EMAIL = Deno.env.get("VAPID_EMAIL") ?? "mailto:noreply@memorytap.app";

// Configure web-push with VAPID keys
webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

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

        console.log("🔔 Checking for due reminders...");

        // Get current time
        const now = new Date();
        const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
        const oneMinuteFromNow = new Date(now.getTime() + 60 * 1000);

        // Find memories with reminders due within the next minute
        const { data: dueMemories, error: memoriesError } = await supabase
            .from("memories")
            .select("id, user_id, title, summary, reminder_time")
            .gte("reminder_time", oneMinuteAgo.toISOString())
            .lte("reminder_time", oneMinuteFromNow.toISOString())
            .eq("is_completed", false);

        if (memoriesError) {
            throw new Error(`Failed to fetch memories: ${memoriesError.message}`);
        }

        if (!dueMemories || dueMemories.length === 0) {
            console.log("✅ No due reminders found");
            return new Response(JSON.stringify({ sent: 0 }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        console.log(`📋 Found ${dueMemories.length} due reminder(s)`);

        let successCount = 0;
        let failureCount = 0;

        for (const memory of dueMemories) {
            // Get push subscriptions for this user
            const { data: subscriptions, error: subError } = await supabase
                .from("push_subscriptions")
                .select("*")
                .eq("user_id", memory.user_id);

            if (subError) {
                console.error(`Failed to get subscriptions for user ${memory.user_id}:`, subError);
                continue;
            }

            if (!subscriptions || subscriptions.length === 0) {
                console.log(`No push subscriptions for user ${memory.user_id}`);
                continue;
            }

            // Send notification to each subscription
            for (const sub of subscriptions) {
                const pushSubscription = {
                    endpoint: sub.endpoint,
                    keys: {
                        p256dh: sub.p256dh,
                        auth: sub.auth,
                    },
                };

                const payload = JSON.stringify({
                    title: `⏰ Reminder: ${memory.title}`,
                    body: memory.summary || "You have a reminder!",
                    icon: "/icon-192.png",
                    badge: "/icon-192.png",
                    tag: `reminder-${memory.id}`,
                    data: {
                        memoryId: memory.id,
                        url: `/?tab=timeline&memory=${memory.id}`,
                    },
                });

                try {
                    await webpush.sendNotification(pushSubscription, payload);
                    console.log(`✅ Sent notification for memory ${memory.id} to ${sub.endpoint.slice(0, 50)}...`);
                    successCount++;
                } catch (pushError: any) {
                    console.error(`❌ Failed to send push:`, pushError.message);

                    // If subscription is invalid, remove it
                    if (pushError.statusCode === 410 || pushError.statusCode === 404) {
                        console.log(`🗑️ Removing invalid subscription: ${sub.id}`);
                        await supabase
                            .from("push_subscriptions")
                            .delete()
                            .eq("id", sub.id);
                    }
                    failureCount++;
                }
            }
        }

        console.log(`📊 Results: ${successCount} sent, ${failureCount} failed`);

        return new Response(
            JSON.stringify({
                sent: successCount,
                failed: failureCount,
                memoriesProcessed: dueMemories.length
            }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    } catch (error: any) {
        console.error("❌ Error:", error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
