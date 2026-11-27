export const COUPLE_PHOTOS_BUCKET = 'couple-photos';
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const SIGNED_URL_TTL_SECONDS = 300;
export const MAX_PHOTO_PICK_SELECTION = 10;

export const ALLOWED_PHOTO_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

export type AllowedPhotoMimeType = (typeof ALLOWED_PHOTO_MIME_TYPES)[number];

export type PhotoExtension = 'jpg' | 'png' | 'webp' | 'heic' | 'heif';

export interface StorageObjectSummary {
  readonly path: string;
  readonly name: string;
  readonly createdAt: string;
  readonly sizeBytes: number | null;
  readonly mimeType: AllowedPhotoMimeType | null;
}

export interface PhotoLibraryItem extends StorageObjectSummary {
  readonly signedUrl: string;
}

export interface UploadProgressState {
  readonly current: number;
  readonly total: number;
}

export type PhotoValidationErrorKey =
  | 'unsupportedFormat'
  | 'emptyFile'
  | 'fileTooLarge';

export type PhotoErrorKey =
  | 'notConfigured'
  | 'notAuthenticated'
  | 'coupleRequired'
  | 'invalidPath'
  | 'unsupportedFormat'
  | 'emptyFile'
  | 'fileTooLarge'
  | 'permissionDenied'
  | 'notAuthorized'
  | 'notFound'
  | 'networkError'
  | 'readFailed'
  | 'unknown';
