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
      EXPO_PUBLIC_SUPABASE_URL: '   ',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: '   ',
    }),
    {
      isConfigured: false,
      reason: 'missing',
    },
  );

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
      EXPO_PUBLIC_SUPABASE_URL: 'not-a-url',
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

  assert.deepEqual(
    readSupabaseConfig({
      EXPO_PUBLIC_SUPABASE_URL: 'http://localhost:54321/',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_local_test_key',
    }),
    {
      isConfigured: true,
      url: 'http://localhost:54321',
      anonKey: 'sb_publishable_local_test_key',
    },
  );
});

test('isForbiddenServiceRoleKey and readSupabaseConfig block service_role credentials', () => {
  const serviceRoleJwt = makeJwt({ role: 'service_role', iss: 'supabase' });
  const anonJwt = makeJwt({ role: 'anon', iss: 'supabase' });

  assert.equal(isForbiddenServiceRoleKey(serviceRoleJwt), true);
  assert.equal(isForbiddenServiceRoleKey('sb_secret_123456'), true);
  assert.equal(isForbiddenServiceRoleKey('SB_SECRET_UPPERCASE'), true);
  assert.equal(isForbiddenServiceRoleKey(anonJwt), false);
  assert.equal(isForbiddenServiceRoleKey('sb_publishable_123456'), false);
  assert.equal(isForbiddenServiceRoleKey('malformed.not-valid-json.sig'), false);

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

// Static SQL structure checks only — live PostgreSQL execution is still required via
// supabase/tests/rls_security_verification.sql against an actual Supabase Postgres instance.
test('static SQL structure checks: migrations & verification script define hardened RLS invariants', () => {
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

  // Zero-argument private helper; no parameterized public membership probing functions
  assert.match(schemaSql, /CREATE SCHEMA IF NOT EXISTS private;/);
  assert.match(schemaSql, /CREATE OR REPLACE FUNCTION private\.current_user_couple_id\(\)/);
  assert.equal(/CREATE OR REPLACE FUNCTION public\.(is_couple_member|shares_couple_with)/i.test(schemaSql), false);

  assert.match(schemaSql, /member_slot smallint NOT NULL CHECK \(member_slot IN \(1, 2\)\)/);
  assert.match(schemaSql, /CONSTRAINT couple_members_unique_slot UNIQUE \(couple_id, member_slot\)/);
  assert.match(schemaSql, /CONSTRAINT couple_members_one_couple_per_user UNIQUE \(user_id\)/);
  assert.match(schemaSql, /CREATE TRIGGER couple_members_enforce_max_two/);
  assert.match(schemaSql, /token_hash text NOT NULL UNIQUE/);
  assert.match(schemaSql, /SET search_path = ''/);
  assert.match(schemaSql, /FOR UPDATE/);

  assert.match(storageSql, /'couple-photos'/);
  assert.match(storageSql, /public = false/);
  assert.match(storageSql, /private\.try_parse_uuid/);
  assert.match(storageSql, /private\.current_user_couple_id\(\)/);

  // Verify role transitions are top-level SQL rather than EXECUTE inside DO blocks
  assert.equal(/EXECUTE\s+'(SET LOCAL ROLE|RESET ROLE)/i.test(rlsTestSql), false);
  assert.match(rlsTestSql, /^SET LOCAL ROLE authenticated;$/m);
  assert.match(rlsTestSql, /^RESET ROLE;$/m);
  assert.match(rlsTestSql, /BEGIN;/);
  assert.match(rlsTestSql, /ROLLBACK;/);
  assert.match(rlsTestSql, /couple_already_full/);
  assert.match(rlsTestSql, /invitation_not_usable/);
  assert.match(rlsTestSql, /invitation_expired/);
  assert.match(rlsTestSql, /INSERT INTO storage\.objects/);
  assert.match(rlsTestSql, /UPDATE storage\.objects/);
  // Direct SQL DELETE on storage.objects is forbidden by storage.protect_delete()
  assert.equal(/DELETE FROM storage\.objects/i.test(rlsTestSql), false);
  assert.match(rlsTestSql, /FROM pg_policies/i);
  assert.match(rlsTestSql, /couple_photos_delete_member/);

  const storageDeleteScript = fs.readFileSync(
    path.join(REPO_ROOT, 'scripts/verify-storage-delete.mjs'),
    'utf8',
  );
  assert.match(storageDeleteScript, /\.storage\.from\('couple-photos'\)\.remove\(/);
  assert.equal(/DELETE FROM storage\.objects/i.test(storageDeleteScript), false);

  // Verify coupleService never selects token_hash or performs direct membership/invitation writes
  const coupleService = fs.readFileSync(
    path.join(REPO_ROOT, 'src/features/couple/coupleService.ts'),
    'utf8',
  );
  assert.equal(/\.select\([^)]*token_hash/i.test(coupleService), false);
  assert.equal(/\.select\(\s*['"]\*['"]\s*\)/.test(coupleService), false);
  assert.equal(
    /\.from\(\s*['"]couple_(members|invitations)['"]\s*\)\s*\.\s*(insert|update|delete|upsert)\(/s.test(
      coupleService,
    ),
    false,
  );

  // Verify one-time invitation tokens are never persisted to AsyncStorage or localStorage
  for (const relPath of [
    'src/features/couple/CoupleContext.tsx',
    'src/features/couple/coupleService.ts',
    'src/app/couple.tsx',
  ]) {
    const src = fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
    assert.equal(/AsyncStorage|localStorage|sessionStorage/i.test(src), false);
  }
});
