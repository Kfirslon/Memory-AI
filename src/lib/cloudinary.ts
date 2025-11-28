import { createClient } from '@/lib/supabase/client';

// Client-side helper to upload audio via API route
export async function uploadAudioToCloudinary(
  audioBlob: Blob,
  userId: string
): Promise<{ url: string; publicId: string }> {
  try {
    // Get the current session token
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('No active session');
    }

    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio.webm');

    const response = await fetch('/api/upload-audio', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Upload failed');
    }

    const data = await response.json();
    return {
      url: data.url,
      publicId: data.publicId,
    };
  } catch (error: any) {
    console.error('Cloudinary upload error:', error);
    throw new Error(error.message || 'Failed to upload audio to Cloudinary');
  }
}
