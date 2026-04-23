import { Pool } from 'pg';
import 'dotenv/config';

const isLocal = process.env.DATABASE_URL?.includes('localhost') || process.env.DATABASE_URL?.includes('127.0.0.1');

export const pool = new Pool({
  connectionString: isLocal
    ? process.env.DATABASE_URL
    : process.env.DATABASE_URL?.replace('sslmode=require', 'sslmode=verify-full'),
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err);
});
