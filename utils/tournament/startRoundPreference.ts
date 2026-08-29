const STORAGE_KEY = 'badukstone.tournament.startRound';

type StartRoundMode = 'bracket' | 'doubleelim' | 'hybridFinal';

function readAll(): Partial<Record<StartRoundMode, number | null>> {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

export function loadStartRoundPreference(mode: StartRoundMode): number | null {
    const value = readAll()[mode];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function saveStartRoundPreference(mode: StartRoundMode, size: number | null): void {
    try {
        const next = { ...readAll(), [mode]: size };
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
        // ignore quota / private mode
    }
}
