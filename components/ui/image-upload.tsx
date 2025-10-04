'use client';

import { useState, useRef } from 'react';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import Image from 'next/image';

interface ImageUploadProps {
  label?: string;
  value?: string;
  onChange: (url: string | null) => void;
  accept?: string;
  maxSize?: number; // in MB
  aspectRatio?: string; // e.g., "16/9", "4/3", "1/1"
  className?: string;
  disabled?: boolean;
}

export function ImageUpload({
  label = 'Upload Image',
  value,
  onChange,
  accept = 'image/*',
  maxSize = 5, // 5MB default
  aspectRatio = '16/9',
  className = '',
  disabled = false,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }

    // Validate file size
    if (file.size > maxSize * 1024 * 1024) {
      setError(`File size must be less than ${maxSize}MB`);
      return;
    }

    setError(null);
    setUploading(true);

    try {
      // Create preview
      const previewUrl = URL.createObjectURL(file);
      setPreview(previewUrl);

      // Generate unique filename
      const timestamp = Date.now();
      const fileName = `tournament-banners/${timestamp}-${file.name}`;
      
      // Upload to Firebase Storage
      const storageRef = ref(storage, fileName);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      onChange(downloadURL);
      
      // Clean up preview URL
      URL.revokeObjectURL(previewUrl);
      setPreview(null);
    } catch (err) {
      console.error('Error uploading image:', err);
      setError('Failed to upload image. Please try again.');
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (value) {
      try {
        // Delete from Firebase Storage
        const storageRef = ref(storage, value);
        await deleteObject(storageRef);
      } catch (err) {
        console.error('Error deleting image:', err);
        // Continue with removal even if deletion fails
      }
    }
    
    onChange(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    if (!disabled && !uploading) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {label && <Label>{label}</Label>}
      
      <Card className="border-2 border-dashed border-gray-300 hover:border-gray-400 transition-colors">
        <CardContent className="p-4">
          {value || preview ? (
            <div className="space-y-4">
              <div 
                className="relative w-full rounded-lg overflow-hidden"
                style={{ aspectRatio }}
              >
                <Image
                  src={preview || value || ''}
                  alt="Preview"
                  fill
                  className="object-cover"
                />
                {!disabled && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={handleRemove}
                    disabled={uploading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              
              {uploading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  <span className="text-sm text-gray-600">Uploading...</span>
                </div>
              )}
            </div>
          ) : (
            <div 
              className="flex flex-col items-center justify-center py-8 cursor-pointer"
              onClick={handleClick}
            >
              <div className="rounded-full bg-gray-100 p-4 mb-4">
                <ImageIcon className="h-8 w-8 text-gray-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-900 mb-1">
                  Click to upload banner
                </p>
                <p className="text-xs text-gray-500">
                  PNG, JPG, GIF up to {maxSize}MB
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Recommended aspect ratio: {aspectRatio}
                </p>
              </div>
            </div>
          )}
          
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileSelect}
            className="hidden"
            disabled={disabled || uploading}
          />
        </CardContent>
      </Card>
      
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
