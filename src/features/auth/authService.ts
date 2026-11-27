import type { Session } from '@supabase/supabase-js';

import type { PreferredLanguage } from '@/features/couple/types';
import { getSupabaseClient } from '@/lib/supabase';
import {
  executeSignUpWithClient,
  type SignUpFlowResult,
  type SignUpOutcome as GenericSignUpOutcome,
} from './signUpFlow';
import { mapAuthErrorToKey, type AuthErrorKey } from './validation';

export type AuthServiceResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly errorKey: AuthErrorKey };

export type SignUpOutcome = GenericSignUpOutcome<Session>;

function requireConfiguredClient() {
  return getSupabaseClient();
}

export async function getInitialSession(): Promise<AuthServiceResult<Session | null>> {
  const client = requireConfiguredClient();
  if (!client) {
    return { ok: true, data: null };
  }

  try {
    const { data, error } = await client.auth.getSession();
    if (error) {
      return { ok: false, errorKey: mapAuthErrorToKey(error.message) };
    }
    return { ok: true, data: data.session };
  } catch (error) {
    const message = error instanceof Error ? error.message : undefined;
    return { ok: false, errorKey: mapAuthErrorToKey(message) };
  }
}

export async function signInWithPassword(params: {
  email: string;
  password: string;
}): Promise<AuthServiceResult<Session>> {
  const client = requireConfiguredClient();
  if (!client) {
    return { ok: false, errorKey: 'notConfigured' };
  }

  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: params.email,
      password: params.password,
    });

    if (error || !data.session) {
      return { ok: false, errorKey: mapAuthErrorToKey(error?.message) };
    }

    return { ok: true, data: data.session };
  } catch (error) {
    const message = error instanceof Error ? error.message : undefined;
    return { ok: false, errorKey: mapAuthErrorToKey(message) };
  }
}

export async function signUpWithPassword(params: {
  email: string;
  password: string;
  displayName: string;
  preferredLanguage: PreferredLanguage;
}): Promise<SignUpFlowResult<Session>> {
  const client = requireConfiguredClient();
  if (!client) {
    return { ok: false, errorKey: 'notConfigured' };
  }

  return executeSignUpWithClient(
    {
      async signUp(input) {
        const { data, error } = await client.auth.signUp({
          email: input.email,
          password: input.password,
          options: {
            data: {
              preferred_language: input.preferredLanguage,
            },
          },
        });
        return {
          session: data.session,
          errorMessage: error?.message,
        };
      },
      async updateDisplayName(userId, displayName) {
        const { error } = await client
          .from('profiles')
          .update({ display_name: displayName })
          .eq('id', userId);
        return { errorMessage: error?.message };
      },
      mapError: mapAuthErrorToKey,
    },
    params,
  );
}

export async function signOut(): Promise<AuthServiceResult<null>> {
  const client = requireConfiguredClient();
  if (!client) {
    return { ok: true, data: null };
  }

  try {
    const { error } = await client.auth.signOut();
    if (error) {
      return { ok: false, errorKey: mapAuthErrorToKey(error.message) };
    }
    return { ok: true, data: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : undefined;
    return { ok: false, errorKey: mapAuthErrorToKey(message) };
  }
}

export function subscribeToAuthChanges(
  onSessionChange: (session: Session | null) => void,
): () => void {
  const client = requireConfiguredClient();
  if (!client) {
    return () => undefined;
  }

  const { data } = client.auth.onAuthStateChange((_event, session) => {
    onSessionChange(session);
  });

  return () => {
    data.subscription.unsubscribe();
  };
}
