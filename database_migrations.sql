-- ============================================
-- Memory-AI Database Migration
-- New Features: Manual Memory Creation, Photos, Google Calendar
-- Run this in Supabase SQL Editor
-- ============================================

-- Add image_url column for photo attachments
ALTER TABLE public.memories 
ADD COLUMN IF NOT EXISTS image_url text;

-- Add gcal_event_id column for Google Calendar sync
ALTER TABLE public.memories 
ADD COLUMN IF NOT EXISTS gcal_event_id text;

-- Add duration column (if not already exists from previous migration)
ALTER TABLE public.memories 
ADD COLUMN IF NOT EXISTS duration numeric;

-- Create index for calendar event lookups
CREATE INDEX IF NOT EXISTS memories_gcal_event_id_idx 
ON public.memories(gcal_event_id) 
WHERE gcal_event_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.memories.image_url IS 'URL to image stored in Supabase Storage (memory-images bucket)';
COMMENT ON COLUMN public.memories.gcal_event_id IS 'Google Calendar event ID for synced reminders';
COMMENT ON COLUMN public.memories.duration IS 'Duration of audio recording in seconds';
