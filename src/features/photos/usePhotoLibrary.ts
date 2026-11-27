import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/features/auth/AuthContext';
import type { CoupleLoadStatus } from '@/features/auth/routeGuard';
import { useCouple } from '@/features/couple/CoupleContext';
import { createScopedRequestTracker } from '@/features/couple/coupleStateGuard';
import {
  deleteCouplePhoto,
  listCouplePhotos,
  uploadCouplePhoto,
  type PhotoServiceResult,
} from './photoService';
import type {
  PhotoErrorKey,
  PhotoLibraryItem,
  UploadProgressState,
} from './types';

export interface SelectedPhotoAsset {
  readonly uri: string;
  readonly mimeType?: string | null;
  readonly fileName?: string | null;
  readonly fileSize?: number | null;
}

export interface UploadBatchSummary {
  readonly uploadedCount: number;
  readonly failedCount: number;
  readonly firstErrorKey: PhotoErrorKey | null;
}

interface ScopedPhotoState {
  readonly scopeKey: string;
  readonly status: CoupleLoadStatus;
  readonly photos: readonly PhotoLibraryItem[];
  readonly errorKey: PhotoErrorKey | null;
  readonly uploadProgress: UploadProgressState | null;
  readonly deletingPath: string | null;
}

export function usePhotoLibrary() {
  const { isConfigured, status: authStatus, user, sessionGeneration } = useAuth();
  const { snapshot } = useCouple();
  const coupleId = snapshot?.couple?.id ?? null;

  const activeScopeKey =
    isConfigured && authStatus === 'authenticated' && user?.id && coupleId
      ? `${user.id}:${sessionGeneration}:${coupleId}`
      : null;

  const [scopedState, setScopedState] = useState<ScopedPhotoState | null>(null);
  const trackerRef = useRef(createScopedRequestTracker());

  const loadPhotos = useCallback(async (targetCoupleId: string, scopeKey: string) => {
    const token = trackerRef.current.beginRequest(scopeKey);
    if (!token) {
      return;
    }

    setScopedState((prev) => ({
      scopeKey,
      status: 'loading',
      photos: prev?.scopeKey === scopeKey ? prev.photos : [],
      errorKey: null,
      uploadProgress: prev?.scopeKey === scopeKey ? prev.uploadProgress : null,
      deletingPath: prev?.scopeKey === scopeKey ? prev.deletingPath : null,
    }));

    const result = await listCouplePhotos(targetCoupleId);
    if (!trackerRef.current.isCurrent(token)) {
      return;
    }

    if (result.ok) {
      setScopedState((prev) => ({
        scopeKey,
        status: 'loaded',
        photos: result.data,
        errorKey: null,
        uploadProgress: prev?.scopeKey === scopeKey ? prev.uploadProgress : null,
        deletingPath: prev?.scopeKey === scopeKey ? prev.deletingPath : null,
      }));
    } else {
      setScopedState((prev) => ({
        scopeKey,
        status: 'error',
        photos: prev?.scopeKey === scopeKey ? prev.photos : [],
        errorKey: result.errorKey,
        uploadProgress: prev?.scopeKey === scopeKey ? prev.uploadProgress : null,
        deletingPath: prev?.scopeKey === scopeKey ? prev.deletingPath : null,
      }));
    }
  }, []);

  useEffect(() => {
    const tracker = trackerRef.current;
    tracker.setActiveScope(activeScopeKey);

    if (!coupleId || !activeScopeKey) {
      return () => {
        tracker.setActiveScope(null);
        setScopedState(null);
      };
    }

    const token = tracker.beginRequest(activeScopeKey);
    if (!token) {
      return () => {
        tracker.setActiveScope(null);
        setScopedState(null);
      };
    }

    const targetCoupleId = coupleId;
    const targetScopeKey = activeScopeKey;

    void (async () => {
      const result = await listCouplePhotos(targetCoupleId);
      if (!tracker.isCurrent(token)) {
        return;
      }

      if (result.ok) {
        setScopedState({
          scopeKey: targetScopeKey,
          status: 'loaded',
          photos: result.data,
          errorKey: null,
          uploadProgress: null,
          deletingPath: null,
        });
      } else {
        setScopedState({
          scopeKey: targetScopeKey,
          status: 'error',
          photos: [],
          errorKey: result.errorKey,
          uploadProgress: null,
          deletingPath: null,
        });
      }
    })();

    return () => {
      tracker.setActiveScope(null);
      setScopedState(null);
    };
  }, [activeScopeKey, coupleId]);

  const refresh = useCallback(async () => {
    if (!coupleId || !activeScopeKey) {
      return;
    }
    await loadPhotos(coupleId, activeScopeKey);
  }, [activeScopeKey, coupleId, loadPhotos]);

  const uploadAssets = useCallback(
    async (assets: readonly SelectedPhotoAsset[]): Promise<UploadBatchSummary> => {
      const targetCoupleId = coupleId;
      const targetScopeKey = activeScopeKey;

      if (!targetCoupleId || !targetScopeKey) {
        return { uploadedCount: 0, failedCount: assets.length, firstErrorKey: 'coupleRequired' };
      }

      let uploadedCount = 0;
      let failedCount = 0;
      let firstErrorKey: PhotoErrorKey | null = null;

      for (let index = 0; index < assets.length; index += 1) {
        const asset = assets[index];
        if (!asset || !trackerRef.current.isActiveScope(targetScopeKey)) {
          break;
        }

        setScopedState((prev) => ({
          scopeKey: targetScopeKey,
          status: prev?.scopeKey === targetScopeKey ? prev.status : 'loading',
          photos: prev?.scopeKey === targetScopeKey ? prev.photos : [],
          errorKey: prev?.scopeKey === targetScopeKey ? prev.errorKey : null,
          uploadProgress: { current: index + 1, total: assets.length },
          deletingPath: null,
        }));

        const uploadRes = await uploadCouplePhoto({
          coupleId: targetCoupleId,
          uri: asset.uri,
          mimeType: asset.mimeType,
          fileName: asset.fileName,
          fileSizeBytes: asset.fileSize,
        });

        if (!trackerRef.current.isActiveScope(targetScopeKey)) {
          return { uploadedCount, failedCount, firstErrorKey };
        }

        if (uploadRes.ok) {
          uploadedCount += 1;
        } else {
          failedCount += 1;
          if (!firstErrorKey) {
            firstErrorKey = uploadRes.errorKey;
          }
        }
      }

      if (trackerRef.current.isActiveScope(targetScopeKey)) {
        setScopedState((prev) =>
          prev?.scopeKey === targetScopeKey ? { ...prev, uploadProgress: null } : prev,
        );
        if (uploadedCount > 0) {
          await loadPhotos(targetCoupleId, targetScopeKey);
        }
      }

      return { uploadedCount, failedCount, firstErrorKey };
    },
    [activeScopeKey, coupleId, loadPhotos],
  );

  const deletePhoto = useCallback(
    async (path: string): Promise<PhotoServiceResult<null>> => {
      const targetCoupleId = coupleId;
      const targetScopeKey = activeScopeKey;

      if (!targetCoupleId || !targetScopeKey) {
        return { ok: false, errorKey: 'coupleRequired' };
      }

      setScopedState((prev) =>
        prev?.scopeKey === targetScopeKey ? { ...prev, deletingPath: path } : prev,
      );

      const result = await deleteCouplePhoto({ coupleId: targetCoupleId, path });
      if (!trackerRef.current.isActiveScope(targetScopeKey)) {
        return result;
      }

      setScopedState((prev) =>
        prev?.scopeKey === targetScopeKey ? { ...prev, deletingPath: null } : prev,
      );

      if (result.ok) {
        await loadPhotos(targetCoupleId, targetScopeKey);
      }

      return result;
    },
    [activeScopeKey, coupleId, loadPhotos],
  );

  return useMemo(() => {
    if (!activeScopeKey) {
      return {
        status: 'idle' as CoupleLoadStatus,
        photos: [] as readonly PhotoLibraryItem[],
        errorKey: null as PhotoErrorKey | null,
        uploadProgress: null as UploadProgressState | null,
        deletingPath: null as string | null,
        refresh,
        uploadAssets,
        deletePhoto,
      };
    }

    const matchesScope = scopedState?.scopeKey === activeScopeKey;
    return {
      status: matchesScope ? scopedState.status : ('loading' as CoupleLoadStatus),
      photos: matchesScope ? scopedState.photos : ([] as readonly PhotoLibraryItem[]),
      errorKey: matchesScope ? scopedState.errorKey : null,
      uploadProgress: matchesScope ? scopedState.uploadProgress : null,
      deletingPath: matchesScope ? scopedState.deletingPath : null,
      refresh,
      uploadAssets,
      deletePhoto,
    };
  }, [activeScopeKey, deletePhoto, refresh, scopedState, uploadAssets]);
}
