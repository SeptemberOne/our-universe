import * as Crypto from 'expo-crypto';

import { getSupabaseClient } from '@/lib/supabase';
import {
  buildPhotoStoragePath,
  filterListedPhotoObjects,
  isPathScopedToCouple,
  isValidUuid,
  mapPhotoErrorToKey,
  validatePhotoCandidate,
} from './photoLogic';
import {
  COUPLE_PHOTOS_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  type PhotoErrorKey,
  type PhotoLibraryItem,
} from './types';

export type PhotoServiceResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly errorKey: PhotoErrorKey };

export interface UploadPhotoInput {
  readonly coupleId: string;
  readonly uri: string;
  readonly mimeType?: string | null;
  readonly fileName?: string | null;
  readonly fileSizeBytes?: number | null;
}

export async function listCouplePhotos(
  coupleId: string,
): Promise<PhotoServiceResult<PhotoLibraryItem[]>> {
  const client = getSupabaseClient();
  if (!client) {
    return { ok: false, errorKey: 'notConfigured' };
  }

  if (!isValidUuid(coupleId)) {
    return { ok: false, errorKey: 'invalidPath' };
  }

  try {
    const folder = coupleId.trim().toLowerCase();
    const { data: listed, error: listError } = await client.storage
      .from(COUPLE_PHOTOS_BUCKET)
      .list(folder, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (listError) {
      return { ok: false, errorKey: mapPhotoErrorToKey(listError.message) };
    }

    const objects = filterListedPhotoObjects(listed ?? [], folder);
    if (objects.length === 0) {
      return { ok: true, data: [] };
    }

    const paths = objects.map((item) => item.path);
    const { data: signedEntries, error: signError } = await client.storage
      .from(COUPLE_PHOTOS_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

    if (signError || !signedEntries) {
      return { ok: false, errorKey: mapPhotoErrorToKey(signError?.message) };
    }

    const signedUrlByPath = new Map<string, string>();
    for (const entry of signedEntries) {
      if (entry.path && entry.signedUrl && !entry.error) {
        signedUrlByPath.set(entry.path, entry.signedUrl);
      }
    }

    const items: PhotoLibraryItem[] = [];
    for (const item of objects) {
      const signedUrl = signedUrlByPath.get(item.path);
      if (signedUrl) {
        items.push({ ...item, signedUrl });
      }
    }

    return { ok: true, data: items };
  } catch (error) {
    const message = error instanceof Error ? error.message : undefined;
    return { ok: false, errorKey: mapPhotoErrorToKey(message) };
  }
}

export async function uploadCouplePhoto(
  input: UploadPhotoInput,
): Promise<PhotoServiceResult<string>> {
  const client = getSupabaseClient();
  if (!client) {
    return { ok: false, errorKey: 'notConfigured' };
  }

  if (!isValidUuid(input.coupleId)) {
    return { ok: false, errorKey: 'invalidPath' };
  }

  const preValidation = validatePhotoCandidate({
    mimeType: input.mimeType,
    fileName: input.fileName,
    fileSizeBytes: input.fileSizeBytes,
  });
  if (!preValidation.ok) {
    return { ok: false, errorKey: preValidation.errorKey };
  }

  let arrayBuffer: ArrayBuffer;
  try {
    const response = await fetch(input.uri);
    if (!response.ok) {
      return { ok: false, errorKey: 'readFailed' };
    }
    arrayBuffer = await response.arrayBuffer();
  } catch {
    return { ok: false, errorKey: 'readFailed' };
  }

  const byteValidation = validatePhotoCandidate({
    mimeType: preValidation.mimeType,
    fileName: input.fileName,
    fileSizeBytes: arrayBuffer.byteLength,
  });
  if (!byteValidation.ok) {
    return { ok: false, errorKey: byteValidation.errorKey };
  }

  const photoId = Crypto.randomUUID();
  const storagePath = buildPhotoStoragePath({
    coupleId: input.coupleId,
    photoId,
    mimeType: byteValidation.mimeType,
  });
  if (!storagePath) {
    return { ok: false, errorKey: 'invalidPath' };
  }

  try {
    const { error } = await client.storage
      .from(COUPLE_PHOTOS_BUCKET)
      .upload(storagePath, arrayBuffer, {
        contentType: byteValidation.mimeType,
        upsert: false,
        cacheControl: '3600',
      });

    if (error) {
      return { ok: false, errorKey: mapPhotoErrorToKey(error.message) };
    }

    return { ok: true, data: storagePath };
  } catch (error) {
    const message = error instanceof Error ? error.message : undefined;
    return { ok: false, errorKey: mapPhotoErrorToKey(message) };
  }
}

export async function deleteCouplePhoto(params: {
  readonly coupleId: string;
  readonly path: string;
}): Promise<PhotoServiceResult<null>> {
  const client = getSupabaseClient();
  if (!client) {
    return { ok: false, errorKey: 'notConfigured' };
  }

  if (!isPathScopedToCouple(params.path, params.coupleId)) {
    return { ok: false, errorKey: 'invalidPath' };
  }

  try {
    const { data, error } = await client.storage
      .from(COUPLE_PHOTOS_BUCKET)
      .remove([params.path]);

    if (error) {
      return { ok: false, errorKey: mapPhotoErrorToKey(error.message) };
    }

    if (!Array.isArray(data) || data.length === 0) {
      return { ok: false, errorKey: 'notAuthorized' };
    }

    return { ok: true, data: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : undefined;
    return { ok: false, errorKey: mapPhotoErrorToKey(message) };
  }
}
