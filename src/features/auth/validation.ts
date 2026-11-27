export type AuthMode = 'signIn' | 'signUp';

export type AuthValidationErrorKey =
  | 'invalidEmail'
  | 'passwordRequired'
  | 'passwordTooShort'
  | 'displayNameTooLong';

export type AuthErrorKey =
  | 'invalidCredentials'
  | 'emailNotConfirmed'
  | 'emailAlreadyRegistered'
  | 'weakPassword'
  | 'rateLimited'
  | 'networkError'
  | 'notConfigured'
  | 'unknown';

export interface AuthInput {
  readonly mode: AuthMode;
  readonly email: string;
  readonly password: string;
  readonly displayName?: string;
}

export type AuthValidationResult =
  | {
      readonly ok: true;
      readonly email: string;
      readonly password: string;
      readonly displayName: string;
    }
  | {
      readonly ok: false;
      readonly errorKey: AuthValidationErrorKey;
    };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_SIGNUP_PASSWORD_LENGTH = 8;
const MAX_DISPLAY_NAME_LENGTH = 80;

export function validateAuthInput(input: AuthInput): AuthValidationResult {
  const email = input.email.trim();
  if (!EMAIL_PATTERN.test(email)) {
    return { ok: false, errorKey: 'invalidEmail' };
  }

  if (input.mode === 'signIn') {
    if (input.password.length === 0) {
      return { ok: false, errorKey: 'passwordRequired' };
    }
  } else if (input.password.length < MIN_SIGNUP_PASSWORD_LENGTH) {
    return { ok: false, errorKey: 'passwordTooShort' };
  }

  const displayName = (input.displayName ?? '').trim();
  if (displayName.length > MAX_DISPLAY_NAME_LENGTH) {
    return { ok: false, errorKey: 'displayNameTooLong' };
  }

  return {
    ok: true,
    email,
    password: input.password,
    displayName,
  };
}

export function mapAuthErrorToKey(message: string | undefined): AuthErrorKey {
  const normalized = (message ?? '').trim().toLowerCase();
  if (!normalized) {
    return 'unknown';
  }

  if (normalized.includes('invalid login credentials')) {
    return 'invalidCredentials';
  }
  if (normalized.includes('email not confirmed')) {
    return 'emailNotConfirmed';
  }
  if (normalized.includes('already registered') || normalized.includes('already exists')) {
    return 'emailAlreadyRegistered';
  }
  if (normalized.includes('password') && (normalized.includes('weak') || normalized.includes('at least'))) {
    return 'weakPassword';
  }
  if (normalized.includes('rate limit') || normalized.includes('too many requests')) {
    return 'rateLimited';
  }
  if (
    normalized.includes('network') ||
    normalized.includes('fetch') ||
    normalized.includes('timeout') ||
    normalized.includes('failed to fetch')
  ) {
    return 'networkError';
  }
  if (normalized.includes('not_configured')) {
    return 'notConfigured';
  }

  return 'unknown';
}
