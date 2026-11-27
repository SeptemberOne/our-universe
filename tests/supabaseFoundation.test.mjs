import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  isForbiddenServiceRoleKey,
  readSupabaseConfig,
} from '../src/lib/supabase/config.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');

function makeJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.signature`;
}

test('readSupabaseConfig rejects missing or placeholder configuration', () => {
  assert.deepEqual(readSupabaseConfig({}), {
    isConfigured: false,
    reason: 'missing',
  });

  assert.deepEqual(
    readSupabaseConfig({
      EXPO_PUBLIC_SUPABASE_URL: 'https://your-project-ref.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'your-supabase-anon-key',
    }),
    {
      isConfigured: false,
      reason: 'placeholder',
    },
  );
});

test('readSupabaseConfig rejects invalid URLs and accepts valid HTTPS or localhost URLs', () => {
  const validAnonJwt = makeJwt({ role: 'anon', iss: 'supabase' });

  assert.deepEqual(
    readSupabaseConfig({
      EXPO_PUBLIC_SUPABASE_URL: 'http://example.com',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: validAnonJwt,
    }),
    {
      isConfigured: false,
      reason: 'invalid-url',
    },
  );

  assert.deepEqual(
    readSupabaseConfig({
      EXPO_PUBLIC_SUPABASE_URL: 'https://abc123.supabase.co/',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: `  ${validAnonJwt}  `,
    }),
    {
      isConfigured: true,
      url: 'https://abc123.supabase.co',
      anonKey: validAnonJwt,
    },
  );

  assert.deepEqual(
    readSupabaseConfig({
      EXPO_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_local_test_key',
    }),
    {
      isConfigured: true,
      url: 'http://127.0.0.1:54321',
      anonKey: 'sb_publishable_local_test_key',
    },
  );
});

test('isForbiddenServiceRoleKey and readSupabaseConfig block service_role credentials', () => {
  const serviceRoleJwt = makeJwt({ role: 'service_role', iss: 'supabase' });
  const anonJwt = makeJwt({ role: 'anon', iss: 'supabase' });

  assert.equal(isForbiddenServiceRoleKey(serviceRoleJwt), true);
  assert.equal(isForbiddenServiceRoleKey('sb_secret_123456'), true);
  assert.equal(isForbiddenServiceRoleKey(anonJwt), false);
  assert.equal(isForbiddenServiceRoleKey('sb_publishable_123456'), false);

  assert.deepEqual(
    readSupabaseConfig({
      EXPO_PUBLIC_SUPABASE_URL: 'https://abc123.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: serviceRoleJwt,
    }),
    {
      isConfigured: false,
      reason: 'forbidden-service-role-key',
    },
  );
});

test('.env.example uses safe placeholders and .gitignore ignores real .env files', () => {
  const envExample = fs.readFileSync(path.join(REPO_ROOT, '.env.example'), 'utf8');
  assert.match(envExample, /EXPO_PUBLIC_SUPABASE_URL=https:\/\/your-project-ref\.supabase\.co/);
  assert.match(envExample, /EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key/);
  assert.equal(/sb_secret_|service_role_key/i.test(envExample), false);

  const gitignore = fs.readFileSync(path.join(REPO_ROOT, '.gitignore'), 'utf8');
  assert.match(gitignore, /^\.env$/m);
  assert.match(gitignore, /^!\.env\.example$/m);
});

test('SQL migrations and RLS verification script enforce private two-member invariants', () => {
  const schemaSql = fs.readFileSync(
    path.join(REPO_ROOT, 'supabase/migrations/20261127000100_initial_couple_schema.sql'),
    'utf8',
  );
  const storageSql = fs.readFileSync(
    path.join(REPO_ROOT, 'supabase/migrations/20261127000200_private_couple_photos_storage.sql'),
    'utf8',
  );
  const rlsTestSql = fs.readFileSync(
    path.join(REPO_ROOT, 'supabase/tests/rls_security_verification.sql'),
    'utf8',
  );

  for (const table of ['profiles', 'couples', 'couple_members', 'couple_invitations']) {
    assert.match(schemaSql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY;`));
    assert.match(schemaSql, new RegExp(`REVOKE ALL ON TABLE public\\.${table} FROM PUBLIC, anon, authenticated;`));
  }

  assert.match(schemaSql, /member_slot smallint NOT NULL CHECK \(member_slot IN \(1, 2\)\)/);
  assert.match(schemaSql, /CONSTRAINT couple_members_unique_slot UNIQUE \(couple_id, member_slot\)/);
  assert.match(schemaSql, /CONSTRAINT couple_members_one_couple_per_user UNIQUE \(user_id\)/);
  assert.match(schemaSql, /CREATE TRIGGER couple_members_enforce_max_two/);
  assert.match(schemaSql, /token_hash text NOT NULL UNIQUE/);
  assert.match(schemaSql, /SET search_path = ''/);
  assert.match(schemaSql, /FOR UPDATE/);

  assert.match(storageSql, /'couple-photos'/);
  assert.match(storageSql, /public = false/);
  assert.match(storageSql, /is_couple_member/);

  assert.match(rlsTestSql, /BEGIN;/);
  assert.match(rlsTestSql, /ROLLBACK;/);
  assert.match(rlsTestSql, /couple_already_full/);
  assert.match(rlsTestSql, /invitation_not_usable/);
  assert.match(rlsTestSql, /invitation_expired/);
});
