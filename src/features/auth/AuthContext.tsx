import type { Session, User } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import type { PreferredLanguage } from '@/features/couple/types';
import { getSupabaseClient, getSupabaseConfigStatus, type SupabaseConfigResult } from '@/lib/supabase';
import {
  getInitialSession,
  signInWithPassword,
  signOut as signOutService,
  signUpWithPassword,
  subscribeToAuthChanges,
  type AuthServiceResult,
  type SignUpOutcome,
} from './authService';
import type { AuthStatus } from './routeGuard';

interface AuthContextValue {
  readonly status: AuthStatus;
  readonly session: Session | null;
  readonly user: User | null;
  readonly configStatus: SupabaseConfigResult;
  readonly isConfigured: boolean;
  readonly signIn: (email: string, password: string) => Promise<AuthServiceResult<Session>>;
  readonly signUp: (params: {
    email: string;
    password: string;
    displayName: string;
    preferredLanguage: PreferredLanguage;
  }) => Promise<AuthServiceResult<SignUpOutcome>>;
  readonly signOut: () => Promise<AuthServiceResult<null>>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { readonly children: ReactNode }) {
  const configStatus = useMemo(() => getSupabaseConfigStatus(), []);
  const isConfigured = configStatus.isConfigured;

  const [status, setStatus] = useState<AuthStatus>(() =>
    isConfigured ? 'loading' : 'unauthenticated',
  );
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!isConfigured) {
      return;
    }

    let isMounted = true;

    async function hydrate() {
      const result = await getInitialSession();
      if (!isMounted) {
        return;
      }

      if (result.ok && result.data) {
        setSession(result.data);
        setStatus('authenticated');
      } else {
        setSession(null);
        setStatus('unauthenticated');
      }
    }

    void hydrate();

    const unsubscribe = subscribeToAuthChanges((nextSession) => {
      if (!isMounted) {
        return;
      }
      setSession(nextSession);
      setStatus(nextSession ? 'authenticated' : 'unauthenticated');
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [isConfigured]);

  useEffect(() => {
    if (!isConfigured || Platform.OS === 'web') {
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      return;
    }

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        void client.auth.startAutoRefresh();
      } else {
        void client.auth.stopAutoRefresh();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [isConfigured]);

  const signIn = useCallback(
    (email: string, password: string) => signInWithPassword({ email, password }),
    [],
  );

  const signUp = useCallback(
    (params: {
      email: string;
      password: string;
      displayName: string;
      preferredLanguage: PreferredLanguage;
    }) => signUpWithPassword(params),
    [],
  );

  const signOut = useCallback(async () => {
    const result = await signOutService();
    if (result.ok) {
      setSession(null);
      setStatus('unauthenticated');
    }
    return result;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      configStatus,
      isConfigured,
      signIn,
      signUp,
      signOut,
    }),
    [configStatus, isConfigured, session, signIn, signOut, signUp, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
