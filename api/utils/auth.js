import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { randomInt, randomUUID } from 'node:crypto';

const TOKEN_ISSUER = 'asistencia-ix-api';
const ACCESS_TOKEN_AUDIENCE = 'asistencia-ix-mobile';
const REFRESH_TOKEN_AUDIENCE = 'asistencia-ix-mobile-refresh';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters.');
  }
  return secret;
}

export function hashPassword(password) {
  return argon2.hash(password, { type: argon2.argon2id });
}

export function verifyPassword(password, passwordHash) {
  return argon2.verify(passwordHash, password);
}

export function createAccessToken(profile) {
  return jwt.sign(
    { rol: profile.rol, codigo_6: profile.codigo_6, token_type: 'access' },
    getJwtSecret(),
    {
      algorithm: 'HS256',
      audience: ACCESS_TOKEN_AUDIENCE,
      expiresIn: '1h',
      issuer: TOKEN_ISSUER,
      subject: profile.auth_user_id,
    },
  );
}

export function createRefreshToken(profile) {
  return jwt.sign(
    { token_type: 'refresh' },
    getJwtSecret(),
    {
      algorithm: 'HS256',
      audience: REFRESH_TOKEN_AUDIENCE,
      expiresIn: '30d',
      issuer: TOKEN_ISSUER,
      subject: profile.auth_user_id,
    },
  );
}

export function verifyRefreshToken(token) {
  try {
    const payload = jwt.verify(token, getJwtSecret(), {
      algorithms: ['HS256'],
      audience: REFRESH_TOKEN_AUDIENCE,
      issuer: TOKEN_ISSUER,
    });
    if (typeof payload !== 'object' || payload.token_type !== 'refresh') {
      return null;
    }
    return payload;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return null;
    }
    throw error;
  }
}

export function verifyAccessToken(token) {
  try {
    const payload = jwt.verify(token, getJwtSecret(), {
      algorithms: ['HS256'],
      audience: ACCESS_TOKEN_AUDIENCE,
      issuer: TOKEN_ISSUER,
    });
    if (typeof payload !== 'object' || payload.token_type !== 'access') {
      return null;
    }
    return payload;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return null;
    }
    throw error;
  }
}

export function generateCodigo6() {
  return randomInt(100000, 1000000).toString();
}

export function generateAuthUserId() {
  return randomUUID();
}
