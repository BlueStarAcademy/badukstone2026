export function compactData<T extends Record<string, unknown>>(data: T): T {
    const MAX_TX = 800;
    const MAX_CHESS = 400;
    const KEEP_MONTHS = 2;

    const compact = { ...data } as T & {
        transactions?: Array<{ timestamp?: string }>;
        chessMatches?: Array<{ timestamp?: string }>;
    };

    if (Array.isArray(compact.transactions) && compact.transactions.length > MAX_TX) {
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - KEEP_MONTHS);
        const cutoffTime = cutoff.getTime();
        const recent: typeof compact.transactions = [];
        const older: typeof compact.transactions = [];
        for (const t of compact.transactions) {
            const ts = new Date(t.timestamp || 0).getTime();
            if (ts >= cutoffTime) recent.push(t);
            else older.push(t);
        }
        const keepFromOlder = Math.max(0, MAX_TX - recent.length);
        compact.transactions = [...recent, ...older.slice(0, keepFromOlder)];
    }

    if (Array.isArray(compact.chessMatches) && compact.chessMatches.length > MAX_CHESS) {
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - KEEP_MONTHS);
        const cutoffTime = cutoff.getTime();
        const recent: typeof compact.chessMatches = [];
        const older: typeof compact.chessMatches = [];
        for (const m of compact.chessMatches) {
            const ts = new Date(m.timestamp || 0).getTime();
            if (ts >= cutoffTime) recent.push(m);
            else older.push(m);
        }
        const keepFromOlder = Math.max(0, MAX_CHESS - recent.length);
        compact.chessMatches = [...recent, ...older.slice(0, keepFromOlder)];
    }

    return compact as T;
}
