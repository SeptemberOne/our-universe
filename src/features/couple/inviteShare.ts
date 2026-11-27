/**
 * Result of attempting to share or copy a couple invitation token.
 */
export type ShareInviteOutcome =
  | { readonly status: 'shared' }
  | { readonly status: 'copied' }
  | { readonly status: 'cancelled' }
  | { readonly status: 'failed' };

/**
 * Minimal structural return type compatible with React Native `Share.share`.
 */
export interface NativeShareResult {
  readonly action?: string;
}

/**
 * Function signature compatible with React Native `Share.share`.
 */
export type NativeShareFn = (content: {
  readonly title: string;
  readonly message: string;
}) => Promise<NativeShareResult | void>;

/**
 * Payload passed to the Web Share API (`navigator.share`).
 */
export interface WebSharePayload {
  readonly title?: string;
  readonly text?: string;
}

/**
 * Minimal browser `Navigator` interface for sharing and clipboard copying.
 */
export interface WebNavigatorLike {
  readonly share?: (data: WebSharePayload) => Promise<void>;
  readonly canShare?: (data: WebSharePayload) => boolean;
  readonly clipboard?: {
    readonly writeText?: (text: string) => Promise<void>;
  };
}

/**
 * Minimal `<textarea>` shape used for synchronous `execCommand('copy')` fallback.
 */
export interface WebTextareaLike {
  value: string;
  readOnly: boolean;
  style: Record<string, string>;
  setAttribute?: (name: string, value: string) => void;
  focus?: () => void;
  select: () => void;
  setSelectionRange?: (start: number, end: number) => void;
  readonly parentNode?: {
    readonly removeChild: (node: WebTextareaLike) => void;
  } | null;
}

/**
 * Minimal browser `Document` interface for the legacy clipboard fallback.
 */
export interface WebDocumentLike {
  readonly createElement?: (tagName: string) => WebTextareaLike;
  readonly body?: {
    readonly appendChild: (node: WebTextareaLike) => void;
    readonly removeChild: (node: WebTextareaLike) => void;
  } | null;
  readonly execCommand?: (commandId: string) => boolean;
}

/**
 * Inputs for cross-platform couple invitation sharing.
 */
export interface ShareInvitationTokenOptions {
  readonly platformOS: string;
  readonly title: string;
  readonly message: string;
  readonly token: string;
  readonly nativeShare?: NativeShareFn;
  readonly webNavigator?: WebNavigatorLike | null;
  readonly webDocument?: WebDocumentLike | null;
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError'
  );
}

function copyTokenWithDocumentFallback(
  token: string,
  webDocument: WebDocumentLike | null | undefined,
): boolean {
  if (
    !webDocument ||
    typeof webDocument.createElement !== 'function' ||
    !webDocument.body ||
    typeof webDocument.execCommand !== 'function'
  ) {
    return false;
  }

  let textarea: WebTextareaLike | null = null;
  try {
    textarea = webDocument.createElement('textarea');
    textarea.value = token;
    textarea.readOnly = true;
    textarea.setAttribute?.('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';

    webDocument.body.appendChild(textarea);
    textarea.focus?.();
    textarea.select();
    textarea.setSelectionRange?.(0, token.length);

    return Boolean(webDocument.execCommand('copy'));
  } catch {
    return false;
  } finally {
    if (textarea) {
      textarea.value = '';
      const parent = textarea.parentNode ?? webDocument.body;
      try {
        parent.removeChild(textarea);
      } catch {
        // Ignore cleanup failure if element was already detached.
      }
    }
  }
}

/**
 * Share the one-time invitation token via native share sheet on mobile or
 * Web Share / Clipboard fallback on web.
 */
export async function shareInvitationToken(
  options: ShareInvitationTokenOptions,
): Promise<ShareInviteOutcome> {
  const { platformOS, title, message, token, nativeShare, webNavigator, webDocument } = options;

  if (platformOS !== 'web') {
    if (!nativeShare) {
      return { status: 'failed' };
    }
    try {
      const result = await nativeShare({ title, message });
      if (result && result.action === 'dismissedAction') {
        return { status: 'cancelled' };
      }
      return { status: 'shared' };
    } catch {
      return { status: 'failed' };
    }
  }

  // Prefer the Web Share API when supported so mobile web browsers can open the OS share sheet.
  if (typeof webNavigator?.share === 'function') {
    const shareData: WebSharePayload = { title, text: message };
    let canUseWebShare = true;
    if (typeof webNavigator.canShare === 'function') {
      try {
        canUseWebShare = webNavigator.canShare(shareData);
      } catch {
        canUseWebShare = false;
      }
    }

    if (canUseWebShare) {
      try {
        await webNavigator.share(shareData);
        return { status: 'shared' };
      } catch (error) {
        // Treat explicit user cancellation as cancelled rather than overwriting clipboard.
        if (isAbortError(error)) {
          return { status: 'cancelled' };
        }
      }
    }
  }

  // Fallback: copy the exact token via Clipboard API so partners can paste it directly.
  if (typeof webNavigator?.clipboard?.writeText === 'function') {
    try {
      await webNavigator.clipboard.writeText(token);
      return { status: 'copied' };
    } catch {
      // Fall through to legacy DOM copy when Clipboard API is blocked or unavailable.
    }
  }

  if (copyTokenWithDocumentFallback(token, webDocument)) {
    return { status: 'copied' };
  }

  return { status: 'failed' };
}
