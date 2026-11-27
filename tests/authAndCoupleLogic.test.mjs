import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyAuthStateChange,
  applyInitialSessionResult,
  applyRetryHydration,
  createInitialAuthState,
} from '../src/features/auth/authState.ts';
import { resolveProtectedRoute } from '../src/features/auth/routeGuard.ts';
import { executeSignUpWithClient } from '../src/features/auth/signUpFlow.ts';
import { mapAuthErrorToKey, validateAuthInput } from '../src/features/auth/validation.ts';
import {
  assembleCoupleSnapshot,
  mapCoupleRpcErrorToKey,
  validateCoupleTitle,
  validateDisplayName,
  validateInviteToken,
} from '../src/features/couple/coupleLogic.ts';
import {
  applyLoadedSnapshotToState,
  createScopedRequestTracker,
} from '../src/features/couple/coupleStateGuard.ts';

test('validateAuthInput validates email, password, and display name for signIn and signUp', () => {
  assert.deepEqual(
    validateAuthInput({
      mode: 'signIn',
      email: '  partner@example.com  ',
      password: '123',
    }),
    {
      ok: true,
      email: 'partner@example.com',
      password: '123',
      displayName: '',
    },
  );

  assert.deepEqual(
    validateAuthInput({
      mode: 'signIn',
      email: 'not-an-email',
      password: 'password123',
    }),
    { ok: false, errorKey: 'invalidEmail' },
  );

  assert.deepEqual(
    validateAuthInput({
      mode: 'signIn',
      email: 'user@example.com',
      password: '',
    }),
    { ok: false, errorKey: 'passwordRequired' },
  );

  assert.deepEqual(
    validateAuthInput({
      mode: 'signUp',
      email: 'user@example.com',
      password: 'short',
      displayName: 'Star',
    }),
    { ok: false, errorKey: 'passwordTooShort' },
  );

  assert.deepEqual(
    validateAuthInput({
      mode: 'signUp',
      email: 'user@example.com',
      password: 'strongpassword',
      displayName: 'x'.repeat(81),
    }),
    { ok: false, errorKey: 'displayNameTooLong' },
  );

  assert.deepEqual(
    validateAuthInput({
      mode: 'signUp',
      email: '  star@example.com ',
      password: 'strongpassword',
      displayName: '  Luna  ',
    }),
    {
      ok: true,
      email: 'star@example.com',
      password: 'strongpassword',
      displayName: 'Luna',
    },
  );
});

test('mapAuthErrorToKey maps common Supabase Auth error messages', () => {
  assert.equal(mapAuthErrorToKey('Invalid login credentials'), 'invalidCredentials');
  assert.equal(mapAuthErrorToKey('Email not confirmed'), 'emailNotConfirmed');
  assert.equal(mapAuthErrorToKey('User already registered'), 'emailAlreadyRegistered');
  assert.equal(mapAuthErrorToKey('Password should be at least 8 characters'), 'weakPassword');
  assert.equal(mapAuthErrorToKey('Email rate limit exceeded'), 'rateLimited');
  assert.equal(mapAuthErrorToKey('Failed to fetch'), 'networkError');
  assert.equal(mapAuthErrorToKey('something unexpected'), 'unknown');
});

test('resolveProtectedRoute enforces auth and couple-linking guards without breaking local mode', () => {
  // Unconfigured local prototype mode never blocks Home or Memory Match
  assert.equal(
    resolveProtectedRoute({
      isSupabaseConfigured: false,
      authStatus: 'unauthenticated',
      coupleStatus: 'idle',
      hasCouple: false,
      pathname: '/',
    }),
    null,
  );

  // Loading auth state waits before redirecting
  assert.equal(
    resolveProtectedRoute({
      isSupabaseConfigured: true,
      authStatus: 'loading',
      coupleStatus: 'idle',
      hasCouple: false,
      pathname: '/',
    }),
    null,
  );

  // Unauthenticated users are sent to /auth from protected routes
  assert.equal(
    resolveProtectedRoute({
      isSupabaseConfigured: true,
      authStatus: 'unauthenticated',
      coupleStatus: 'idle',
      hasCouple: false,
      pathname: '/',
    }),
    '/auth',
  );
  assert.equal(
    resolveProtectedRoute({
      isSupabaseConfigured: true,
      authStatus: 'unauthenticated',
      coupleStatus: 'idle',
      hasCouple: false,
      pathname: '/auth',
    }),
    null,
  );

  // Authenticated user with no couple is routed to /couple
  assert.equal(
    resolveProtectedRoute({
      isSupabaseConfigured: true,
      authStatus: 'authenticated',
      coupleStatus: 'loaded',
      hasCouple: false,
      pathname: '/auth',
    }),
    '/couple',
  );
  assert.equal(
    resolveProtectedRoute({
      isSupabaseConfigured: true,
      authStatus: 'authenticated',
      coupleStatus: 'loaded',
      hasCouple: false,
      pathname: '/play/memory-match',
    }),
    '/couple',
  );
  assert.equal(
    resolveProtectedRoute({
      isSupabaseConfigured: true,
      authStatus: 'authenticated',
      coupleStatus: 'loaded',
      hasCouple: false,
      pathname: '/couple',
    }),
    null,
  );

  // Authenticated user with a couple leaves /auth for / and can access app screens
  assert.equal(
    resolveProtectedRoute({
      isSupabaseConfigured: true,
      authStatus: 'authenticated',
      coupleStatus: 'loaded',
      hasCouple: true,
      pathname: '/auth',
    }),
    '/',
  );
  assert.equal(
    resolveProtectedRoute({
      isSupabaseConfigured: true,
      authStatus: 'authenticated',
      coupleStatus: 'loaded',
      hasCouple: true,
      pathname: '/play/memory-match',
    }),
    null,
  );
});

test('couple validation helpers handle defaults, trimming, and length bounds', () => {
  assert.deepEqual(validateCoupleTitle('   '), { ok: true, title: 'Our Universe' });
  assert.deepEqual(validateCoupleTitle('  Starlight  '), { ok: true, title: 'Starlight' });
  assert.deepEqual(validateCoupleTitle('a'.repeat(81)), { ok: false, errorKey: 'titleTooLong' });

  assert.deepEqual(validateInviteToken('   '), { ok: false, errorKey: 'inviteTokenRequired' });
  assert.deepEqual(validateInviteToken('  abc123  '), { ok: true, token: 'abc123' });

  assert.deepEqual(validateDisplayName('  Nova  '), { ok: true, displayName: 'Nova' });
  assert.deepEqual(validateDisplayName('a'.repeat(81)), {
    ok: false,
    errorKey: 'displayNameTooLong',
  });
});

test('assembleCoupleSnapshot sorts members, pairs profiles, and filters expired invitations', () => {
  const nowMs = Date.parse('2026-11-27T12:00:00.000Z');

  const emptySnapshot = assembleCoupleSnapshot({
    userId: 'user-a',
    couple: null,
    members: [],
    profiles: [{ id: 'user-a', displayName: 'Alice', preferredLanguage: 'en' }],
    invitations: [],
    nowMs,
  });
  assert.equal(emptySnapshot.couple, null);
  assert.equal(emptySnapshot.myProfile?.displayName, 'Alice');
  assert.equal(emptySnapshot.isCoupleFull, false);
  assert.equal(emptySnapshot.isCreator, false);

  const snapshot = assembleCoupleSnapshot({
    userId: 'user-b',
    couple: {
      id: 'couple-1',
      title: 'Moonlight',
      createdBy: 'user-a',
      createdAt: '2026-11-27T00:00:00.000Z',
    },
    members: [
      {
        coupleId: 'couple-1',
        userId: 'user-b',
        memberSlot: 2,
        role: 'partner',
        joinedAt: '2026-11-27T01:00:00.000Z',
      },
      {
        coupleId: 'couple-1',
        userId: 'user-a',
        memberSlot: 1,
        role: 'creator',
        joinedAt: '2026-11-27T00:00:00.000Z',
      },
    ],
    profiles: [
      { id: 'user-a', displayName: 'Alice', preferredLanguage: 'en' },
      { id: 'user-b', displayName: '林星', preferredLanguage: 'zh-CN' },
    ],
    invitations: [
      {
        id: 'inv-expired',
        coupleId: 'couple-1',
        invitedBy: 'user-a',
        status: 'pending',
        expiresAt: '2026-11-27T11:59:59.000Z',
        createdAt: '2026-11-26T11:59:59.000Z',
      },
      {
        id: 'inv-active',
        coupleId: 'couple-1',
        invitedBy: 'user-a',
        status: 'pending',
        expiresAt: '2026-11-28T12:00:00.000Z',
        createdAt: '2026-11-27T11:00:00.000Z',
      },
    ],
    nowMs,
  });

  assert.equal(snapshot.members.length, 2);
  assert.equal(snapshot.members[0]?.memberSlot, 1);
  assert.equal(snapshot.members[0]?.profile?.displayName, 'Alice');
  assert.equal(snapshot.members[1]?.memberSlot, 2);
  assert.equal(snapshot.members[1]?.profile?.displayName, '林星');
  assert.equal(snapshot.isCoupleFull, true);
  assert.equal(snapshot.isCreator, false);
  assert.equal(snapshot.activeInvitation?.id, 'inv-active');
});

test('mapCoupleRpcErrorToKey maps all PostgreSQL RPC error codes accurately', () => {
  assert.equal(mapCoupleRpcErrorToKey('not_authenticated'), 'notAuthenticated');
  assert.equal(mapCoupleRpcErrorToKey('already_in_couple'), 'alreadyInCouple');
  assert.equal(mapCoupleRpcErrorToKey('invalid_couple_title'), 'invalidCoupleTitle');
  assert.equal(mapCoupleRpcErrorToKey('couple_not_found'), 'coupleNotFound');
  assert.equal(mapCoupleRpcErrorToKey('couple_already_full'), 'coupleFull');
  assert.equal(mapCoupleRpcErrorToKey('couple_full'), 'coupleFull');
  assert.equal(mapCoupleRpcErrorToKey('invalid_invitation'), 'invalidInvitation');
  assert.equal(mapCoupleRpcErrorToKey('invitation_not_usable'), 'invitationNotUsable');
  assert.equal(mapCoupleRpcErrorToKey('invitation_expired'), 'invitationExpired');
  assert.equal(mapCoupleRpcErrorToKey('cannot_accept_own_invitation'), 'cannotAcceptOwnInvitation');
  assert.equal(mapCoupleRpcErrorToKey('not_authorized'), 'notAuthorized');
  assert.equal(mapCoupleRpcErrorToKey('Failed to fetch'), 'networkError');
  assert.equal(mapCoupleRpcErrorToKey('unexpected'), 'unknown');
});

test('AuthContext hydration preserves error state instead of redirecting to /auth on failure', () => {
  const initial = createInitialAuthState(true);
  assert.equal(initial.status, 'loading');

  // Issue 1: failed getInitialSession() enters recoverable error state, not unauthenticated
  const failed = applyInitialSessionResult(initial, { ok: false, errorKey: 'networkError' });
  assert.equal(failed.status, 'error');
  assert.equal(failed.errorKey, 'networkError');
  assert.equal(failed.session, null);
  assert.equal(
    resolveProtectedRoute({
      isSupabaseConfigured: true,
      authStatus: failed.status,
      coupleStatus: 'idle',
      hasCouple: false,
      pathname: '/',
    }),
    null,
  );

  // Retrying resets to loading, then genuine empty session resolves to unauthenticated
  const retrying = applyRetryHydration(failed);
  assert.equal(retrying.status, 'loading');
  assert.equal(retrying.errorKey, null);

  const missingSession = applyInitialSessionResult(retrying, { ok: true, data: null });
  assert.equal(missingSession.status, 'unauthenticated');
  assert.equal(
    resolveProtectedRoute({
      isSupabaseConfigured: true,
      authStatus: missingSession.status,
      coupleStatus: 'idle',
      hasCouple: false,
      pathname: '/',
    }),
    '/auth',
  );

  // Live auth event overrides older failed hydration and never gets clobbered by stale getSession()
  const loadingAgain = createInitialAuthState(true);
  const liveSignedIn = applyAuthStateChange(loadingAgain, { user: { id: 'user-a' } });
  assert.equal(liveSignedIn.status, 'authenticated');
  assert.equal(liveSignedIn.sessionGeneration, 1);

  const afterStaleFail = applyInitialSessionResult(liveSignedIn, {
    ok: false,
    errorKey: 'networkError',
  });
  assert.equal(afterStaleFail.status, 'authenticated');
  assert.equal(afterStaleFail.session?.user.id, 'user-a');
});

test('CoupleContext request tracker and state scoping prevent cross-user races and clear tokens', () => {
  const tracker = createScopedRequestTracker();

  // User A session 1 starts an initial load and a refresh
  tracker.setActiveScope('user-a:1');
  const firstToken = tracker.beginRequest('user-a:1');
  const refreshToken = tracker.beginRequest('user-a:1');
  assert.equal(tracker.isCurrent(firstToken), false);
  assert.equal(tracker.isCurrent(refreshToken), true);

  // User signs out before refresh completes -> in-flight response must be ignored
  tracker.setActiveScope(null);
  assert.equal(tracker.isCurrent(refreshToken), false);
  assert.equal(tracker.isActiveScope('user-a:1'), false);

  // User B signs in while User A's request was in flight
  tracker.setActiveScope('user-b:2');
  const userBToken = tracker.beginRequest('user-b:2');
  assert.equal(tracker.isCurrent(refreshToken), false);
  assert.equal(tracker.isCurrent(userBToken), true);

  // Issue 3: one-time invitation token survives same-session waiting reload, clears on switch/full
  const waitingSnapshot = assembleCoupleSnapshot({
    userId: 'user-a',
    couple: { id: 'c1', title: 'Home', createdBy: 'user-a', createdAt: '2026-11-27T00:00:00Z' },
    members: [
      { coupleId: 'c1', userId: 'user-a', memberSlot: 1, role: 'creator', joinedAt: '2026-11-27T00:00:00Z' },
    ],
    profiles: [],
    invitations: [],
  });
  const withToken = {
    scopeKey: 'user-a:1',
    status: 'loaded',
    snapshot: waitingSnapshot,
    errorKey: null,
    generatedInvitation: {
      invitationId: 'inv-1',
      inviteToken: 'one-time-secret-token',
      expiresAt: '2026-11-28T00:00:00Z',
    },
  };

  // Same session reload while still 1/2 waiting preserves shareable token
  const reloadedSameSession = applyLoadedSnapshotToState(withToken, 'user-a:1', waitingSnapshot);
  assert.equal(reloadedSameSession.generatedInvitation?.inviteToken, 'one-time-secret-token');

  // Re-sign-in or user switch changes scopeKey -> token is cleared
  const newSessionState = applyLoadedSnapshotToState(withToken, 'user-a:2', waitingSnapshot);
  assert.equal(newSessionState.generatedInvitation, null);

  // Couple becoming 2/2 full clears the token immediately
  const fullSnapshot = assembleCoupleSnapshot({
    userId: 'user-a',
    couple: { id: 'c1', title: 'Home', createdBy: 'user-a', createdAt: '2026-11-27T00:00:00Z' },
    members: [
      { coupleId: 'c1', userId: 'user-a', memberSlot: 1, role: 'creator', joinedAt: '2026-11-27T00:00:00Z' },
      { coupleId: 'c1', userId: 'user-b', memberSlot: 2, role: 'partner', joinedAt: '2026-11-27T01:00:00Z' },
    ],
    profiles: [],
    invitations: [],
  });
  const afterPartnerJoined = applyLoadedSnapshotToState(withToken, 'user-a:1', fullSnapshot);
  assert.equal(afterPartnerJoined.generatedInvitation, null);
});

test('executeSignUpWithClient surfaces profile update errors without losing created Auth session', async () => {
  const session = { user: { id: 'user-new' } };

  // 1. Profile update returns Supabase error -> reports partial failure with session preserved
  const profileErrorResult = await executeSignUpWithClient(
    {
      signUp: async () => ({ session }),
      updateDisplayName: async () => ({ errorMessage: 'network timeout' }),
      mapError: mapAuthErrorToKey,
    },
    {
      email: 'new@example.com',
      password: 'password123',
      displayName: 'Luna',
      preferredLanguage: 'en',
    },
  );
  assert.deepEqual(profileErrorResult, {
    ok: true,
    data: {
      status: 'signed-in-profile-update-failed',
      session,
      profileErrorKey: 'networkError',
    },
  });

  // 2. Profile update throws -> caught safely and reported with session preserved
  const profileThrowResult = await executeSignUpWithClient(
    {
      signUp: async () => ({ session }),
      updateDisplayName: async () => {
        throw new Error('Failed to fetch');
      },
      mapError: mapAuthErrorToKey,
    },
    {
      email: 'new@example.com',
      password: 'password123',
      displayName: 'Luna',
      preferredLanguage: 'zh-CN',
    },
  );
  assert.deepEqual(profileThrowResult, {
    ok: true,
    data: {
      status: 'signed-in-profile-update-failed',
      session,
      profileErrorKey: 'networkError',
    },
  });

  // 3. Blank display name skips profile update and reports complete signed-in success
  let updateCalled = false;
  const blankNameResult = await executeSignUpWithClient(
    {
      signUp: async () => ({ session }),
      updateDisplayName: async () => {
        updateCalled = true;
        return {};
      },
      mapError: mapAuthErrorToKey,
    },
    {
      email: 'new@example.com',
      password: 'password123',
      displayName: '   ',
      preferredLanguage: 'en',
    },
  );
  assert.equal(updateCalled, false);
  assert.deepEqual(blankNameResult, {
    ok: true,
    data: { status: 'signed-in', session },
  });

  // 4. Email confirmation required does not attempt profile update
  const confirmResult = await executeSignUpWithClient(
    {
      signUp: async () => ({ session: null }),
      updateDisplayName: async () => {
        throw new Error('Should not run without session');
      },
      mapError: mapAuthErrorToKey,
    },
    {
      email: 'new@example.com',
      password: 'password123',
      displayName: 'Luna',
      preferredLanguage: 'en',
    },
  );
  assert.deepEqual(confirmResult, {
    ok: true,
    data: { status: 'confirmation-required' },
  });
});
