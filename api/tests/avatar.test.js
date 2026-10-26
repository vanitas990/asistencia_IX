import assert from 'node:assert/strict';
import test from 'node:test';

import { validateAvatarImage } from '../utils/avatar.js';

test('accepts a valid JPEG data URL within the 1 MiB limit', () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
  const dataUrl = `data:image/jpeg;base64,${jpeg.toString('base64')}`;

  assert.equal(validateAvatarImage(dataUrl), null);
});

test('rejects content that does not match its declared image type', () => {
  const dataUrl = `data:image/jpeg;base64,${Buffer.from('not jpeg').toString('base64')}`;

  assert.deepEqual(validateAvatarImage(dataUrl), {
    status: 400,
    error: 'El contenido no coincide con el formato de imagen declarado.',
  });
});

test('rejects avatar images larger than 1 MiB', () => {
  const image = Buffer.alloc(1_048_577);
  image.set([0xff, 0xd8, 0xff]);
  const dataUrl = `data:image/jpeg;base64,${image.toString('base64')}`;

  assert.deepEqual(validateAvatarImage(dataUrl), {
    status: 413,
    error: 'La foto de perfil no puede superar 1 MB.',
  });
});

test('rejects malformed image data URLs', () => {
  assert.equal(validateAvatarImage('data:image/svg+xml;base64,PHN2Zz4=').status, 400);
});
