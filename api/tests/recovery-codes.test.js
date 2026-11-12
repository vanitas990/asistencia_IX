import assert from 'node:assert/strict';
import test from 'node:test';

import {
  generateRecoveryCodes,
  generateTemporaryPassword,
  hashRecoveryCode,
} from '../utils/recovery-codes.js';

test('generates three unique recovery codes with high-entropy format', () => {
  const codes = generateRecoveryCodes();

  assert.equal(codes.length, 3);
  assert.equal(new Set(codes).size, 3);
  for (const code of codes) {
    assert.match(code, /^UNH-[A-F0-9]{24}$/);
  }
});

test('hashes recovery codes case-insensitively without storing plaintext', () => {
  const [code] = generateRecoveryCodes();
  const hash = hashRecoveryCode(code);

  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.notEqual(hash, code);
  assert.equal(hashRecoveryCode(code.toLowerCase()), hash);
});

test('generates a random temporary password', () => {
  const password = generateTemporaryPassword();

  assert.equal(password.length, 32);
  assert.match(password, /^[A-Za-z0-9_-]+$/);
});
