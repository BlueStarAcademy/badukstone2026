import type { Response } from 'express';

type SseClient = {
    userId: string;
    res: Response;
};

const clients = new Set<SseClient>();

export function addSseClient(userId: string, res: Response) {
    const client: SseClient = { userId, res };
    clients.add(client);
    res.on('close', () => clients.delete(client));
    return client;
}

export function broadcastAppDataUpdate(userId: string, lastUpdatedAt: number) {
    const payload = JSON.stringify({ lastUpdatedAt });
    for (const client of clients) {
        if (client.userId !== userId) continue;
        client.res.write(`event: update\ndata: ${payload}\n\n`);
    }
}
