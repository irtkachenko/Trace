// Upload limits and policies configuration

export interface UploadLimits {
  maxFilesPerMessage: number;
  // Note: file size limits and allowed types come from Supabase Storage API
  // This config only contains app-specific business logic
}

export interface UploadConfig {
  limits: UploadLimits;
  // Additional upload policies can be added here
  policies: {
    compression: {
      enabled: boolean;
      maxSizeMB: number;
      maxWidthOrHeight: number;
    };
  };
}

export const uploadConfig: UploadConfig = {
  limits: {
    maxFilesPerMessage: 4, // Business logic: how many files per message
  },
  policies: {
    compression: {
      enabled: true,
      maxSizeMB: 0.8,
      maxWidthOrHeight: 1920,
    },
  },
};

// Helper functions
export function getMaxFilesPerMessage(): number {
  return uploadConfig.limits.maxFilesPerMessage;
}
