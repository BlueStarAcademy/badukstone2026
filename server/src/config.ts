import dotenv from 'dotenv';

dotenv.config();

export const config = {
    port: parseInt(process.env.PORT || '3001', 10),
    databaseUrl: process.env.DATABASE_URL || '',
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    masterEmail: process.env.MASTER_EMAIL || 'bsbaduk',
    masterPassword: process.env.MASTER_PASSWORD || '230123',
    cookieSecure: process.env.NODE_ENV === 'production',
};
