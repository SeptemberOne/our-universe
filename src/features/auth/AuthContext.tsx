import type { Session, User } from '@supabase/supabase-js';
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
import {
  applyAuthStateChange,
  applyInitialSessionResult,
  applyRetryHydration,
  createInitialAuthState,
  type AuthHydrationState,
} from './authState';
import type { AuthStatus } from './routeGuard';
import type { AuthErrorKey } from './validation';

interface AuthContextValue {
  readonly status: AuthStatus;
  readonly session: Session | null;
  readonly user: User | null;
  readonly errorKey: AuthErrorKey | null;
  readonly sessionGeneration: number;
  readonly profileSetupWarningKey: AuthErrorKey | null;
  readonly configStatus: SupabaseConfigResult;
  readonly isConfigured: boolean;
  readonly retrySessionHydration: () => Promise<void>;
  readonly dismissProfileSetupWarning: () => void;
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

  const [authState, setAuthState] = useState<AuthHydrationState<Session>>(() =>
    createInitialAuthState<Session>(isConfigured),
  );
  const [profileSetupWarningKey, setProfileSetupWarningKey] = useState<AuthErrorKey | null>(null);

  const isMountedRef = useRef(true);
  const hydrationRunRef = useRef(0);

  const runHydration = useCallback(async () => {
    if (!isConfigured) {
      return;
    }

    hydrationRunRef.current += 1;
    const runId = hydrationRunRef.current;

    const result = await getInitialSession();
    if (!isMountedRef.current || hydrationRunRef.current !== runId) {
      return;
    }

    setAuthState((prev) => applyInitialSessionResult(prev, result));
  }, [isConfigured]);

  useEffect(() => {
    isMountedRef.current = true;
    if (!isConfigured) {
      return;
    }

    void runHydration();

    const unsubscribe = subscribeToAuthChanges((nextSession) => {
      if (!isMountedRef.current) {
        return;
      }
      setAuthState((prev) => applyAuthStateChange(prev, nextSession));
    });

    return () => {
      isMountedRef.current = false;
      unsubscribe();
    };
  }, [isConfigured, runHydration]);

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

  const retrySessionHydration = useCallback(async () => {
    if (!isConfigured) {
      return;
    }
    setAuthState((prev) => applyRetryHydration(prev));
    await runHydration();
  }, [isConfigured, runHydration]);

  const dismissProfileSetupWarning = useCallback(() => {
    setProfileSetupWarningKey(null);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await signInWithPassword({ email, password });
    if (result.ok && isMountedRef.current) {
      setProfileSetupWarningKey(null);
    }
    return result;
  }, []);

  const signUp = useCallback(
    async (params: {
      email: string;
      password: string;
      displayName: string;
      preferredLanguage: PreferredLanguage;
    }) => {
      const result = await signUpWithPassword(params);
      if (result.ok && isMountedRef.current) {
        if (result.data.status === 'signed-in-profile-update-failed') {
          setProfileSetupWarningKey(result.data.profileErrorKey);
        } else {
          setProfileSetupWarningKey(null);
        }
      }
      return result;
    },
    [],
  );

  const signOut = useCallback(async () => {
    const result = await signOutService();
    if (result.ok && isMountedRef.current) {
      setProfileSetupWarningKey(null);
      setAuthState((prev) => applyAuthStateChange(prev, null));
    }
    return result;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status: authState.status,
      session: authState.session,
      user: authState.session?.user ?? null,
      errorKey: authState.errorKey,
      sessionGeneration: authState.sessionGeneration,
      profileSetupWarningKey,
      configStatus,
      isConfigured,
      retrySessionHydration,
      dismissProfileSetupWarning,
      signIn,
      signUp,
      signOut,
    }),
    [
      authState.errorKey,
      authState.session,
      authState.sessionGeneration,
      authState.status,
      configStatus,
      dismissProfileSetupWarning,
      isConfigured,
      profileSetupWarningKey,
      retrySessionHydration,
      signIn,
      signOut,
      signUp,
    ],
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
