import type { Session } from '@supabase/supabase-js';

import type { PreferredLanguage } from '@/features/couple/types';
import { getSupabaseClient } from '@/lib/supabase';
import { mapAuthErrorToKey, type AuthErrorKey } from './validation';

export type AuthServiceResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly errorKey: AuthErrorKey };

export type SignUpOutcome =
  | { readonly status: 'signed-in'; readonly session: Session }
  | { readonly status: 'confirmation-required' };

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
}): Promise<AuthServiceResult<SignUpOutcome>> {
  const client = requireConfiguredClient();
  if (!client) {
    return { ok: false, errorKey: 'notConfigured' };
  }

  try {
    const { data, error } = await client.auth.signUp({
      email: params.email,
      password: params.password,
      options: {
        data: {
          preferred_language: params.preferredLanguage,
        },
      },
    });

    if (error) {
      return { ok: false, errorKey: mapAuthErrorToKey(error.message) };
    }

    if (!data.session) {
      return { ok: true, data: { status: 'confirmation-required' } };
    }

    if (params.displayName.trim().length > 0) {
      await client
        .from('profiles')
        .update({ display_name: params.displayName.trim() })
        .eq('id', data.session.user.id);
    }

    return { ok: true, data: { status: 'signed-in', session: data.session } };
  } catch (error) {
    const message = error instanceof Error ? error.message : undefined;
    return { ok: false, errorKey: mapAuthErrorToKey(message) };
  }
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
