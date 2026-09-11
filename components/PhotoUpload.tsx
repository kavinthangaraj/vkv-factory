'use client';

import { useState, useRef } from 'react';

interface Props {
  onFileSelect: (file: File | null) => void;
  required?: boolean;
  label?: string;
}

export function PhotoUpload({ onFileSelect, required, label = 'Photo' }: Props) {
  const [preview, setPreview]     = useState<string | null>(null);
  const [isDragging, setDragging] = useState(false);
  const inputRef                  = useRef<HTMLInputElement>(null);

  const handle = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }
    setPreview(URL.createObjectURL(file));
    onFileSelect(file);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handle(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handle(f);
  };

  const remove = () => {
    setPreview(null);
    onFileSelect(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
        {!required && <span className="text-gray-400 font-normal"> (optional)</span>}
      </label>

      {preview ? (
        <div className="relative rounded-xl overflow-hidden border border-gray-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Preview" className="w-full max-h-64 object-contain bg-gray-100" />
          <button
            type="button"
            onClick={remove}
            className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm shadow"
          >
            ✕
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors select-none ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
          }`}
        >
          <div className="text-4xl mb-2">📷</div>
          <p className="text-sm text-gray-500">
            <span className="text-blue-600 font-medium">Tap to choose photo</span>
            <span className="hidden sm:inline"> or drag &amp; drop</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">Supports JPG, PNG, HEIC</p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onInputChange}
        className="hidden"
      />
    </div>
  );
}
