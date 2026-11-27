import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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

interface ScopedCoupleState {
  readonly userId: string;
  readonly status: CoupleLoadStatus;
  readonly snapshot: CoupleSnapshot | null;
  readonly errorKey: CoupleErrorKey | null;
  readonly generatedInvitation: GeneratedInvitation | null;
}

const CoupleContext = createContext<CoupleContextValue | null>(null);

export function CoupleProvider({ children }: { readonly children: ReactNode }) {
  const { isConfigured, status: authStatus, user } = useAuth();
  const activeUserId = isConfigured && authStatus === 'authenticated' ? (user?.id ?? null) : null;

  const [scopedState, setScopedState] = useState<ScopedCoupleState | null>(null);

  const loadForUser = useCallback(async (userId: string) => {
    setScopedState((prev) => ({
      userId,
      status: 'loading',
      snapshot: prev?.userId === userId ? prev.snapshot : null,
      errorKey: null,
      generatedInvitation: prev?.userId === userId ? prev.generatedInvitation : null,
    }));

    const result = await fetchCoupleSnapshot(userId);
    if (result.ok) {
      setScopedState((prev) => ({
        userId,
        status: 'loaded',
        snapshot: result.data,
        errorKey: null,
        generatedInvitation: prev?.userId === userId ? prev.generatedInvitation : null,
      }));
    } else {
      setScopedState((prev) => ({
        userId,
        status: 'error',
        snapshot: prev?.userId === userId ? prev.snapshot : null,
        errorKey: result.errorKey,
        generatedInvitation: prev?.userId === userId ? prev.generatedInvitation : null,
      }));
    }
  }, []);

  useEffect(() => {
    if (!activeUserId) {
      return;
    }

    let isActive = true;
    const targetUserId = activeUserId;

    void (async () => {
      const result = await fetchCoupleSnapshot(targetUserId);
      if (!isActive) {
        return;
      }
      if (result.ok) {
        setScopedState((prev) => ({
          userId: targetUserId,
          status: 'loaded',
          snapshot: result.data,
          errorKey: null,
          generatedInvitation: prev?.userId === targetUserId ? prev.generatedInvitation : null,
        }));
      } else {
        setScopedState((prev) => ({
          userId: targetUserId,
          status: 'error',
          snapshot: prev?.userId === targetUserId ? prev.snapshot : null,
          errorKey: result.errorKey,
          generatedInvitation: prev?.userId === targetUserId ? prev.generatedInvitation : null,
        }));
      }
    })();

    return () => {
      isActive = false;
    };
  }, [activeUserId]);

  const refresh = useCallback(async () => {
    if (!activeUserId) {
      return;
    }
    await loadForUser(activeUserId);
  }, [activeUserId, loadForUser]);

  const createSpace = useCallback(
    async (title: string) => {
      const result = await createCoupleSpace(title);
      if (result.ok && activeUserId) {
        await loadForUser(activeUserId);
      }
      return result;
    },
    [activeUserId, loadForUser],
  );

  const createInvitation = useCallback(
    async (ttlHours = 24) => {
      const result = await createCoupleInvitation(ttlHours);
      if (result.ok && activeUserId) {
        setScopedState((prev) => ({
          userId: activeUserId,
          status: prev?.userId === activeUserId ? prev.status : 'loading',
          snapshot: prev?.userId === activeUserId ? prev.snapshot : null,
          errorKey: null,
          generatedInvitation: result.data,
        }));
        await loadForUser(activeUserId);
      }
      return result;
    },
    [activeUserId, loadForUser],
  );

  const acceptInvitation = useCallback(
    async (token: string) => {
      const result = await acceptCoupleInvitation(token);
      if (result.ok && activeUserId) {
        setScopedState((prev) =>
          prev?.userId === activeUserId ? { ...prev, generatedInvitation: null } : prev,
        );
        await loadForUser(activeUserId);
      }
      return result;
    },
    [activeUserId, loadForUser],
  );

  const revokeInvitation = useCallback(
    async (invitationId: string) => {
      const result = await revokeCoupleInvitation(invitationId);
      if (result.ok && activeUserId) {
        setScopedState((prev) =>
          prev?.userId === activeUserId ? { ...prev, generatedInvitation: null } : prev,
        );
        await loadForUser(activeUserId);
      }
      return result;
    },
    [activeUserId, loadForUser],
  );

  const saveDisplayName = useCallback(
    async (displayName: string) => {
      if (!activeUserId) {
        return { ok: false, errorKey: 'notAuthenticated' } as const;
      }
      const result = await updateOwnDisplayName(activeUserId, displayName);
      if (result.ok) {
        await loadForUser(activeUserId);
      }
      return result;
    },
    [activeUserId, loadForUser],
  );

  const clearGeneratedInvitation = useCallback(() => {
    setScopedState((prev) => (prev ? { ...prev, generatedInvitation: null } : null));
  }, []);

  const value = useMemo<CoupleContextValue>(() => {
    if (!activeUserId) {
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

    const matchesActiveUser = scopedState?.userId === activeUserId;
    return {
      status: matchesActiveUser ? scopedState.status : 'loading',
      snapshot: matchesActiveUser ? scopedState.snapshot : null,
      errorKey: matchesActiveUser ? scopedState.errorKey : null,
      generatedInvitation: matchesActiveUser ? scopedState.generatedInvitation : null,
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
    activeUserId,
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
