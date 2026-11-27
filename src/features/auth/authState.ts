import type { AuthStatus } from './routeGuard';
import type { AuthErrorKey } from './validation';

export interface SessionUserLike {
  readonly user: {
    readonly id: string;
  };
}

export interface AuthHydrationState<TSession extends SessionUserLike> {
  readonly status: AuthStatus;
  readonly session: TSession | null;
  readonly errorKey: AuthErrorKey | null;
  readonly hasLiveAuthEvent: boolean;
  readonly sessionGeneration: number;
}

export type InitialSessionOutcome<TSession> =
  | { readonly ok: true; readonly data: TSession | null }
  | { readonly ok: false; readonly errorKey: AuthErrorKey };

export function createInitialAuthState<TSession extends SessionUserLike>(
  isConfigured: boolean,
): AuthHydrationState<TSession> {
  return {
    status: isConfigured ? 'loading' : 'unauthenticated',
    session: null,
    errorKey: null,
    hasLiveAuthEvent: false,
    sessionGeneration: 0,
  };
}

export function applyInitialSessionResult<TSession extends SessionUserLike>(
  current: AuthHydrationState<TSession>,
  result: InitialSessionOutcome<TSession>,
): AuthHydrationState<TSession> {
  // Never let an older initial getSession() result overwrite a live onAuthStateChange event.
  if (current.hasLiveAuthEvent) {
    return current;
  }

  if (result.ok) {
    if (result.data) {
      const prevUserId = current.session?.user.id ?? null;
      const nextUserId = result.data.user.id;
      const shouldBump = current.status !== 'authenticated' || prevUserId !== nextUserId;
      return {
        status: 'authenticated',
        session: result.data,
        errorKey: null,
        hasLiveAuthEvent: false,
        sessionGeneration: shouldBump ? current.sessionGeneration + 1 : current.sessionGeneration,
      };
    }

    return {
      status: 'unauthenticated',
      session: null,
      errorKey: null,
      hasLiveAuthEvent: false,
      sessionGeneration: current.sessionGeneration,
    };
  }

  // Failed hydration stays in a recoverable 'error' state instead of pretending the user is signed out.
  return {
    status: 'error',
    session: current.session,
    errorKey: result.errorKey,
    hasLiveAuthEvent: false,
    sessionGeneration: current.sessionGeneration,
  };
}

export function applyAuthStateChange<TSession extends SessionUserLike>(
  current: AuthHydrationState<TSession>,
  nextSession: TSession | null,
): AuthHydrationState<TSession> {
  const prevUserId = current.session?.user.id ?? null;
  const nextUserId = nextSession?.user.id ?? null;
  const shouldBump =
    prevUserId !== nextUserId ||
    (current.status !== 'authenticated' && nextSession !== null) ||
    (current.status === 'authenticated' && nextSession === null);

  return {
    status: nextSession ? 'authenticated' : 'unauthenticated',
    session: nextSession,
    errorKey: null,
    hasLiveAuthEvent: true,
    sessionGeneration: shouldBump ? current.sessionGeneration + 1 : current.sessionGeneration,
  };
}

export function applyRetryHydration<TSession extends SessionUserLike>(
  current: AuthHydrationState<TSession>,
): AuthHydrationState<TSession> {
  return {
    ...current,
    status: 'loading',
    errorKey: null,
    hasLiveAuthEvent: false,
  };
}
