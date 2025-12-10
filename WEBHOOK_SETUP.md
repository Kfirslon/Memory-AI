# Webhook Setup Instructions

## Problem
The Stripe webhook was not receiving events because JWT verification was enabled on all functions. Stripe webhooks cannot authenticate with JWT tokens, so they were being rejected.

## Solution
1. Created `supabase/config.toml` to disable JWT verification for the `stripe-webhook` function
2. Updated webhook logging for better debugging
3. Kept JWT enabled for `create-stripe-session` and `send-push-notifications`

## Deploy Changes

Run this command to deploy the webhook function:

```bash
npx supabase functions deploy stripe-webhook --no-verify-jwt
```

Or if you want to use the config.toml approach:

```bash
npx supabase functions deploy
```

## Test the Webhook

After deploying, test in Stripe Dashboard:

1. Go to Developers → Webhooks
2. Find your endpoint (should end with `/stripe-webhook`)
3. Click "Send test event"
4. Select "checkout.session.completed"
5. Check Supabase Edge Function logs to see if it was received

The logs should show:
- `🚀 Webhook request received`
- `📨 Received event: checkout.session.completed`
- `✅ Successfully updated user subscription`
