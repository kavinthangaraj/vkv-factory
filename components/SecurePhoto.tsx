'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSignedPhotoUrl, invalidateSignedPhotoUrl } from '@/lib/storage';

interface SecurePhotoProps {
  src: string | null | undefined;
  alt?: string;
  className?: string;
  thumbnailClassName?: string;
  showModalOnTap?: boolean;
}

export function SecurePhoto({
  src,
  alt = 'Receipt or notebook photo',
  className = '',
  thumbnailClassName = 'w-full max-h-72 object-contain rounded-lg border border-gray-200 bg-white shadow-sm',
  showModalOnTap = true,
}: SecurePhotoProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchUrl = useCallback(async (bustCache = false) => {
    if (!src) {
      setSignedUrl(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);

    if (bustCache) {
      invalidateSignedPhotoUrl(src);
    }

    try {
      const url = await getSignedPhotoUrl(src);
      if (url) {
        setSignedUrl(url);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [src]);

  useEffect(() => {
    fetchUrl();
  }, [fetchUrl]);

  const handleImageError = () => {
    // If the image fails to load (e.g. expired signed URL), attempt a refresh once
    fetchUrl(true);
  };

  const handleOpenFull = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (showModalOnTap) {
      setModalOpen(true);
    } else if (signedUrl) {
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    }
  };

  if (!src) return null;

  return (
    <div className={className}>
      {loading ? (
        <div className="w-full h-44 bg-gray-100 animate-pulse rounded-lg flex items-center justify-center text-gray-400 text-xs">
          Loading photo…
        </div>
      ) : error || !signedUrl ? (
        <div className="w-full p-4 bg-gray-50 border border-dashed border-gray-300 rounded-lg text-center text-xs text-gray-500">
          <p>📷 Photo preview unavailable</p>
          <button
            type="button"
            onClick={() => fetchUrl(true)}
            className="mt-1 text-blue-600 hover:underline font-medium"
          >
            Retry loading
          </button>
        </div>
      ) : (
        <div className="relative group">
          <div
            onClick={handleOpenFull}
            className="cursor-pointer group-hover:opacity-95 transition-opacity"
            title="Click to view full photo"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={signedUrl}
              alt={alt}
              onError={handleImageError}
              className={thumbnailClassName}
            />
            <p className="text-xs text-blue-600 hover:underline mt-1 text-center font-medium">
              🔍 Tap to view full size
            </p>
          </div>
        </div>
      )}

      {/* Full screen modal */}
      {modalOpen && signedUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-3 sm:p-6"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[92vh] flex flex-col bg-white rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 bg-gray-100 border-b border-gray-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700">{alt}</span>
              <div className="flex items-center gap-3">
                <a
                  href={signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  Open in New Tab ↗
                </a>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="w-7 h-7 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 flex items-center justify-center text-sm font-bold"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="overflow-auto flex-1 p-2 bg-gray-900 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={signedUrl}
                alt={alt}
                className="max-w-full max-h-[80vh] object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
