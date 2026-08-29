import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_CORS_ORIGINS = [
    'http://localhost:5173',
    'https://badukstone.up.railway.app',
];

function parseCorsOrigins(): string[] {
    const fromEnv = (process.env.CORS_ORIGIN || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
    return [...new Set([...DEFAULT_CORS_ORIGINS, ...fromEnv])];
}

export const config = {
    port: parseInt(process.env.PORT || '3001', 10),
    databaseUrl: process.env.DATABASE_URL || '',
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    corsOrigins: parseCorsOrigins(),
    masterEmail: process.env.MASTER_EMAIL || 'bsbaduk',
    masterPassword: process.env.MASTER_PASSWORD || '230123',
    cookieSecure: process.env.NODE_ENV === 'production',
};
