import { NextRequest, NextResponse } from 'next/server';
import { generateHabitAnalysis } from '@/lib/groq/client';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
    try {
        // Get user session (NOW WITH AWAIT!)
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get memories from request body
        const { memories } = await request.json();

        if (!memories || !Array.isArray(memories)) {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
        }

        // Generate analysis using Groq
        const analysis = await generateHabitAnalysis(memories);

        return NextResponse.json(analysis);
    } catch (error) {
        console.error('Analytics API error:', error);
        return NextResponse.json(
            { error: 'Failed to generate analysis' },
            { status: 500 }
        );
    }
}
