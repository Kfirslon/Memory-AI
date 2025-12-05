-- ============================================
-- Supabase Storage Setup for Memory Images
-- Run this in Supabase SQL Editor AFTER creating the bucket
-- ============================================

-- STEP 1: Create the bucket manually in Supabase Dashboard:
-- 1. Go to Storage in Supabase Dashboard
-- 2. Click "Create a new bucket"
-- 3. Name: memory-images
-- 4. Public: NO (keep private)
-- 5. File size limit: 5 MB
-- 6. Allowed MIME types: image/jpeg, image/png, image/webp, image/gif

-- STEP 2: Run these policies after bucket creation:

-- Allow authenticated users to upload images to their own folder
CREATE POLICY "Users can upload their own images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'memory-images' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to read their own images
CREATE POLICY "Users can read their own images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'memory-images' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update their own images
CREATE POLICY "Users can update their own images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'memory-images' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own images
CREATE POLICY "Users can delete their own images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'memory-images' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);
