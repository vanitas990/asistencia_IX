import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';

import {
  createAccessToken,
  createRefreshToken,
  generateAuthUserId,
  generateCodigo6,
  hashPassword,
  verifyAccessToken,
  verifyPassword,
  verifyRefreshToken,
} from '../utils/auth.js';

process.env.JWT_SECRET = 'test-secret-with-at-least-32-characters-long';

test('hashes passwords and verifies the original password', async () => {
  const passwordHash = await hashPassword('secure-pass-123');

  assert.notEqual(passwordHash, 'secure-pass-123');
  assert.equal(await verifyPassword('secure-pass-123', passwordHash), true);
  assert.equal(await verifyPassword('wrong-password', passwordHash), false);
});

test('generates UUIDs and six-digit numeric codes', () => {
  assert.match(generateAuthUserId(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.match(generateCodigo6(), /^\d{6}$/);
});

test('signs access tokens with the expected identity claims and lifetime', () => {
  const authUserId = generateAuthUserId();
  const token = createAccessToken({
    auth_user_id: authUserId,
    codigo_6: '123456',
    rol: 'practicante',
  });
  const decoded = jwt.verify(token, process.env.JWT_SECRET, {
    algorithms: ['HS256'],
    audience: 'asistencia-ix-mobile',
    issuer: 'asistencia-ix-api',
  });

  assert.equal(decoded.sub, authUserId);
  assert.equal(decoded.codigo_6, '123456');
  assert.equal(decoded.rol, 'practicante');
  assert.equal(decoded.token_type, 'access');
  assert.equal(decoded.exp - decoded.iat, 60 * 60);
  assert.equal(verifyAccessToken(token).sub, authUserId);
});

test('creates 30-day refresh tokens and rejects access tokens as refresh tokens', () => {
  const profile = {
    auth_user_id: generateAuthUserId(),
    codigo_6: '123456',
    rol: 'practicante',
  };
  const refreshToken = createRefreshToken(profile);
  const refreshClaims = verifyRefreshToken(refreshToken);
  const accessToken = createAccessToken(profile);

  assert.equal(refreshClaims.sub, profile.auth_user_id);
  assert.equal(refreshClaims.token_type, 'refresh');
  assert.equal(refreshClaims.exp - refreshClaims.iat, 30 * 24 * 60 * 60);
  assert.equal(verifyRefreshToken(accessToken), null);
  assert.equal(verifyAccessToken(refreshToken), null);
  assert.equal(verifyAccessToken('not-a-jwt'), null);
  assert.equal(verifyRefreshToken('not-a-jwt'), null);

  const expiredToken = jwt.sign(
    { token_type: 'refresh' },
    process.env.JWT_SECRET,
    {
      algorithm: 'HS256',
      audience: 'asistencia-ix-mobile-refresh',
      expiresIn: -1,
      issuer: 'asistencia-ix-api',
      subject: profile.auth_user_id,
    },
  );
  assert.equal(verifyRefreshToken(expiredToken), null);
});
