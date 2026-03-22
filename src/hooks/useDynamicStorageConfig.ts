'use client';

import { useState } from 'react';
import { getDefaultMaxFileSize, getUploadAllowedMimeTypes } from '@/config/storage.config';
import { getMaxFilesPerMessage } from '@/config/upload.config';
import { useStorageConfig } from './useStorageConfig';

interface StoragePolicies {
  maxFileSize: number;
  allowedMimeTypes: string[];
  rateLimitPerMinute: number;
  maxTotalSize: number;
  maxFilesPerMessage: number;
}

const DEFAULT_POLICIES: StoragePolicies = {
  maxFileSize: 50 * 1024 * 1024,
  allowedMimeTypes: getUploadAllowedMimeTypes(),
  rateLimitPerMinute: 10,
  maxTotalSize: 100 * 1024 * 1024,
  maxFilesPerMessage: getMaxFilesPerMessage(),
};

export function useDynamicStorageConfig() {
  return useStorageConfig();
}

function matchesMimeType(mimeType: string, allowedMimeTypes: string[]): boolean {
  if (!mimeType) return false;

  return allowedMimeTypes.some((type) => {
    if (!type.includes('/')) return false;
    const pattern = `^${type.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`;
    return new RegExp(pattern, 'i').test(mimeType);
  });
}

function parseMaxFileSize(rawValue: string | null | undefined): number {
  if (!rawValue) return DEFAULT_POLICIES.maxFileSize;

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_POLICIES.maxFileSize;

  return Math.min(parsed, getDefaultMaxFileSize());
}

export function useStorageLimits() {
  const { data: config, isLoading } = useDynamicStorageConfig();

  const allowedMimeTypes =
    Array.isArray(config?.limits.allowedTypes) && config.limits.allowedTypes.length > 0
      ? config.limits.allowedTypes
      : DEFAULT_POLICIES.allowedMimeTypes;

  const maxFileSize = parseMaxFileSize(config?.limits.maxFileSize);

  const getMaxFileSize = (category: 'images' | 'videos' | 'documents'): number => {
    void category;
    return maxFileSize;
  };

  const isAllowedMimeType = (mimeType: string): boolean => {
    return matchesMimeType(mimeType, allowedMimeTypes);
  };

  const getRateLimit = (): number => {
    return DEFAULT_POLICIES.rateLimitPerMinute;
  };

  const getMaxTotalSize = (): number => {
    return DEFAULT_POLICIES.maxTotalSize;
  };

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    if (!isAllowedMimeType(file.type)) {
      return { valid: false, error: 'File type not supported' };
    }

    if (file.size > maxFileSize) {
      const maxSizeMB = Math.round(maxFileSize / 1024 / 1024);
      return {
        valid: false,
        error: `File too large. Maximum size: ${maxSizeMB}MB`,
      };
    }

    return { valid: true };
  };

  const validateFiles = (files: File[]): { valid: boolean; error?: string } => {
    if (files.length > DEFAULT_POLICIES.maxFilesPerMessage) {
      return {
        valid: false,
        error: `Too many files. Maximum: ${DEFAULT_POLICIES.maxFilesPerMessage}`,
      };
    }

    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > DEFAULT_POLICIES.maxTotalSize) {
      const maxTotalMB = Math.round(DEFAULT_POLICIES.maxTotalSize / 1024 / 1024);
      return {
        valid: false,
        error: `Total file size too large. Maximum: ${maxTotalMB}MB`,
      };
    }

    for (const file of files) {
      const validation = validateFile(file);
      if (!validation.valid) {
        return validation;
      }
    }

    return { valid: true };
  };

  const getAcceptString = (): string => {
    return allowedMimeTypes.join(',');
  };

  return {
    config,
    isLoading,
    getMaxFileSize,
    getMaxTotalSize,
    getRateLimit,
    validateFile,
    validateFiles,
    getAcceptString,
  };
}

export function useUploadRateLimit() {
  const { getRateLimit } = useStorageLimits();
  const [uploadCount, setUploadCount] = useState(0);
  const [resetTime, setResetTime] = useState<Date | null>(null);

  const canUpload = (): boolean => {
    const rateLimit = getRateLimit();

    if (resetTime && new Date() > resetTime) {
      setUploadCount(0);
      setResetTime(null);
      return true;
    }

    return uploadCount < rateLimit;
  };

  const recordUpload = (): void => {
    if (!resetTime) {
      const now = new Date();
      setResetTime(new Date(now.getTime() + 60 * 1000));
    }

    setUploadCount((prev: number) => prev + 1);
  };

  const getRemainingUploads = (): number => {
    const rateLimit = getRateLimit();
    return Math.max(0, rateLimit - uploadCount);
  };

  const getTimeUntilReset = (): number => {
    if (!resetTime) return 0;
    return Math.max(0, resetTime.getTime() - new Date().getTime());
  };

  return {
    canUpload,
    recordUpload,
    getRemainingUploads,
    getTimeUntilReset,
    uploadCount,
    resetTime,
  };
}
