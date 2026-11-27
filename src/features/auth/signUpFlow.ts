import type { PreferredLanguage } from '../couple/types';
import type { AuthErrorKey } from './validation';

export interface SignUpSessionLike {
  readonly user: {
    readonly id: string;
  };
}

export type SignUpOutcome<TSession extends SignUpSessionLike> =
  | { readonly status: 'signed-in'; readonly session: TSession }
  | {
      readonly status: 'signed-in-profile-update-failed';
      readonly session: TSession;
      readonly profileErrorKey: AuthErrorKey;
    }
  | { readonly status: 'confirmation-required' };

export type SignUpFlowResult<TSession extends SignUpSessionLike> =
  | { readonly ok: true; readonly data: SignUpOutcome<TSession> }
  | { readonly ok: false; readonly errorKey: AuthErrorKey };

export interface SignUpClientAdapter<TSession extends SignUpSessionLike> {
  readonly signUp: (input: {
    readonly email: string;
    readonly password: string;
    readonly preferredLanguage: PreferredLanguage;
  }) => Promise<{
    readonly session: TSession | null;
    readonly errorMessage?: string;
  }>;
  readonly updateDisplayName: (
    userId: string,
    displayName: string,
  ) => Promise<{ readonly errorMessage?: string }>;
  readonly mapError: (message: string | undefined) => AuthErrorKey;
}

export async function executeSignUpWithClient<TSession extends SignUpSessionLike>(
  adapter: SignUpClientAdapter<TSession>,
  params: {
    readonly email: string;
    readonly password: string;
    readonly displayName: string;
    readonly preferredLanguage: PreferredLanguage;
  },
): Promise<SignUpFlowResult<TSession>> {
  try {
    const signUpRes = await adapter.signUp({
      email: params.email,
      password: params.password,
      preferredLanguage: params.preferredLanguage,
    });

    if (signUpRes.errorMessage) {
      return { ok: false, errorKey: adapter.mapError(signUpRes.errorMessage) };
    }

    if (!signUpRes.session) {
      return { ok: true, data: { status: 'confirmation-required' } };
    }

    const trimmedName = params.displayName.trim();
    if (trimmedName.length > 0) {
      try {
        const profileRes = await adapter.updateDisplayName(signUpRes.session.user.id, trimmedName);
        if (profileRes.errorMessage) {
          return {
            ok: true,
            data: {
              status: 'signed-in-profile-update-failed',
              session: signUpRes.session,
              profileErrorKey: adapter.mapError(profileRes.errorMessage),
            },
          };
        }
      } catch (profileError) {
        const message = profileError instanceof Error ? profileError.message : undefined;
        return {
          ok: true,
          data: {
            status: 'signed-in-profile-update-failed',
            session: signUpRes.session,
            profileErrorKey: adapter.mapError(message),
          },
        };
      }
    }

    return { ok: true, data: { status: 'signed-in', session: signUpRes.session } };
  } catch (error) {
    const message = error instanceof Error ? error.message : undefined;
    return { ok: false, errorKey: adapter.mapError(message) };
  }
}
