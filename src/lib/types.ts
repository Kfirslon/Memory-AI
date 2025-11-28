export type MemoryCategory = 'task' | 'reminder' | 'idea' | 'note';

export interface Memory {
    id: string;
    user_id: string;
    title: string;
    content: string;
    summary: string;
    category: MemoryCategory;
    audio_url: string | null;
    duration?: number | null;
    is_favorite: boolean;
    is_completed: boolean;
    created_at: string;
    reminder_time?: string | null;
}

export interface ProcessingResult {
    transcription: string;
    summary: string;
    title: string;
    category: MemoryCategory;
}

export interface User {
    id: string;
    email: string;
    user_metadata?: {
        full_name?: string;
        avatar_url?: string;
    };
}