export type SupabaseConfigErrorReason =
  | 'missing'
  | 'placeholder'
  | 'invalid-url'
  | 'forbidden-service-role-key';

export type SupabaseConfigResult =
  | {
      readonly isConfigured: true;
      readonly url: string;
      readonly anonKey: string;
    }
  | {
      readonly isConfigured: false;
      readonly reason: SupabaseConfigErrorReason;
    };

export type EnvRecord = Readonly<Record<string, string | undefined>>;

function decodeBase64Url(segment: string): string | null {
  try {
    const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + '='.repeat(padLength);

    if (typeof globalThis.atob === 'function') {
      return globalThis.atob(padded);
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Reject Supabase service-role / secret keys in mobile client config.
 * Only public anon / publishable keys are permitted in Expo client builds.
 */
export function isForbiddenServiceRoleKey(key: string): boolean {
  const trimmed = key.trim();
  if (!trimmed) {
    return false;
  }

  if (trimmed.toLowerCase().startsWith('sb_secret_')) {
    return true;
  }

  const segments = trimmed.split('.');
  if (segments.length !== 3) {
    return false;
  }

  const payloadSegment = segments[1];
  if (!payloadSegment) {
    return false;
  }

  const decoded = decodeBase64Url(payloadSegment);
  if (!decoded) {
    return false;
  }

  try {
    const parsed: unknown = JSON.parse(decoded);
    if (typeof parsed === 'object' && parsed !== null && 'role' in parsed) {
      return (parsed as { readonly role?: unknown }).role === 'service_role';
    }
  } catch {
    return false;
  }

  return false;
}

function isAllowedSupabaseUrl(rawUrl: string): URL | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'https:') {
      return parsed;
    }

    const isLocalhost =
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '::1' ||
      parsed.hostname === '[::1]';

    if (parsed.protocol === 'http:' && isLocalhost) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

function getDefaultEnv(): EnvRecord {
  if (typeof process !== 'undefined' && process.env) {
    return process.env;
  }
  return {};
}

export function readSupabaseConfig(env: EnvRecord = getDefaultEnv()): SupabaseConfigResult {
  const url = (env['EXPO_PUBLIC_SUPABASE_URL'] ?? '').trim();
  const anonKey = (env['EXPO_PUBLIC_SUPABASE_ANON_KEY'] ?? '').trim();

  if (!url || !anonKey) {
    return { isConfigured: false, reason: 'missing' };
  }

  if (
    url.includes('your-project-ref') ||
    anonKey.includes('your-supabase-anon-key') ||
    anonKey === 'your-anon-key'
  ) {
    return { isConfigured: false, reason: 'placeholder' };
  }

  const parsedUrl = isAllowedSupabaseUrl(url);
  if (!parsedUrl) {
    return { isConfigured: false, reason: 'invalid-url' };
  }

  if (isForbiddenServiceRoleKey(anonKey)) {
    return { isConfigured: false, reason: 'forbidden-service-role-key' };
  }

  return {
    isConfigured: true,
    url: parsedUrl.toString().replace(/\/+$/, ''),
    anonKey,
  };
}
