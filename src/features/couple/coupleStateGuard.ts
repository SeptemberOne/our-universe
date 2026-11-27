import type { CoupleLoadStatus } from '../auth/routeGuard';
import type { CoupleSnapshot } from './types';

export interface ScopedRequestToken {
  readonly scopeKey: string;
  readonly sequence: number;
}

export interface ScopedRequestTracker {
  readonly setActiveScope: (scopeKey: string | null) => void;
  readonly getActiveScope: () => string | null;
  readonly beginRequest: (scopeKey: string) => ScopedRequestToken | null;
  readonly isCurrent: (token: ScopedRequestToken | null) => boolean;
  readonly isActiveScope: (scopeKey: string | null) => boolean;
}

export function createScopedRequestTracker(): ScopedRequestTracker {
  let activeScopeKey: string | null = null;
  let sequence = 0;

  return {
    setActiveScope(scopeKey: string | null) {
      if (scopeKey !== activeScopeKey) {
        activeScopeKey = scopeKey;
        sequence += 1;
      }
    },
    getActiveScope() {
      return activeScopeKey;
    },
    beginRequest(scopeKey: string): ScopedRequestToken | null {
      if (!scopeKey || scopeKey !== activeScopeKey) {
        return null;
      }
      sequence += 1;
      return { scopeKey, sequence };
    },
    isCurrent(token: ScopedRequestToken | null): boolean {
      return token !== null && activeScopeKey === token.scopeKey && sequence === token.sequence;
    },
    isActiveScope(scopeKey: string | null): boolean {
      return scopeKey !== null && activeScopeKey === scopeKey;
    },
  };
}

export interface ScopedCoupleState<TInvitation, TErrorKey> {
  readonly scopeKey: string;
  readonly status: CoupleLoadStatus;
  readonly snapshot: CoupleSnapshot | null;
  readonly errorKey: TErrorKey | null;
  readonly generatedInvitation: TInvitation | null;
}

export function applyLoadedSnapshotToState<TInvitation, TErrorKey>(
  prev: ScopedCoupleState<TInvitation, TErrorKey> | null,
  scopeKey: string,
  snapshot: CoupleSnapshot,
): ScopedCoupleState<TInvitation, TErrorKey> {
  const preserveGeneratedToken = prev?.scopeKey === scopeKey && !snapshot.isCoupleFull;

  return {
    scopeKey,
    status: 'loaded',
    snapshot,
    errorKey: null,
    generatedInvitation: preserveGeneratedToken ? prev.generatedInvitation : null,
  };
}
