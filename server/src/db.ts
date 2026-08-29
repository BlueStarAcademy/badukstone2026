import { Pool, type QueryResultRow } from 'pg';
import { config } from './config';

export const pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: config.databaseUrl && (config.databaseUrl.includes('railway') || process.env.PGSSLMODE === 'require')
        ? { rejectUnauthorized: false }
        : undefined,
});

export interface DbUser {
    id: string;
    email: string;
    password_hash: string;
    role: 'master' | 'admin';
    status: 'active' | 'disabled';
    created_at: Date;
    updated_at: Date;
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) {
    return pool.query<T>(text, params);
}
