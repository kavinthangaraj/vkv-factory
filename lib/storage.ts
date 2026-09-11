import { supabase } from './firebase';

const BUCKET = 'factory-photos';

/**
 * Upload a photo to Supabase Storage.
 * onProgress fires at 50 (uploading) then 100 (done) — pages don't need changes.
 */
export async function uploadPhoto(
  file: File,
  path: string,
  onProgress?: (pct: number) => void,
): Promise<string> {
  onProgress?.(50);

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true });

  if (error) throw new Error(error.message);

  onProgress?.(100);

  const { data: { publicUrl } } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(data.path);

  return publicUrl;
}
