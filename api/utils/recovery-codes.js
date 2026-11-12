import { createHash, randomBytes } from 'node:crypto';

export const RECOVERY_CODE_COUNT = 3;

export function generateRecoveryCodes() {
  return Array.from(
    { length: RECOVERY_CODE_COUNT },
    () => `UNH-${randomBytes(12).toString('hex').toUpperCase()}`,
  );
}

export function hashRecoveryCode(code) {
  return createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

export function generateTemporaryPassword() {
  return randomBytes(24).toString('base64url');
}
