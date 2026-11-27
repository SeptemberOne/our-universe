import type {
  AllowedPhotoMimeType,
  PhotoErrorKey,
  PhotoExtension,
  PhotoValidationErrorKey,
  StorageObjectSummary,
} from './types';

const MAX_BYTES = 10 * 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STORAGE_FILE_NAME_PATTERN = /^[0-9a-f-]+\.(jpg|jpeg|png|webp|heic|heif)$/i;

const MIME_TO_EXTENSION: Readonly<Record<AllowedPhotoMimeType, PhotoExtension>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

const EXTENSION_TO_MIME: Readonly<Record<string, AllowedPhotoMimeType>> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};

export function isValidUuid(value: string): boolean {
  return UUID_PATTERN.test(value.trim());
}

export function normalizePhotoMimeType(
  mimeType?: string | null,
  fileName?: string | null,
): AllowedPhotoMimeType | null {
  const cleanedMime = (mimeType ?? '').split(';')[0]?.trim().toLowerCase() ?? '';

  if (cleanedMime && cleanedMime !== 'application/octet-stream') {
    const canonical = cleanedMime === 'image/jpg' ? 'image/jpeg' : cleanedMime;
    if (canonical in MIME_TO_EXTENSION) {
      return canonical as AllowedPhotoMimeType;
    }
    return null;
  }

  const trimmedName = (fileName ?? '').trim();
  const dotIndex = trimmedName.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === trimmedName.length - 1) {
    return null;
  }

  const ext = trimmedName.slice(dotIndex + 1).toLowerCase();
  return EXTENSION_TO_MIME[ext] ?? null;
}

export function extensionForMimeType(mimeType: AllowedPhotoMimeType): PhotoExtension {
  return MIME_TO_EXTENSION[mimeType];
}

export function validatePhotoCandidate(input: {
  readonly mimeType?: string | null;
  readonly fileName?: string | null;
  readonly fileSizeBytes?: number | null;
}):
  | { readonly ok: true; readonly mimeType: AllowedPhotoMimeType }
  | { readonly ok: false; readonly errorKey: PhotoValidationErrorKey } {
  const normalizedMime = normalizePhotoMimeType(input.mimeType, input.fileName);
  if (!normalizedMime) {
    return { ok: false, errorKey: 'unsupportedFormat' };
  }

  if (input.fileSizeBytes !== null && input.fileSizeBytes !== undefined) {
    if (!Number.isFinite(input.fileSizeBytes) || input.fileSizeBytes <= 0) {
      return { ok: false, errorKey: 'emptyFile' };
    }
    if (input.fileSizeBytes > MAX_BYTES) {
      return { ok: false, errorKey: 'fileTooLarge' };
    }
  }

  return { ok: true, mimeType: normalizedMime };
}

export function buildPhotoStoragePath(input: {
  readonly coupleId: string;
  readonly photoId: string;
  readonly mimeType: AllowedPhotoMimeType;
}): string | null {
  const coupleId = input.coupleId.trim().toLowerCase();
  const photoId = input.photoId.trim().toLowerCase();

  if (!isValidUuid(coupleId) || !isValidUuid(photoId)) {
    return null;
  }

  const ext = extensionForMimeType(input.mimeType);
  return `${coupleId}/${photoId}.${ext}`;
}

export function isPathScopedToCouple(path: string, coupleId: string): boolean {
  const trimmedCoupleId = coupleId.trim().toLowerCase();
  if (!isValidUuid(trimmedCoupleId) || !path || path.includes('..') || path.includes('\\')) {
    return false;
  }

  const segments = path.split('/');
  if (segments.length !== 2) {
    return false;
  }

  const [folder, fileName] = segments;
  if (!folder || !fileName) {
    return false;
  }

  return (
    folder.toLowerCase() === trimmedCoupleId &&
    STORAGE_FILE_NAME_PATTERN.test(fileName)
  );
}

export interface RawStorageFileEntry {
  readonly id: string | null;
  readonly name: string;
  readonly created_at?: string | null;
  readonly updated_at?: string | null;
  readonly metadata?: {
    readonly size?: unknown;
    readonly mimetype?: unknown;
  } | null;
}

export function filterListedPhotoObjects(
  entries: readonly RawStorageFileEntry[],
  coupleId: string,
): StorageObjectSummary[] {
  const cleanCoupleId = coupleId.trim().toLowerCase();
  if (!isValidUuid(cleanCoupleId)) {
    return [];
  }

  const items: StorageObjectSummary[] = [];

  for (const entry of entries) {
    if (
      !entry.id ||
      !entry.name ||
      entry.name === '.emptyFolderPlaceholder' ||
      entry.name.includes('/') ||
      entry.name.includes('..')
    ) {
      continue;
    }

    const rawMime =
      typeof entry.metadata?.mimetype === 'string' ? entry.metadata.mimetype : null;
    const mimeType = normalizePhotoMimeType(rawMime, entry.name);
    if (!mimeType) {
      continue;
    }

    const path = `${cleanCoupleId}/${entry.name}`;
    if (!isPathScopedToCouple(path, cleanCoupleId)) {
      continue;
    }

    const rawSize = entry.metadata?.size;
    const sizeBytes =
      typeof rawSize === 'number' && Number.isFinite(rawSize) && rawSize >= 0 ? rawSize : null;

    items.push({
      path,
      name: entry.name,
      createdAt: entry.created_at ?? entry.updated_at ?? '',
      sizeBytes,
      mimeType,
    });
  }

  items.sort((a, b) => {
    const aMs = Date.parse(a.createdAt);
    const bMs = Date.parse(b.createdAt);
    const safeA = Number.isFinite(aMs) ? aMs : 0;
    const safeB = Number.isFinite(bMs) ? bMs : 0;
    if (safeB !== safeA) {
      return safeB - safeA;
    }
    return b.name.localeCompare(a.name);
  });

  return items;
}

export function mapPhotoErrorToKey(
  message: string | undefined,
  fallback: PhotoErrorKey = 'unknown',
): PhotoErrorKey {
  const normalized = (message ?? '').trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  if (
    normalized.includes('row-level security') ||
    normalized.includes('unauthorized') ||
    normalized.includes('not authorized') ||
    normalized.includes('permission') ||
    normalized.includes('403')
  ) {
    return 'notAuthorized';
  }
  if (
    normalized.includes('payload too large') ||
    normalized.includes('exceeded the maximum allowed size') ||
    normalized.includes('413')
  ) {
    return 'fileTooLarge';
  }
  if (normalized.includes('mime') || normalized.includes('content type')) {
    return 'unsupportedFormat';
  }
  if (normalized.includes('not found') || normalized.includes('404')) {
    return 'notFound';
  }
  if (
    normalized.includes('network') ||
    normalized.includes('fetch') ||
    normalized.includes('timeout')
  ) {
    return 'networkError';
  }

  return fallback;
}

export function formatFileSize(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) {
    return '';
  }
  if (bytes < 1024) {
    return `${Math.round(bytes)} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
