import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.NEXT_PUBLIC_SITE_URL
    ? `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/google/callback`
    : 'https://memory-ai-delta.vercel.app/api/auth/google/callback';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const userId = searchParams.get('state'); // userId passed from connect route
    const error = searchParams.get('error');

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://memory-ai-delta.vercel.app';

    if (error) {
        console.error('[Google OAuth] Error:', error);
        return NextResponse.redirect(`${baseUrl}/?tab=profile&error=google_auth_denied`);
    }

    if (!code || !userId) {
        return NextResponse.redirect(`${baseUrl}/?tab=profile&error=missing_params`);
    }

    try {
        // Exchange code for tokens
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: GOOGLE_CLIENT_ID!,
                client_secret: GOOGLE_CLIENT_SECRET!,
                code,
                grant_type: 'authorization_code',
                redirect_uri: REDIRECT_URI,
            }),
        });

        const tokens = await tokenResponse.json();

        if (tokens.error) {
            console.error('[Google OAuth] Token error:', tokens);
            return NextResponse.redirect(`${baseUrl}/?tab=profile&error=token_exchange_failed`);
        }

        // Calculate expiry time
        const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

        // Save tokens to database using service role
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { error: dbError } = await supabase
            .from('google_tokens')
            .upsert({
                user_id: userId,
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                expires_at: expiresAt.toISOString(),
                calendar_sync_enabled: true,
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'user_id'
            });

        if (dbError) {
            console.error('[Google OAuth] Database error:', dbError);
            return NextResponse.redirect(`${baseUrl}/?tab=profile&error=db_save_failed`);
        }

        console.log('[Google OAuth] Successfully connected for user:', userId);
        return NextResponse.redirect(`${baseUrl}/?tab=profile&success=google_connected`);

    } catch (err) {
        console.error('[Google OAuth] Error:', err);
        return NextResponse.redirect(`${baseUrl}/?tab=profile&error=unknown`);
    }
}
