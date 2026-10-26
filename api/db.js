import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be configured before initializing Neon.');
}

export const sql = neon(process.env.DATABASE_URL);
