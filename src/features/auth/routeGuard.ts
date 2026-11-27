export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';
export type CoupleLoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface RouteGuardInput {
  readonly isSupabaseConfigured: boolean;
  readonly authStatus: AuthStatus;
  readonly coupleStatus: CoupleLoadStatus;
  readonly hasCouple: boolean;
  readonly pathname: string;
}

export type GuardRedirectTarget = '/auth' | '/couple' | '/' | null;

export function resolveProtectedRoute(input: RouteGuardInput): GuardRedirectTarget {
  if (!input.isSupabaseConfigured || input.authStatus === 'loading') {
    return null;
  }

  if (input.authStatus === 'unauthenticated') {
    return input.pathname === '/auth' ? null : '/auth';
  }

  if (input.pathname === '/auth') {
    if (input.coupleStatus === 'loaded' && !input.hasCouple) {
      return '/couple';
    }
    return '/';
  }

  if (input.coupleStatus === 'loaded' && !input.hasCouple && input.pathname !== '/couple') {
    return '/couple';
  }

  return null;
}
