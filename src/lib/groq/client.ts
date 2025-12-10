'use server';

import Groq from 'groq-sdk';
import { ProcessingResult, MemoryCategory, Memory } from '../types';

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

/**
 * Transcribe audio using Groq Whisper large-v3
 */
export async function transcribeAudio(file: File): Promise<string> {
    try {
        const transcription = await groq.audio.transcriptions.create({
            file: file,
            model: 'whisper-large-v3',
            language: 'en',
        });

        return transcription.text;
    } catch (error) {
        console.error('Groq transcription error:', error);
        throw new Error('Failed to transcribe audio');
    }
}

/**
 * Process transcription using Groq Llama to extract intelligence
 */
export async function processTranscription(transcription: string): Promise<Omit<ProcessingResult, 'transcription'> & { reminderTime?: string }> {
    try {
        // Get current time for relative time calculations
        const now = new Date();
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        
        // Calculate UTC offset correctly
        // Get a date in user's timezone
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: userTimezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        });
        
        const parts = formatter.formatToParts(now);
        const localDate = new Date(
            parseInt(parts.find(p => p.type === 'year')?.value || '2025'),
            parseInt(parts.find(p => p.type === 'month')?.value || '1') - 1,
            parseInt(parts.find(p => p.type === 'day')?.value || '1'),
            parseInt(parts.find(p => p.type === 'hour')?.value || '0'),
            parseInt(parts.find(p => p.type === 'minute')?.value || '0'),
            parseInt(parts.find(p => p.type === 'second')?.value || '0')
        );
        
        // UTC offset in hours (positive = ahead of UTC, negative = behind)
        const utcOffsetMinutes = (localDate.getTime() - now.getTime()) / (1000 * 60);
        const utcOffsetHours = utcOffsetMinutes / 60;
        
        const currentLocalTime = formatter.format(now);
        const currentTimeInfo = `Current UTC time: ${now.toISOString()}\nUser's timezone: ${userTimezone}\nUTC offset: ${utcOffsetHours > 0 ? '+' : ''}${utcOffsetHours.toFixed(1)} hours\nUser's current local time: ${currentLocalTime}`;

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: `You are an intelligent personal assistant specialized in parsing time expressions. Your job is to extract reminder times accurately.

CONTEXT:
${currentTimeInfo}

CONVERSION RULE:
To convert user's LOCAL time to UTC:
- If user says "1pm" and UTC offset is -5: 1pm - (-5) = 1pm + 5 hours = 6pm UTC
- Formula: LOCAL_TIME + UTC_OFFSET = UTC_TIME
- Example: 1:00 PM local with offset -5 → 1:00 PM + 5 hours = 18:00 UTC → "2025-12-10T18:00:00.000Z"

TIME PARSING RULES:
1. "at 1pm" or "1pm" or "1.00" = 1:00 PM TODAY in user's LOCAL timezone
2. "in 2 hours" = add 2 hours to user's current local time (${currentLocalTime})
3. "tomorrow at 9am" = tomorrow at 9:00 AM in user's LOCAL timezone
4. Always convert final time to UTC format using: LOCAL_TIME + ${utcOffsetHours > 0 ? '+' : ''}${utcOffsetHours.toFixed(1)}

EXAMPLES:
If user's timezone offset is -5 (EST):
- "1pm today" → 1:00 PM local → 1:00 + 5 = 18:00 UTC → "2025-12-10T18:00:00.000Z"
- "in 3 hours" and current local time is 10:00 AM → 1:00 PM local → 1:00 + 5 = 18:00 UTC

TASK: Extract from the user's message:
1. Summary (max 2 sentences)
2. Title (max 5 words)
3. Category: 'task', 'reminder', 'idea', or 'note'
4. Reminder time if mentioned, else null

Respond ONLY with valid JSON:
{
  "summary": "string",
  "title": "string",
  "category": "task|reminder|idea|note",
  "reminderTime": "ISO8601 UTC string or null"
}`,
                },
                {
                    role: 'user',
                    content: transcription,
                },
            ],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.3,
            max_tokens: 300,
            response_format: { type: 'json_object' },
        });

        const responseText = completion.choices[0]?.message?.content;
        if (!responseText) throw new Error('No response from Groq');

        const parsed = JSON.parse(responseText);
        console.log('[GROQ] Parsed response:', parsed);

        return {
            summary: parsed.summary,
            title: parsed.title,
            category: parsed.category as MemoryCategory,
            reminderTime: parsed.reminderTime || undefined,
        };
    } catch (error) {
        console.error('Groq processing error:', error);
        throw new Error('Failed to process transcription');
    }
}

/**
 * Complete audio processing pipeline (Server Action)
 */
export async function processAudio(formData: FormData): Promise<ProcessingResult> {
    const file = formData.get('audio') as File;
    if (!file) {
        throw new Error('No audio file provided');
    }

    const transcription = await transcribeAudio(file);
    const intelligence = await processTranscription(transcription);

    return {
        transcription,
        ...intelligence,
    };
}

/**
 * Process manual text entry (without audio)
 */
export async function processManualEntry(text: string): Promise<ProcessingResult> {
    if (!text || text.trim().length < 3) {
        throw new Error('Text is too short');
    }

    // Use the existing processTranscription function
    const intelligence = await processTranscription(text);

    return {
        transcription: text, // Use the input text as transcription
        ...intelligence,
    };
}

/**
 * Generate AI briefing for Focus view
 */
export async function generateBriefing(memories: Memory[]): Promise<{ priorityIds: string[], analysis: string }> {
    try {
        const context = memories
            .filter(m => !m.is_completed && (m.category === 'task' || m.category === 'reminder'))
            .map(m => `ID: ${m.id} | ${m.title} | ${m.summary}`)
            .join('\n');

        if (!context) {
            return { priorityIds: [], analysis: "You're all caught up! No pending tasks or reminders." };
        }

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: `Analyze these tasks/reminders and:
1. Identify the top 3 most urgent/important items (return their IDs)
2. Write a friendly, motivational briefing (max 50 words)

Respond with JSON:
{
  "priorityIds": ["id1", "id2", "id3"],
  "analysis": "..."
}`,
                },
                {
                    role: 'user',
                    content: context,
                },
            ],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.5,
            response_format: { type: 'json_object' },
        });

        const result = JSON.parse(completion.choices[0]?.message?.content || '{}');
        return result;
    } catch (error) {
        console.error('Briefing generation error:', error);
        return { priorityIds: [], analysis: 'Unable to generate insights at this time.' };
    }
}

/**
 * Generate habit analysis for Analytics view
 */
/**
 * Generate habit analysis for Analytics view
 */
export async function generateHabitAnalysis(memories: Memory[]): Promise<{ pattern: string, suggestion: string, productivityScore: number }> {
    try {
        if (memories.length < 3) {
            return {
                pattern: "Not enough data yet",
                suggestion: "Keep capturing your thoughts to unlock insights!",
                productivityScore: 50,
            };
        }

        const context = memories
            .map(m => `${m.category} | ${new Date(m.created_at).toLocaleString()} | ${m.is_completed}`)
            .join('\n');

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: `As a productivity coach, analyze the user's memory patterns based strictly on the provided data.
1. Identify a behavioral pattern (e.g., "You capture most ideas in the morning"). If no clear pattern, say "No clear pattern yet".
2. Provide one actionable suggestion based on the data.
3. Give a productivity score (1-100) based on capture and completion balance.

Respond with JSON:
{
  "pattern": "...",
  "suggestion": "...",
  "productivityScore": 75
}`,
                },
                {
                    role: 'user',
                    content: context,
                },
            ],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.5,
            response_format: { type: 'json_object' },
        });

        const result = JSON.parse(completion.choices[0]?.message?.content || '{}');
        return result;
    } catch (error) {
        console.error('Habit analysis error:', error);
        return {
            pattern: 'Analysis unavailable',
            suggestion: 'Keep capturing your thoughts!',
            productivityScore: 50,
        };
    }
}
