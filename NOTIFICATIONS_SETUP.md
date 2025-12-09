# Web Push Notifications Setup Guide

This guide walks you through setting up push notifications that work **even when the browser is closed**.

## Quick Overview

| Component | Status |
|-----------|--------|
| Service Worker (`public/sw.js`) | ✅ Created |
| Frontend Component | ✅ Created |
| Database Table | 📋 Run SQL |
| Edge Function | 📋 Deploy |
| VAPID Keys | 📋 Add to secrets |
| Cron Job | 📋 Set up |

---

## Step 1: Run Database Migration

Go to **Supabase Dashboard > SQL Editor** and run:

```sql
-- From push_subscriptions.sql
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own subscriptions"
ON push_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own subscriptions"
ON push_subscriptions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions"
ON push_subscriptions FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own subscriptions"
ON push_subscriptions FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access"
ON push_subscriptions FOR ALL USING (auth.role() = 'service_role');
```

---

## Step 2: Add VAPID Keys to Supabase Secrets

Go to **Supabase Dashboard > Settings > Edge Functions > Secrets** and add:

| Secret Name | Value |
|-------------|-------|
| `VAPID_PUBLIC_KEY` | `BL1GL2UWNrV_N66hhJfM8ZO_pLwVCTLfGnrCNkfLC2FO0S-qZKch2nmjbv5QjbCalcKEZkS1BoxrZ4JOWDWLxHg` |
| `VAPID_PRIVATE_KEY` | `Gx4LRhkFZTU9kizje8C1Mbj6Abk5NqKaUZEw8pf9m7I` |
| `VAPID_EMAIL` | `mailto:your-email@example.com` |

---

## Step 3: Deploy Edge Function

From your project directory, run:

```bash
npx supabase functions deploy send-push-notifications
```

Or manually deploy via Supabase Dashboard.

---

## Step 4: Enable pg_cron Extension

1. Go to **Supabase Dashboard > Database > Extensions**
2. Search for `pg_cron`
3. Enable it

---

## Step 5: Create Cron Job

In SQL Editor, run (replace placeholders with your actual values):

```sql
SELECT cron.schedule(
    'check-push-notifications',
    '* * * * *',
    $$
    SELECT net.http_post(
        url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-push-notifications',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
        ),
        body := '{}'::jsonb
    );
    $$
);
```

Find your values:
- **Project Ref**: Dashboard URL shows `https://supabase.com/dashboard/project/YOUR_PROJECT_REF`
- **Service Role Key**: Dashboard > Settings > API > `service_role` key

---

## Testing

1. Run `npm run dev` and open the app
2. Allow notifications when prompted
3. Create a memory with a reminder set 2 minutes in the future
4. **Close the browser completely**
5. Wait for reminder time → notification should appear!

---

## Troubleshooting

**No notification permission prompt?**
- Check browser settings, may need to reset permissions for localhost

**Cron job not running?**
- Verify pg_cron is enabled
- Check `cron.job_run_details` table for errors

**Push not received?**
- Check Edge Function logs in Supabase Dashboard
- Verify VAPID keys are correct
