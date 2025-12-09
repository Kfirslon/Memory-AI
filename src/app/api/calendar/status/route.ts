import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
        .from('google_tokens')
        .select('calendar_sync_enabled, created_at')
        .eq('user_id', userId)
        .single();

    if (error || !data) {
        return NextResponse.json({ connected: false });
    }

    return NextResponse.json({
        connected: true,
        syncEnabled: data.calendar_sync_enabled,
        connectedAt: data.created_at,
    });
}

export async function DELETE(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error } = await supabase
        .from('google_tokens')
        .delete()
        .eq('user_id', userId);

    if (error) {
        return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest) {
    const body = await request.json();
    const { userId, syncEnabled } = body;

    if (!userId) {
        return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error } = await supabase
        .from('google_tokens')
        .update({
            calendar_sync_enabled: syncEnabled,
            updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

    if (error) {
        return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }

    return NextResponse.json({ success: true, syncEnabled });
}
