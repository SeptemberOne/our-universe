/**
 * Live Supabase Storage API DELETE authorization test.
 *
 * Verifies runtime Storage DELETE permissions for:
 *   1. An unrelated outsider (User C) -> blocked / 0 objects removed
 *   2. A member of another couple (User D) -> blocked / 0 objects removed
 *   3. A legitimate couple member (User B, partner of uploader User A) -> succeeds
 *
 * Requires environment variables (supplied in your shell, never committed):
 *   SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL)
 *   SUPABASE_ANON_KEY (or EXPO_PUBLIC_SUPABASE_ANON_KEY)
 *   SUPABASE_SERVICE_ROLE_KEY (used strictly for ephemeral test user creation/cleanup)
 */

import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

import { isForbiddenServiceRoleKey } from '../src/lib/supabase/config.ts';

const SYNTHETIC_1X1_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

function requireEnv(primary, fallback) {
  const value = (process.env[primary] ?? (fallback ? process.env[fallback] : undefined) ?? '').trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${primary}${fallback ? ` (or ${fallback})` : ''}`);
  }
  return value;
}

function createUnprivilegedClient(url, anonKey) {
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function createAndSignInTestUser(adminClient, url, anonKey, label) {
  const email = `our-universe-storage-test-${label}-${crypto.randomUUID()}@example.test`;
  const password = `Test!${crypto.randomBytes(20).toString('hex')}`;

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { preferred_language: 'en' },
  });
  if (createError || !created.user) {
    throw new Error(`Failed to create test user (${label}): ${createError?.message ?? 'unknown error'}`);
  }

  const client = createUnprivilegedClient(url, anonKey);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) {
    throw new Error(`Failed to sign in test user (${label}): ${signInError.message}`);
  }

  return { userId: created.user.id, client };
}

async function main() {
  const url = requireEnv('SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_URL');
  const anonKey = requireEnv('SUPABASE_ANON_KEY', 'EXPO_PUBLIC_SUPABASE_ANON_KEY');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (isForbiddenServiceRoleKey(anonKey)) {
    throw new Error('SUPABASE_ANON_KEY must be an unprivileged anon/publishable key, not a service_role key.');
  }

  const adminClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const createdUserIds = [];
  let clientA = null;
  let uploadedPath = null;
  let deletedViaApi = false;

  try {
    const userA = await createAndSignInTestUser(adminClient, url, anonKey, 'user-a');
    createdUserIds.push(userA.userId);
    clientA = userA.client;

    const userB = await createAndSignInTestUser(adminClient, url, anonKey, 'user-b');
    createdUserIds.push(userB.userId);

    const userC = await createAndSignInTestUser(adminClient, url, anonKey, 'user-c');
    createdUserIds.push(userC.userId);

    const userD = await createAndSignInTestUser(adminClient, url, anonKey, 'user-d');
    createdUserIds.push(userD.userId);

    // 1. User A creates couple_1 and invites User B; User D creates couple_2.
    const { data: couple1Id, error: couple1Err } = await clientA.rpc('create_couple_space', {
      p_title: 'Storage Delete Verification 1',
    });
    assert.equal(couple1Err, null, `create_couple_space failed: ${couple1Err?.message}`);
    assert.ok(couple1Id, 'Expected couple_1 UUID');

    const { data: inviteRows, error: inviteErr } = await clientA.rpc('create_couple_invitation', {
      p_ttl_hours: 1,
    });
    assert.equal(inviteErr, null, `create_couple_invitation failed: ${inviteErr?.message}`);
    const inviteToken = inviteRows?.[0]?.invite_token;
    assert.ok(inviteToken, 'Expected invite_token');

    const { data: joinedCoupleId, error: joinErr } = await userB.client.rpc('accept_couple_invitation', {
      p_invite_token: inviteToken,
    });
    assert.equal(joinErr, null, `accept_couple_invitation failed: ${joinErr?.message}`);
    assert.equal(joinedCoupleId, couple1Id);

    const { data: couple2Id, error: couple2Err } = await userD.client.rpc('create_couple_space', {
      p_title: 'Storage Delete Verification 2',
    });
    assert.equal(couple2Err, null, `couple_2 creation failed: ${couple2Err?.message}`);
    assert.ok(couple2Id && couple2Id !== couple1Id);

    // 2. User A uploads synthetic 1x1 PNG into couple_1 folder via Storage API.
    const fileName = `storage-delete-verification-${crypto.randomUUID()}.png`;
    const photoPath = `${couple1Id}/${fileName}`;
    const { error: uploadErr } = await clientA.storage
      .from('couple-photos')
      .upload(photoPath, SYNTHETIC_1X1_PNG, {
        contentType: 'image/png',
        upsert: false,
      });
    assert.equal(uploadErr, null, `Storage upload failed: ${uploadErr?.message}`);
    uploadedPath = photoPath;

    // Confirm legitimate partner User B can download the uploaded photo.
    const { data: partnerDownload, error: partnerDownloadErr } = await userB.client.storage
      .from('couple-photos')
      .download(photoPath);
    assert.equal(partnerDownloadErr, null, `Partner download failed: ${partnerDownloadErr?.message}`);
    assert.ok(partnerDownload, 'Expected partner download blob');

    // 3. Unrelated outsider (User C) must NOT be able to delete couple_1 photo.
    const outsiderRemove = await userC.client.storage.from('couple-photos').remove([photoPath]);
    const outsiderRemovedCount = Array.isArray(outsiderRemove.data) ? outsiderRemove.data.length : 0;
    assert.equal(outsiderRemovedCount, 0, 'Outsider User C must not delete couple_1 photo');

    const afterOutsiderCheck = await clientA.storage.from('couple-photos').download(photoPath);
    assert.equal(afterOutsiderCheck.error, null, 'Photo must still exist after outsider DELETE attempt');

    // 4. Member of another couple (User D) must NOT be able to delete couple_1 photo.
    const crossCoupleRemove = await userD.client.storage.from('couple-photos').remove([photoPath]);
    const crossCoupleRemovedCount = Array.isArray(crossCoupleRemove.data) ? crossCoupleRemove.data.length : 0;
    assert.equal(crossCoupleRemovedCount, 0, 'Other-couple member User D must not delete couple_1 photo');

    const afterCrossCoupleCheck = await clientA.storage.from('couple-photos').download(photoPath);
    assert.equal(afterCrossCoupleCheck.error, null, 'Photo must still exist after cross-couple DELETE attempt');

    // 5. Legitimate couple member (User B) CAN delete couple_1 photo via Storage API.
    const memberRemove = await userB.client.storage.from('couple-photos').remove([photoPath]);
    assert.equal(memberRemove.error, null, `Legitimate partner delete failed: ${memberRemove.error?.message}`);
    assert.ok(
      Array.isArray(memberRemove.data) && memberRemove.data.length === 1,
      `Expected partner User B to remove 1 object, got ${JSON.stringify(memberRemove.data)}`,
    );
    deletedViaApi = true;

    const { data: listedFiles, error: listErr } = await clientA.storage
      .from('couple-photos')
      .list(couple1Id, { limit: 100, search: fileName });
    assert.equal(listErr, null, `Post-delete folder list failed: ${listErr?.message}`);
    assert.ok(Array.isArray(listedFiles), 'Expected folder list array after Storage DELETE');
    assert.equal(
      listedFiles.some((entry) => entry.name === fileName),
      false,
      `Expected ${fileName} to be absent from couple_1 folder after Storage DELETE`,
    );

    console.log('STORAGE API DELETE AUTHORIZATION CHECKS PASSED');
  } finally {
    if (clientA && uploadedPath && !deletedViaApi) {
      await clientA.storage.from('couple-photos').remove([uploadedPath]).catch(() => undefined);
    }

    for (const userId of createdUserIds) {
      await adminClient.auth.admin.deleteUser(userId).catch(() => undefined);
    }
  }
}

await main();
