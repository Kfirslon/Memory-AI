import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@12.0.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
    apiVersion: '2025-11-17.clover',
    httpClient: Stripe.createFetchHttpClient(),
})

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
    const signature = req.headers.get('stripe-signature')
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

    if (!signature) {
        return new Response('No signature', { status: 400 })
    }

    try {
        const body = await req.text()
        const event = await stripe.webhooks.constructEventAsync(
            body,
            signature,
            webhookSecret,
            undefined,
            Stripe.createSubtleCryptoProvider()
        )

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as any
                console.log('✅ Checkout Session Completed!', session.id)

                if (session.metadata?.userId) {
                    // Update user_metadata directly using auth admin API
                    const { error } = await supabase.auth.admin.updateUserById(
                        session.metadata.userId,
                        { user_metadata: { subscription_status: 'premium' } }
                    )

                    if (error) {
                        console.error('Error updating user subscription:', error)
                        throw error
                    }
                    console.log('Successfully updated user subscription to premium')
                } else {
                    console.error('No userId found in session metadata')
                }
                break
            }
        }

        return new Response(JSON.stringify({ received: true }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (err: any) {
        console.error('Webhook error:', err.message)
        return new Response(`Webhook Error: ${err.message}`, { status: 400 })
    }
})
