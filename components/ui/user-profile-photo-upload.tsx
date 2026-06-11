'use client';

import { useState, useRef } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Camera, Loader2, User, X } from 'lucide-react';
import Image from 'next/image';

interface UserProfilePhotoUploadProps {
  userId: string;
  value?: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  maxSize?: number;
  disabled?: boolean;
  onUploadingChange?: (uploading: boolean) => void;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
}

export function UserProfilePhotoUpload({
  userId,
  value,
  onChange,
  label = 'Profile photo',
  maxSize = 5,
  disabled = false,
  onUploadingChange,
}: UserProfilePhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayUrl = preview || value || null;

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (JPG, PNG, or WebP)');
      return;
    }

    if (file.size > maxSize * 1024 * 1024) {
      setError(`Image must be smaller than ${maxSize}MB`);
      return;
    }

    setError(null);
    setUploading(true);
    onUploadingChange?.(true);

    const previewUrl = URL.createObjectURL(file);
    setPreview(previewUrl);

    try {
      const timestamp = Date.now();
      const safeName = sanitizeFileName(file.name);
      const fileName = `user-profiles/${userId}/avatar-${timestamp}-${safeName}`;
      const storageRef = ref(storage, fileName);
      const snapshot = await uploadBytes(storageRef, file, {
        contentType: file.type || 'image/jpeg',
      });
      const downloadURL = await getDownloadURL(snapshot.ref);

      onChange(downloadURL);
      URL.revokeObjectURL(previewUrl);
      setPreview(null);
    } catch (err: unknown) {
      console.error('Error uploading profile photo:', err);
      setError('Failed to upload photo. Please try again.');
      setPreview(null);
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = () => {
    onChange(null);
    setError(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-700">{label}</Label>
      <div className="flex items-center gap-4">
        <div
          className={`relative h-28 w-28 flex-shrink-0 overflow-hidden rounded-full border-2 border-dashed ${
            displayUrl ? 'border-gray-200' : 'border-gray-300 bg-gray-50'
          }`}
        >
          {displayUrl ? (
            <Image src={displayUrl} alt="Profile" fill className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-gray-400">
              <User className="h-12 w-12" />
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => !disabled && !uploading && fileInputRef.current?.click()}
            disabled={disabled || uploading}
            className="w-fit"
          >
            <Camera className="mr-2 h-4 w-4" />
            {displayUrl ? 'Change photo' : 'Upload photo'}
          </Button>
          {displayUrl && !uploading && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={disabled}
              className="w-fit text-gray-600"
            >
              <X className="mr-1 h-4 w-4" />
              Remove
            </Button>
          )}
          <p className="text-xs text-gray-500">JPG, PNG, or WebP · up to {maxSize}MB</p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || uploading}
      />

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
