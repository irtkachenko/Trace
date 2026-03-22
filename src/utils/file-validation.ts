import { getUploadAllowedMimeTypes } from '@/config/storage.config';

const EXTENSION_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export function isAllowedMimeType(
  mimeType: string,
  allowedMimeTypes: string[] = getUploadAllowedMimeTypes(),
): boolean {
  if (!mimeType) return false;

  return allowedMimeTypes.some((type) => {
    if (!type.includes('/')) return false;
    const pattern = `^${type.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`;
    return new RegExp(pattern, 'i').test(mimeType);
  });
}

export function isAllowedFileExtension(filename: string, mimeType?: string): boolean {
  if (mimeType) {
    return isAllowedMimeType(mimeType);
  }

  const extension = filename.split('.').pop()?.toLowerCase();
  if (!extension) return false;

  const mappedMime = EXTENSION_TO_MIME[extension];
  if (!mappedMime) return false;

  return isAllowedMimeType(mappedMime);
}
