'use client';

import { createClient } from './supabase/client';

const BUCKET_NAME = 'memory-images';
const USE_SIGNED_URLS = false; // Set to true for private buckets, false for public

/**
 * Compress image before upload to reduce file size
 */
export async function compressImage(file: File, maxSizeMB: number = 2): Promise<File> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Calculate new dimensions (max 1920px width)
                const MAX_WIDTH = 1920;
                const MAX_HEIGHT = 1920;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);

                // Convert to blob with quality adjustment
                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            const compressedFile = new File([blob], file.name, {
                                type: 'image/jpeg',
                                lastModified: Date.now(),
                            });
                            resolve(compressedFile);
                        } else {
                            reject(new Error('Image compression failed'));
                        }
                    },
                    'image/jpeg',
                    0.85 // Quality (0-1)
                );
            };
            img.onerror = () => reject(new Error('Failed to load image'));
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
    });
}

/**
 * Upload image to Supabase Storage
 * Returns public URL if bucket is public, signed URL if private
 */
export async function uploadImageToSupabase(
    file: File,
    userId: string
): Promise<string> {
    const supabase = createClient();

    // Compress image first
    const compressedFile = await compressImage(file);

    // Generate unique filename
    const fileExt = compressedFile.name.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    // Upload to Supabase Storage
    const { data, error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, compressedFile, {
            contentType: compressedFile.type,
            upsert: false,
        });

    if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    // Return signed URL for private buckets, public URL for public buckets
    if (USE_SIGNED_URLS) {
        // Generate signed URL (valid for 1 year) for private buckets
        const { data: signedUrlData, error: urlError } = await supabase.storage
            .from(BUCKET_NAME)
            .createSignedUrl(data.path, 31536000); // 1 year

        if (urlError || !signedUrlData) {
            console.error('Signed URL error:', urlError);
            throw new Error('Failed to generate image URL');
        }

        return signedUrlData.signedUrl;
    } else {
        // Get public URL for public buckets
        const { data: urlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(data.path);

        return urlData.publicUrl;
    }
}

/**
 * Delete image from Supabase Storage
 */
export async function deleteImageFromSupabase(imageUrl: string): Promise<void> {
    const supabase = createClient();

    // Extract path from URL (works for both public and signed URLs)
    const url = new URL(imageUrl);
    const pathParts = url.pathname.split('/');
    const bucketIndex = pathParts.indexOf(BUCKET_NAME);

    if (bucketIndex === -1) {
        console.error('Invalid image URL format');
        return;
    }

    const path = pathParts.slice(bucketIndex + 1).join('/');

    const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([path]);

    if (error) {
        console.error('Delete error:', error);
        throw new Error(`Failed to delete image: ${error.message}`);
    }
}
