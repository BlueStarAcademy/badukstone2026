import type { AppData, TournamentData } from '../../types';

type UnknownRecord = Record<string, unknown>;

const APP_ARRAY_KEYS = [
    'students',
    'missions',
    'chessMissions',
    'specialMissions',
    'shopItems',
    'transactions',
    'coupons',
    'shopCategories',
    'chessMatches',
    'individualMissionSeries',
    'personalMissionTemplates',
    'tournamentAwardLedger',
] as const;

const isRecord = (value: unknown): value is UnknownRecord =>
    value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Recursively fills newly introduced setting fields while retaining legacy and
 * unknown fields. Arrays are values, not mergeable records.
 */
const mergeSettingDefaults = (defaults: unknown, incoming: unknown): unknown => {
    if (!isRecord(defaults)) return incoming ?? defaults;
    if (!isRecord(incoming)) return { ...defaults };

    const merged: UnknownRecord = { ...incoming };
    for (const [key, defaultValue] of Object.entries(defaults)) {
        merged[key] = key in incoming
            ? mergeSettingDefaults(defaultValue, incoming[key])
            : defaultValue;
    }
    return merged;
};

const pushId = (ids: string[], value: unknown) => {
    if (typeof value === 'string' && value !== 'BYE' && !ids.includes(value)) ids.push(value);
};

const pushPlayer = (ids: string[], value: unknown) => {
    if (!isRecord(value)) return;
    pushId(ids, value.studentId);
    pushId(ids, value.playerId);
    pushId(ids, value.id);
};

const pushPlayers = (ids: string[], value: unknown) => {
    if (!Array.isArray(value)) return;
    value.forEach(player => {
        if (typeof player === 'string') pushId(ids, player);
        else pushPlayer(ids, player);
    });
};

const pushMatches = (ids: string[], value: unknown) => {
    if (!Array.isArray(value)) return;
    value.forEach(match => {
        if (!isRecord(match)) return;
        pushPlayers(ids, match.players);
        pushId(ids, match.player1Id);
        pushId(ids, match.player2Id);
    });
};

const pushRounds = (ids: string[], value: unknown) => {
    if (!Array.isArray(value)) return;
    value.forEach(round => {
        if (Array.isArray(round)) pushMatches(ids, round);
        else if (isRecord(round)) pushMatches(ids, round.matches);
    });
};

/**
 * Firestore cannot persist nested arrays, so the legacy client stored rounds as
 * `{ roundIndex, matches }[]` (and hybrid groups as `{ groupIndex, matches }[]`).
 * PostgreSQL can store the native nested arrays; normalize both representations.
 */
export const normalizeSwissRounds = (value: unknown): unknown[][] => {
    if (!Array.isArray(value)) return [];
    if (value.length === 0) return [];

    const looksLikeFlatMatchList = value.every(
        item => isRecord(item) && Array.isArray(item.players)
    );
    if (looksLikeFlatMatchList) return [value];

    return value
        .map(round => {
            if (Array.isArray(round)) return round;
            if (isRecord(round) && Array.isArray(round.matches)) return round.matches;
            return null;
        })
        .filter((round): round is unknown[] => round !== null);
};

const normalizeSwissData = (value: unknown): unknown => {
    if (!isRecord(value)) return value;
    const normalized: UnknownRecord = {
        ...value,
        rounds: normalizeSwissRounds(value.rounds),
    };
    if (Array.isArray(value.groups)) {
        normalized.groups = value.groups.map(group =>
            isRecord(group)
                ? { ...group, rounds: normalizeSwissRounds(group.rounds) }
                : group
        );
    }
    return normalized;
};

const normalizeHybridData = (value: unknown): unknown => {
    if (!isRecord(value)) return value;
    return {
        ...value,
        preliminaryGroups: normalizeSwissRounds(value.preliminaryGroups),
    };
};

const idsFromTeams = (value: unknown): string[] => {
    const ids: string[] = [];
    if (Array.isArray(value)) {
        value.forEach(team => {
            if (isRecord(team)) pushPlayers(ids, team.players);
        });
    }
    return ids;
};

const idsFromBracket = (value: unknown): string[] => {
    const ids: string[] = [];
    if (isRecord(value)) {
        pushPlayers(ids, value.players);
        pushRounds(ids, value.rounds);
    }
    return ids;
};

const idsFromSwiss = (value: unknown): string[] => {
    const ids: string[] = [];
    if (isRecord(value)) {
        pushPlayers(ids, value.players);
        pushRounds(ids, value.rounds);
        if (Array.isArray(value.groups)) {
            value.groups.forEach(group => {
                if (!isRecord(group)) return;
                pushPlayers(ids, group.players);
                pushRounds(ids, group.rounds);
            });
        }
    }
    return ids;
};

const idsFromHybrid = (value: unknown): string[] => {
    const ids: string[] = [];
    if (isRecord(value)) {
        pushPlayers(ids, value.players);
        pushRounds(ids, value.preliminaryGroups);
        idsFromBracket(value.bracket).forEach(id => pushId(ids, id));
    }
    return ids;
};

const idsFromFullLeague = (value: unknown): string[] => {
    const ids: string[] = [];
    if (isRecord(value)) {
        pushPlayers(ids, value.players);
        pushMatches(ids, value.matches);
    }
    return ids;
};

const idsFromDoubleElim = (value: unknown): string[] => {
    const ids: string[] = [];
    if (isRecord(value)) {
        pushPlayers(ids, value.playerIds);
        pushRounds(ids, value.winnersRounds);
        pushRounds(ids, value.losersRounds);
        pushMatches(ids, value.grandFinal ? [value.grandFinal] : []);
    }
    return ids;
};

const idsFromMission = (value: unknown): string[] => {
    const ids: string[] = [];
    if (isRecord(value)) pushPlayers(ids, value.players);
    return ids;
};

const compatibleIds = (stored: unknown, derived: string[]): string[] =>
    Array.isArray(stored)
        ? stored.filter((id): id is string => typeof id === 'string' && id !== 'BYE')
        : derived;

export function normalizeTournamentDataCompatibility(
    incoming: unknown,
    defaults: TournamentData
): TournamentData {
    const source = isRecord(incoming) ? incoming : {};
    const legacyParticipantIds = compatibleIds(source.participantIds, []);
    const teams = Array.isArray(source.teams) ? source.teams : defaults.teams;
    const swiss = normalizeSwissData(source.swiss);
    const hybrid = normalizeHybridData(source.hybrid);
    const relayIds = idsFromTeams(teams);

    return {
        ...defaults,
        ...source,
        participantIds: legacyParticipantIds,
        relayParticipantIds: compatibleIds(
            source.relayParticipantIds,
            relayIds.length > 0 ? relayIds : legacyParticipantIds
        ),
        bracketParticipantIds: compatibleIds(source.bracketParticipantIds, idsFromBracket(source.bracket)),
        swissParticipantIds: compatibleIds(source.swissParticipantIds, idsFromSwiss(swiss)),
        hybridParticipantIds: compatibleIds(source.hybridParticipantIds, idsFromHybrid(hybrid)),
        fullLeagueParticipantIds: compatibleIds(source.fullLeagueParticipantIds, idsFromFullLeague(source.fullLeague)),
        doubleElimParticipantIds: compatibleIds(source.doubleElimParticipantIds, idsFromDoubleElim(source.doubleElim)),
        missionParticipantIds: compatibleIds(source.missionParticipantIds, idsFromMission(source.missionBaduk)),
        teams,
        bracket: source.bracket === undefined ? defaults.bracket : source.bracket,
        relay: source.relay === undefined ? defaults.relay : source.relay,
        swiss,
        hybrid,
        awardSessionIds: isRecord(source.awardSessionIds) ? source.awardSessionIds : {},
    } as TournamentData;
}

/**
 * Pure compatibility boundary for persisted AppData. It never mutates either
 * argument and keeps unknown keys at every merged object level.
 */
export function normalizeAppDataCompatibility<T extends AppData>(
    incoming: unknown,
    defaults: T
): T {
    if (!isRecord(incoming)) return defaults;

    const normalized: UnknownRecord = { ...defaults, ...incoming };
    for (const key of APP_ARRAY_KEYS) {
        normalized[key] = Array.isArray(incoming[key]) ? incoming[key] : defaults[key];
    }

    normalized.generalSettings = mergeSettingDefaults(defaults.generalSettings, incoming.generalSettings);
    normalized.eventSettings = mergeSettingDefaults(defaults.eventSettings, incoming.eventSettings);
    normalized.tournamentSettings = mergeSettingDefaults(defaults.tournamentSettings, incoming.tournamentSettings);
    normalized.shopSettings = mergeSettingDefaults(defaults.shopSettings, incoming.shopSettings);
    normalized.tournamentData = normalizeTournamentDataCompatibility(
        incoming.tournamentData,
        defaults.tournamentData
    );

    return normalized as T;
}
