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
        
        // Get current time in user's timezone
        const userTimeString = now.toLocaleString('en-US', { timeZone: userTimezone });
        const userTime = new Date(userTimeString);
        const utcOffsetMs = now.getTime() - userTime.getTime();
        const utcOffsetHours = -utcOffsetMs / (1000 * 60 * 60);
        
        const currentLocalTime = now.toLocaleString('en-US', { timeZone: userTimezone, hour12: false });
        const currentTimeInfo = `Current UTC time: ${now.toISOString()}\nUser's timezone: ${userTimezone}\nUTC offset: ${utcOffsetHours > 0 ? '+' : ''}${utcOffsetHours} hours\nUser's current local time: ${currentLocalTime}`;

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: `You are an intelligent personal assistant specialized in parsing time expressions. Your job is to extract reminder times accurately.

CONTEXT:
${currentTimeInfo}

RULES FOR TIME PARSING:
1. "at 11:30" or "11.30" or "11 30" = 11:30 AM TODAY in user's LOCAL timezone
2. "in 2 hours" = add 2 hours to user's current local time
3. "tomorrow at 9am" = tomorrow at 9:00 AM in user's LOCAL timezone
4. "next Monday" = coming Monday at midnight in user's LOCAL timezone
5. Always convert user's LOCAL time to UTC using offset: ${utcOffsetHours > 0 ? '+' : ''}${utcOffsetHours}

EXAMPLES:
- User says "remind me at 2pm" and it's currently 10:00am in EST (UTC-5)
  → 2pm EST = 19:00 UTC → "2025-12-10T19:00:00.000Z"
- User says "remind me in 3 hours" and it's currently 10:00am in EST
  → 1pm EST = 18:00 UTC → "2025-12-10T18:00:00.000Z"

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
