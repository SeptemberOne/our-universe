import assert from 'node:assert/strict';
import test from 'node:test';

import { createScopedRequestTracker } from '../src/features/couple/coupleStateGuard.ts';
import {
  buildPhotoStoragePath,
  filterListedPhotoObjects,
  formatFileSize,
  isPathScopedToCouple,
  mapPhotoErrorToKey,
  normalizePhotoMimeType,
  validatePhotoCandidate,
} from '../src/features/photos/photoLogic.ts';

const COUPLE_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_COUPLE_ID = '22222222-2222-4222-8222-222222222222';
const PHOTO_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TEN_MIB = 10 * 1024 * 1024;

test('normalizePhotoMimeType supports allowed MIME types, extension fallback, and rejects unsupported types', () => {
  assert.equal(normalizePhotoMimeType('image/jpeg'), 'image/jpeg');
  assert.equal(normalizePhotoMimeType('IMAGE/JPG; charset=utf-8'), 'image/jpeg');
  assert.equal(normalizePhotoMimeType('image/png'), 'image/png');
  assert.equal(normalizePhotoMimeType('image/webp'), 'image/webp');
  assert.equal(normalizePhotoMimeType('image/heic'), 'image/heic');
  assert.equal(normalizePhotoMimeType('image/heif'), 'image/heif');

  // Extension fallback when MIME is missing or generic octet-stream
  assert.equal(normalizePhotoMimeType(null, 'IMG_001.HEIC'), 'image/heic');
  assert.equal(normalizePhotoMimeType('application/octet-stream', 'sunset.jpeg'), 'image/jpeg');

  // Explicit unsupported MIME is rejected even if filename looks like an image
  assert.equal(normalizePhotoMimeType('image/gif', 'fake.jpg'), null);
  assert.equal(normalizePhotoMimeType('image/svg+xml', 'vector.svg'), null);
  assert.equal(normalizePhotoMimeType('video/mp4', 'clip.mp4'), null);
  assert.equal(normalizePhotoMimeType(null, 'notes.txt'), null);
});

test('validatePhotoCandidate enforces MIME allowlist and 10 MiB size boundaries', () => {
  assert.deepEqual(
    validatePhotoCandidate({
      mimeType: 'image/png',
      fileName: 'memory.png',
      fileSizeBytes: TEN_MIB,
    }),
    { ok: true, mimeType: 'image/png' },
  );

  assert.deepEqual(
    validatePhotoCandidate({
      mimeType: 'image/png',
      fileName: 'memory.png',
      fileSizeBytes: TEN_MIB + 1,
    }),
    { ok: false, errorKey: 'fileTooLarge' },
  );

  assert.deepEqual(
    validatePhotoCandidate({
      mimeType: 'image/jpeg',
      fileName: 'empty.jpg',
      fileSizeBytes: 0,
    }),
    { ok: false, errorKey: 'emptyFile' },
  );

  assert.deepEqual(
    validatePhotoCandidate({
      mimeType: 'image/gif',
      fileName: 'anim.gif',
      fileSizeBytes: 1024,
    }),
    { ok: false, errorKey: 'unsupportedFormat' },
  );
});

test('buildPhotoStoragePath and isPathScopedToCouple enforce <couple_id>/<photo_uuid>.<ext>', () => {
  const path = buildPhotoStoragePath({
    coupleId: COUPLE_ID.toUpperCase(),
    photoId: PHOTO_ID.toUpperCase(),
    mimeType: 'image/heic',
  });
  assert.equal(path, `${COUPLE_ID}/${PHOTO_ID}.heic`);
  assert.equal(isPathScopedToCouple(path, COUPLE_ID), true);

  assert.equal(
    buildPhotoStoragePath({ coupleId: 'not-a-uuid', photoId: PHOTO_ID, mimeType: 'image/jpeg' }),
    null,
  );
  assert.equal(
    buildPhotoStoragePath({ coupleId: COUPLE_ID, photoId: 'bad-id', mimeType: 'image/jpeg' }),
    null,
  );

  // Cross-couple, traversal, and nested paths are rejected
  assert.equal(isPathScopedToCouple(`${OTHER_COUPLE_ID}/${PHOTO_ID}.jpg`, COUPLE_ID), false);
  assert.equal(isPathScopedToCouple(`${COUPLE_ID}/../${PHOTO_ID}.jpg`, COUPLE_ID), false);
  assert.equal(isPathScopedToCouple(`${COUPLE_ID}/nested/${PHOTO_ID}.jpg`, COUPLE_ID), false);
  assert.equal(isPathScopedToCouple(`${COUPLE_ID}\\${PHOTO_ID}.jpg`, COUPLE_ID), false);
});

test('filterListedPhotoObjects skips placeholders/non-images and sorts newest-first', () => {
  const entries = [
    { id: null, name: 'subfolder', created_at: '2026-11-27T01:00:00Z', metadata: null },
    { id: '0', name: '.emptyFolderPlaceholder', created_at: '2026-11-27T01:00:00Z', metadata: {} },
    { id: '1', name: 'old-note.txt', created_at: '2026-11-27T02:00:00Z', metadata: { mimetype: 'text/plain' } },
    {
      id: '2',
      name: `${PHOTO_ID}.jpg`,
      created_at: '2026-11-27T01:00:00Z',
      metadata: { mimetype: 'image/jpeg', size: 2048 },
    },
    {
      id: '3',
      name: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png',
      created_at: '2026-11-27T03:00:00Z',
      metadata: { mimetype: 'image/png', size: 4096 },
    },
  ];

  const filtered = filterListedPhotoObjects(entries, COUPLE_ID);
  assert.equal(filtered.length, 2);
  assert.equal(filtered[0]?.name, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png');
  assert.equal(filtered[0]?.path, `${COUPLE_ID}/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png`);
  assert.equal(filtered[0]?.sizeBytes, 4096);
  assert.equal(filtered[1]?.name, `${PHOTO_ID}.jpg`);
});

test('mapPhotoErrorToKey and formatFileSize handle Storage errors and sizes cleanly', () => {
  assert.equal(mapPhotoErrorToKey('new row violates row-level security policy'), 'notAuthorized');
  assert.equal(mapPhotoErrorToKey('The object exceeded the maximum allowed size'), 'fileTooLarge');
  assert.equal(mapPhotoErrorToKey('Invalid mime type'), 'unsupportedFormat');
  assert.equal(mapPhotoErrorToKey('Object not found'), 'notFound');
  assert.equal(mapPhotoErrorToKey('Failed to fetch'), 'networkError');
  assert.equal(mapPhotoErrorToKey('unexpected'), 'unknown');

  assert.equal(formatFileSize(null), '');
  assert.equal(formatFileSize(512), '512 B');
  assert.equal(formatFileSize(15360), '15 KB');
  assert.equal(formatFileSize(2.5 * 1024 * 1024), '2.5 MB');
});

test('photo library request tracker discards stale signed-URL responses on sign-out or account switch', () => {
  const tracker = createScopedRequestTracker();

  tracker.setActiveScope(`user-a:1:${COUPLE_ID}`);
  const userAListToken = tracker.beginRequest(`user-a:1:${COUPLE_ID}`);
  assert.equal(tracker.isCurrent(userAListToken), true);

  // User A signs out while signed URLs are in flight
  tracker.setActiveScope(null);
  assert.equal(tracker.isCurrent(userAListToken), false);

  // User B signs in with a different couple -> User A's in-flight response cannot apply
  tracker.setActiveScope(`user-b:2:${OTHER_COUPLE_ID}`);
  const userBListToken = tracker.beginRequest(`user-b:2:${OTHER_COUPLE_ID}`);
  assert.equal(tracker.isCurrent(userAListToken), false);
  assert.equal(tracker.isCurrent(userBListToken), true);
});
