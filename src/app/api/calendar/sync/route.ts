import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
    try {
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: GOOGLE_CLIENT_ID!,
                client_secret: GOOGLE_CLIENT_SECRET!,
                refresh_token: refreshToken,
                grant_type: 'refresh_token',
            }),
        });

        const data = await response.json();
        return data.access_token || null;
    } catch (error) {
        console.error('[Calendar Sync] Error refreshing token:', error);
        return null;
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { userId, memoryId, title, content, reminderTime } = body;

        if (!userId || !reminderTime) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Get user's Google tokens
        const { data: tokenData, error: tokenError } = await supabase
            .from('google_tokens')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (tokenError || !tokenData) {
            return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 404 });
        }

        if (!tokenData.calendar_sync_enabled) {
            return NextResponse.json({ message: 'Calendar sync disabled' }, { status: 200 });
        }

        // Check if token is expired and refresh if needed
        let accessToken = tokenData.access_token;
        const expiresAt = new Date(tokenData.expires_at);

        if (expiresAt < new Date()) {
            console.log('[Calendar Sync] Token expired, refreshing...');
            accessToken = await refreshAccessToken(tokenData.refresh_token);

            if (!accessToken) {
                return NextResponse.json({ error: 'Failed to refresh token' }, { status: 401 });
            }

            // Update token in database
            const newExpiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour
            await supabase
                .from('google_tokens')
                .update({
                    access_token: accessToken,
                    expires_at: newExpiresAt.toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('user_id', userId);
        }

        // Create Google Calendar event
        const eventStartTime = new Date(reminderTime);
        const eventEndTime = new Date(eventStartTime.getTime() + 30 * 60 * 1000); // 30 min event

        const event = {
            summary: `🔔 ${title}`,
            description: content || 'Memory Tap Reminder',
            start: {
                dateTime: eventStartTime.toISOString(),
                timeZone: 'UTC',
            },
            end: {
                dateTime: eventEndTime.toISOString(),
                timeZone: 'UTC',
            },
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'popup', minutes: 0 }, // At event time
                    { method: 'popup', minutes: 5 }, // 5 min before (optional)
                ],
            },
        };

        const calendarResponse = await fetch(
            'https://www.googleapis.com/calendar/v3/calendars/primary/events',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(event),
            }
        );

        const calendarData = await calendarResponse.json();

        if (calendarData.error) {
            console.error('[Calendar Sync] Google API error:', calendarData.error);
            return NextResponse.json({ error: calendarData.error.message }, { status: 400 });
        }

        console.log('[Calendar Sync] Event created:', calendarData.id);
        return NextResponse.json({
            success: true,
            eventId: calendarData.id,
            eventLink: calendarData.htmlLink,
        });

    } catch (error) {
        console.error('[Calendar Sync] Error:', error);
        return NextResponse.json({ error: 'Failed to sync with calendar' }, { status: 500 });
    }
}
