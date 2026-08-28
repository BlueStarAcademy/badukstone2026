import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import type { DbUser } from '../db';

export interface AuthPayload {
    userId: string;
    email: string;
    role: 'master' | 'admin';
}

declare global {
    namespace Express {
        interface Request {
            user?: AuthPayload;
        }
    }
}

const COOKIE_NAME = 'badukstone_token';

export function signToken(payload: AuthPayload): string {
    return jwt.sign(payload, config.jwtSecret, { expiresIn: '7d' });
}

export function setAuthCookie(res: Response, token: string) {
    res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        secure: config.cookieSecure,
        sameSite: config.cookieSecure ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
}

export function clearAuthCookie(res: Response) {
    res.clearCookie(COOKIE_NAME);
}

export function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
    const token = req.cookies?.[COOKIE_NAME] || extractBearer(req.headers.authorization);
    if (!token) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    try {
        req.user = jwt.verify(token, config.jwtSecret) as AuthPayload;
        next();
    } catch {
        res.status(401).json({ error: 'Invalid token' });
    }
}

export function masterOnly(req: Request, res: Response, next: NextFunction) {
    if (req.user?.role !== 'master') {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }
    next();
}

export function adminOnly(req: Request, res: Response, next: NextFunction) {
    if (req.user?.role !== 'admin') {
        res.status(403).json({ error: 'Forbidden' });
        return;
    }
    next();
}

function extractBearer(header?: string): string | null {
    if (!header?.startsWith('Bearer ')) return null;
    return header.slice(7);
}

export function toAuthPayload(user: DbUser): AuthPayload {
    return { userId: user.id, email: user.email, role: user.role };
}
