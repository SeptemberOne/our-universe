# Our Universe — Supabase Foundation (Phase 2, Step 1)

This document describes the Supabase client configuration, PostgreSQL schema, two-member enforcement, Row Level Security (RLS) policies, private Storage design, and manual setup steps.

## 1. Mobile client & environment configuration

- Client module: [`src/lib/supabase/`](../src/lib/supabase/index.ts)
  - `config.ts`: reads `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`, rejects missing/placeholder/non-HTTPS URLs (allowing `http://localhost` / `http://127.0.0.1` for local CLI development), and explicitly blocks `sb_secret_` keys or JWTs whose payload has `"role": "service_role"`.
  - `storage.ts`: wraps `@react-native-async-storage/async-storage` with an SSR-safe guard for static web rendering.
  - `database.types.ts`: strict TypeScript `Database` types matching the SQL migrations.
  - `client.ts`: lazily initializes `SupabaseClient<Database>` via `getSupabaseClient()`, returning `null` while `.env` is unconfigured.
- Example env file: [`.env.example`](../.env.example) (placeholders only).
- Real `.env` files are ignored by [`.gitignore`](../.gitignore) and must **never** be committed. Never put a Supabase `service_role` or `sb_secret_` key in the mobile app.

## 2. Database schema (`supabase/migrations/20261127000100_initial_couple_schema.sql`)

| Table | Purpose | Key columns & constraints |
| --- | --- | --- |
| `public.profiles` | Per-user display name & preferred language (`en` / `zh-CN`) | `id` PK FK → `auth.users(id)` (`ON DELETE CASCADE`); auto-created via `on_auth_user_created` trigger |
| `public.couples` | Shared couple space | `id` UUID PK, `title` (1–80 chars), `created_by` FK → `auth.users(id)` |
| `public.couple_members` | Links up to 2 users to 1 couple | `PRIMARY KEY (couple_id, user_id)`, `member_slot IN (1, 2)`, `UNIQUE (couple_id, member_slot)`, `UNIQUE (user_id)`, slot↔role check, `BEFORE INSERT` trigger |
| `public.couple_invitations` | Single-use expiring invite for partner #2 | `token_hash` (SHA-256 hex, `UNIQUE`), `status` (`pending` / `accepted` / `revoked` / `expired`), max 7-day expiry, partial unique index for 1 pending invite per couple |

## 3. How the two-member restriction is enforced

The 2-account limit is enforced by **five independent PostgreSQL layers**, not in app UI code:

1. **Domain constraint (`CHECK`)**: `couple_members.member_slot` only permits values `1` (`'creator'`) or `2` (`'partner'`).
2. **Unique slot constraint**: `CONSTRAINT couple_members_unique_slot UNIQUE (couple_id, member_slot)` makes it mathematically impossible for a couple to hold more than 2 rows.
3. **One couple per account**: `CONSTRAINT couple_members_one_couple_per_user UNIQUE (user_id)` prevents a user from belonging to multiple couples simultaneously.
4. **Row-locking `BEFORE INSERT` trigger**: `enforce_max_two_couple_members()` locks the parent `public.couples` row (`FOR UPDATE`) and raises `couple_full` if `COUNT(*) >= 2`.
5. **Privilege & RPC isolation**: Direct `INSERT`, `UPDATE`, and `DELETE` privileges on `couple_members` and `couple_invitations` are **revoked** from `PUBLIC`, `anon`, and `authenticated`. Membership can only be created through two `SECURITY DEFINER` RPCs:
   - `create_couple_space(p_title)` — creates the couple and inserts the caller into `member_slot = 1`.
   - `accept_couple_invitation(p_invite_token)` — locks the invitation row (`FOR UPDATE`), verifies `status = 'pending'`, `expires_at > now()`, and `invited_by <> auth.uid()`, locks the couple row (`FOR UPDATE`), verifies the couple still has `< 2` members and the caller is not already in a couple, inserts the caller into `member_slot = 2`, and atomically marks the invitation `'accepted'` so it cannot be reused by a third account.

## 4. Row Level Security, private helpers, & privilege matrix

All tables have `ENABLE ROW LEVEL SECURITY` and `REVOKE ALL` from `PUBLIC` and `anon`.

To prevent authenticated users from probing arbitrary `couple_id` or `user_id` UUIDs via PostgREST RPC calls, RLS policies do **not** expose parameterized membership helpers in `public`. Instead, policies use a zero-argument `SECURITY DEFINER` helper `private.current_user_couple_id()` in the non-API-exposed `private` schema, which only ever looks up `auth.uid()`. Direct `EXECUTE` on trigger functions is also revoked from `PUBLIC`, `anon`, and `authenticated`.

| Table | `anon` | `authenticated` privileges | RLS access rule |
| --- | --- | --- | --- |
| `profiles` | None | `SELECT`, `UPDATE (display_name, preferred_language)` | Read self or user sharing `private.current_user_couple_id()`; update self only |
| `couples` | None | `SELECT`, `UPDATE (title)` | Read/update only if `id = private.current_user_couple_id()` |
| `couple_members` | None | `SELECT` only | Read only rows where `couple_id = private.current_user_couple_id()` |
| `couple_invitations` | None | `SELECT` (all columns **except** `token_hash`) | Read only invitations where `couple_id = private.current_user_couple_id()` |

`create_couple_invitation(p_ttl_hours)` generates a 32-byte random token via `extensions.gen_random_bytes(32)`, stores only its SHA-256 hex digest in `token_hash`, revokes/expires any prior pending invitation, and returns the plaintext token once to the creator.

## 5. Private Storage bucket (`supabase/migrations/20261127000200_private_couple_photos_storage.sql`)

- Bucket `couple-photos` is created/enforced with `public = false`, a 10 MiB per-file limit, and an image MIME allowlist (`image/jpeg`, `image/png`, `image/webp`, `image/heic`, `image/heif`).
- Objects follow the path convention `couple-photos/<couple_id>/<photo_uuid>.<ext>`.
- `storage.objects` policies allow `SELECT`, `INSERT` (`owner = auth.uid()`), `UPDATE`, and `DELETE` only for `authenticated` users where `private.try_parse_uuid((storage.foldername(name))[1]) = (SELECT private.current_user_couple_id())` and the path contains no `..` traversal segments.

## 6. Verification & manual Supabase setup

- **Automated JS tests (`tests/supabaseFoundation.test.mjs`)**: verify client config validation/guards and perform static structural checks on the SQL files. **Static JS checks do not execute SQL or prove live PostgreSQL security.**
- **SQL RLS verification test (`supabase/tests/rls_security_verification.sql`)**: runs inside `BEGIN ... ROLLBACK` with top-level `SET LOCAL ROLE authenticated;` / `RESET ROLE;` transitions and verifies two-member linking, unrelated user (`User C`) and cross-couple (`User D`) isolation across tables and all Storage CRUD verbs (`INSERT`, `SELECT`, `UPDATE`, `DELETE`), invitation single-use/revocation/expiry, two-member caps, and direct-write rejection.
- **Manual steps once you create your Supabase project**:
  1. Create a Supabase project in the Supabase Dashboard (or start local Supabase CLI).
  2. Apply both migrations in [`supabase/migrations/`](../supabase/migrations/) in order (`20261127000100_initial_couple_schema.sql`, then `20261127000200_private_couple_photos_storage.sql`).
  3. Execute [`supabase/tests/rls_security_verification.sql`](../supabase/tests/rls_security_verification.sql) against your live Supabase PostgreSQL database (`psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_security_verification.sql`) and confirm `ALL RLS & TWO-MEMBER SECURITY CHECKS PASSED`.
  4. Copy `.env.example` to `.env` locally and set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (public anon/publishable key only).
  5. Configure Supabase Auth providers/redirect URLs when implementing sign-in UI in Phase 2 — Step 2.
