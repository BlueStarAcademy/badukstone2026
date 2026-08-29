import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { pool } from './db';
import { runMigrations } from './migrate';
import authRoutes from './routes/auth';
import appDataRoutes from './routes/appData';
import masterRoutes from './routes/master';

const app = express();

app.use(cors({
    origin: config.corsOrigins,
    credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/app-data', appDataRoutes);
app.use('/api/master', masterRoutes);

async function start() {
    if (!config.databaseUrl) {
        console.error('DATABASE_URL is not set');
        process.exit(1);
    }
    await runMigrations();
    await pool.query('SELECT 1');
    app.listen(config.port, () => {
        console.log(`BadukStone API listening on port ${config.port}`);
        console.log(`CORS origins: ${config.corsOrigins.join(', ')}`);
    });
}

start().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
