import { supabase } from './firebase';

const BUCKET = 'factory-photos';

/**
 * Cache for signed URLs in memory:
 * path -> { url: string, expiresAt: number }
 */
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

/**
 * Extracts a normalized storage path inside the 'factory-photos' bucket from any
 * input format: relative path ("purchases/123.jpg"), legacy public URL,
 * or full Supabase signed URL.
 */
export function extractStoragePath(photoUrlOrPath: string | null | undefined): string | null {
  if (!photoUrlOrPath) return null;
  const trimmed = photoUrlOrPath.trim();
  if (!trimmed) return null;

  // Match anything after "/factory-photos/" up to an optional query string
  const bucketMatch = trimmed.match(/\/factory-photos\/(.+?)(\?.*)?$/);
  if (bucketMatch) {
    return decodeURIComponent(bucketMatch[1]);
  }

  // Strip query string if present
  const withoutQuery = trimmed.split('?')[0];

  // Strip bucket prefix if present
  if (withoutQuery.startsWith('factory-photos/')) {
    return withoutQuery.replace(/^factory-photos\//, '');
  }

  return withoutQuery;
}

/**
 * Upload a photo to the private Supabase Storage bucket.
 * Returns the relative storage path inside the bucket (e.g. "purchases/2026-09-11_..._chit.jpg").
 */
export async function uploadPhoto(
  file: File,
  path: string,
  onProgress?: (pct: number) => void,
): Promise<string> {
  onProgress?.(50);

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      upsert: true,
      contentType: file.type || 'image/jpeg',
    });

  if (error) {
    throw new Error(`Failed to upload photo: ${error.message}`);
  }

  onProgress?.(100);

  // Invalidate any previously cached signed URL for this path
  signedUrlCache.delete(data.path);

  // Return the relative path stored in the database
  return data.path;
}

/**
 * Generates an authenticated signed URL for a photo stored in the private bucket.
 * Uses an in-memory cache to avoid redundant API calls within the validity period.
 *
 * @param photoUrlOrPath - Storage path or legacy URL
 * @param expiresInSeconds - Default 3600 seconds (1 hour)
 */
export async function getSignedPhotoUrl(
  photoUrlOrPath: string | null | undefined,
  expiresInSeconds: number = 3600,
): Promise<string | null> {
  const path = extractStoragePath(photoUrlOrPath);
  if (!path) return null;

  // Check cache (allow 60s buffer before actual expiration)
  const cached = signedUrlCache.get(path);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.url;
  }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data?.signedUrl) {
    console.error(`Failed to generate signed URL for path "${path}":`, error?.message);
    return null;
  }

  signedUrlCache.set(path, {
    url: data.signedUrl,
    expiresAt: Date.now() + expiresInSeconds * 1000,
  });

  return data.signedUrl;
}

/**
 * Manually invalidates cached signed URLs (e.g., when refreshing a broken image).
 */
export function invalidateSignedPhotoUrl(photoUrlOrPath: string | null | undefined): void {
  const path = extractStoragePath(photoUrlOrPath);
  if (path) {
    signedUrlCache.delete(path);
  }
}
