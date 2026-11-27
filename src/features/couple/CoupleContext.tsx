import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from '@/features/auth/AuthContext';
import type { CoupleLoadStatus } from '@/features/auth/routeGuard';
import {
  acceptCoupleInvitation,
  createCoupleInvitation,
  createCoupleSpace,
  fetchCoupleSnapshot,
  revokeCoupleInvitation,
  updateOwnDisplayName,
  type CoupleServiceResult,
} from './coupleService';
import {
  applyLoadedSnapshotToState,
  createScopedRequestTracker,
  type ScopedCoupleState,
} from './coupleStateGuard';
import type { CoupleErrorKey, CoupleSnapshot, GeneratedInvitation } from './types';

interface CoupleContextValue {
  readonly status: CoupleLoadStatus;
  readonly snapshot: CoupleSnapshot | null;
  readonly errorKey: CoupleErrorKey | null;
  readonly generatedInvitation: GeneratedInvitation | null;
  readonly refresh: () => Promise<void>;
  readonly createSpace: (title: string) => Promise<CoupleServiceResult<string>>;
  readonly createInvitation: (ttlHours?: number) => Promise<CoupleServiceResult<GeneratedInvitation>>;
  readonly acceptInvitation: (token: string) => Promise<CoupleServiceResult<string>>;
  readonly revokeInvitation: (invitationId: string) => Promise<CoupleServiceResult<boolean>>;
  readonly saveDisplayName: (displayName: string) => Promise<CoupleServiceResult<null>>;
  readonly clearGeneratedInvitation: () => void;
}

type CoupleState = ScopedCoupleState<GeneratedInvitation, CoupleErrorKey>;

const CoupleContext = createContext<CoupleContextValue | null>(null);

export function CoupleProvider({ children }: { readonly children: ReactNode }) {
  const { isConfigured, status: authStatus, user, sessionGeneration } = useAuth();
  const activeUserId = isConfigured && authStatus === 'authenticated' ? (user?.id ?? null) : null;
  const activeScopeKey = activeUserId ? `${activeUserId}:${sessionGeneration}` : null;

  const [scopedState, setScopedState] = useState<CoupleState | null>(null);
  const trackerRef = useRef(createScopedRequestTracker());

  const loadForScope = useCallback(async (userId: string, scopeKey: string) => {
    const token = trackerRef.current.beginRequest(scopeKey);
    if (!token) {
      return;
    }

    setScopedState((prev) => ({
      scopeKey,
      status: 'loading',
      snapshot: prev?.scopeKey === scopeKey ? prev.snapshot : null,
      errorKey: null,
      generatedInvitation: prev?.scopeKey === scopeKey ? prev.generatedInvitation : null,
    }));

    const result = await fetchCoupleSnapshot(userId);
    if (!trackerRef.current.isCurrent(token)) {
      return;
    }

    if (result.ok) {
      setScopedState((prev) => applyLoadedSnapshotToState(prev, scopeKey, result.data));
    } else {
      setScopedState((prev) => ({
        scopeKey,
        status: 'error',
        snapshot: prev?.scopeKey === scopeKey ? prev.snapshot : null,
        errorKey: result.errorKey,
        generatedInvitation: prev?.scopeKey === scopeKey ? prev.generatedInvitation : null,
      }));
    }
  }, []);

  useEffect(() => {
    const tracker = trackerRef.current;
    tracker.setActiveScope(activeScopeKey);

    if (!activeUserId || !activeScopeKey) {
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

    const targetUserId = activeUserId;
    const targetScopeKey = activeScopeKey;

    void (async () => {
      const result = await fetchCoupleSnapshot(targetUserId);
      if (!tracker.isCurrent(token)) {
        return;
      }
      if (result.ok) {
        setScopedState((prev) => applyLoadedSnapshotToState(prev, targetScopeKey, result.data));
      } else {
        setScopedState((prev) => ({
          scopeKey: targetScopeKey,
          status: 'error',
          snapshot: prev?.scopeKey === targetScopeKey ? prev.snapshot : null,
          errorKey: result.errorKey,
          generatedInvitation: prev?.scopeKey === targetScopeKey ? prev.generatedInvitation : null,
        }));
      }
    })();

    return () => {
      tracker.setActiveScope(null);
      setScopedState(null);
    };
  }, [activeScopeKey, activeUserId]);

  const refresh = useCallback(async () => {
    if (!activeUserId || !activeScopeKey) {
      return;
    }
    await loadForScope(activeUserId, activeScopeKey);
  }, [activeScopeKey, activeUserId, loadForScope]);

  const createSpace = useCallback(
    async (title: string) => {
      const targetUserId = activeUserId;
      const targetScopeKey = activeScopeKey;
      const result = await createCoupleSpace(title);
      if (
        result.ok &&
        targetUserId &&
        targetScopeKey &&
        trackerRef.current.isActiveScope(targetScopeKey)
      ) {
        await loadForScope(targetUserId, targetScopeKey);
      }
      return result;
    },
    [activeScopeKey, activeUserId, loadForScope],
  );

  const createInvitation = useCallback(
    async (ttlHours = 24) => {
      const targetUserId = activeUserId;
      const targetScopeKey = activeScopeKey;
      const result = await createCoupleInvitation(ttlHours);
      if (
        result.ok &&
        targetUserId &&
        targetScopeKey &&
        trackerRef.current.isActiveScope(targetScopeKey)
      ) {
        setScopedState((prev) => ({
          scopeKey: targetScopeKey,
          status: prev?.scopeKey === targetScopeKey ? prev.status : 'loading',
          snapshot: prev?.scopeKey === targetScopeKey ? prev.snapshot : null,
          errorKey: null,
          generatedInvitation: result.data,
        }));
        await loadForScope(targetUserId, targetScopeKey);
      }
      return result;
    },
    [activeScopeKey, activeUserId, loadForScope],
  );

  const acceptInvitation = useCallback(
    async (token: string) => {
      const targetUserId = activeUserId;
      const targetScopeKey = activeScopeKey;
      const result = await acceptCoupleInvitation(token);
      if (
        result.ok &&
        targetUserId &&
        targetScopeKey &&
        trackerRef.current.isActiveScope(targetScopeKey)
      ) {
        setScopedState((prev) =>
          prev?.scopeKey === targetScopeKey ? { ...prev, generatedInvitation: null } : prev,
        );
        await loadForScope(targetUserId, targetScopeKey);
      }
      return result;
    },
    [activeScopeKey, activeUserId, loadForScope],
  );

  const revokeInvitation = useCallback(
    async (invitationId: string) => {
      const targetUserId = activeUserId;
      const targetScopeKey = activeScopeKey;
      const result = await revokeCoupleInvitation(invitationId);
      if (
        result.ok &&
        targetUserId &&
        targetScopeKey &&
        trackerRef.current.isActiveScope(targetScopeKey)
      ) {
        setScopedState((prev) =>
          prev?.scopeKey === targetScopeKey ? { ...prev, generatedInvitation: null } : prev,
        );
        await loadForScope(targetUserId, targetScopeKey);
      }
      return result;
    },
    [activeScopeKey, activeUserId, loadForScope],
  );

  const saveDisplayName = useCallback(
    async (displayName: string) => {
      const targetUserId = activeUserId;
      const targetScopeKey = activeScopeKey;
      if (!targetUserId || !targetScopeKey) {
        return { ok: false, errorKey: 'notAuthenticated' } as const;
      }
      const result = await updateOwnDisplayName(targetUserId, displayName);
      if (result.ok && trackerRef.current.isActiveScope(targetScopeKey)) {
        await loadForScope(targetUserId, targetScopeKey);
      }
      return result;
    },
    [activeScopeKey, activeUserId, loadForScope],
  );

  const clearGeneratedInvitation = useCallback(() => {
    setScopedState((prev) => (prev ? { ...prev, generatedInvitation: null } : null));
  }, []);

  const value = useMemo<CoupleContextValue>(() => {
    if (!activeScopeKey) {
      return {
        status: 'idle',
        snapshot: null,
        errorKey: null,
        generatedInvitation: null,
        refresh,
        createSpace,
        createInvitation,
        acceptInvitation,
        revokeInvitation,
        saveDisplayName,
        clearGeneratedInvitation,
      };
    }

    const matchesScope = scopedState?.scopeKey === activeScopeKey;
    return {
      status: matchesScope ? scopedState.status : 'loading',
      snapshot: matchesScope ? scopedState.snapshot : null,
      errorKey: matchesScope ? scopedState.errorKey : null,
      generatedInvitation: matchesScope ? scopedState.generatedInvitation : null,
      refresh,
      createSpace,
      createInvitation,
      acceptInvitation,
      revokeInvitation,
      saveDisplayName,
      clearGeneratedInvitation,
    };
  }, [
    acceptInvitation,
    activeScopeKey,
    clearGeneratedInvitation,
    createInvitation,
    createSpace,
    refresh,
    revokeInvitation,
    saveDisplayName,
    scopedState,
  ]);

  return <CoupleContext.Provider value={value}>{children}</CoupleContext.Provider>;
}

export function useCouple(): CoupleContextValue {
  const context = useContext(CoupleContext);
  if (!context) {
    throw new Error('useCouple must be used within a CoupleProvider');
  }
  return context;
}
