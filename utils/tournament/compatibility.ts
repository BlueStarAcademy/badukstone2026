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

/** Array or numeric-keyed object (일부 직렬화/레거시 저장) → 배열 */
export const asArray = <T = unknown>(value: unknown): T[] => {
    if (Array.isArray(value)) return value as T[];
    if (!isRecord(value)) return [];
    const keys = Object.keys(value);
    if (keys.length === 0) return [];
    if (!keys.every(key => /^\d+$/.test(key))) return [];
    return keys
        .map(key => Number(key))
        .sort((a, b) => a - b)
        .map(key => value[String(key)] as T);
};

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
    asArray(value).forEach(player => {
        if (typeof player === 'string') pushId(ids, player);
        else pushPlayer(ids, player);
    });
};

const pushMatches = (ids: string[], value: unknown) => {
    asArray(value).forEach(match => {
        if (!isRecord(match)) return;
        pushPlayers(ids, match.players);
        pushId(ids, match.player1Id);
        pushId(ids, match.player2Id);
    });
};

const pushRounds = (ids: string[], value: unknown) => {
    asArray(value).forEach(round => {
        if (Array.isArray(round) || (isRecord(round) && !Array.isArray((round as UnknownRecord).players))) {
            if (Array.isArray(round)) pushMatches(ids, round);
            else if (isRecord(round)) pushMatches(ids, round.matches);
        }
    });
};

const normalizeMatch = (value: unknown): UnknownRecord | null => {
    if (!isRecord(value)) return null;
    return {
        ...value,
        players: asArray(value.players),
    };
};

const normalizeMatchList = (value: unknown): unknown[] =>
    asArray(value)
        .map(normalizeMatch)
        .filter((match): match is UnknownRecord => match !== null);

/**
 * Firestore cannot persist nested arrays, so the legacy client stored rounds as
 * `{ roundIndex, matches }[]` (and hybrid groups as `{ groupIndex, matches }[]`).
 * PostgreSQL can store the native nested arrays; normalize both representations.
 */
export const normalizeSwissRounds = (value: unknown): unknown[][] => {
    const arr = asArray(value);
    if (arr.length === 0) return [];

    // Flat match list: [{ players, winnerId, id }, ...]
    if (arr.every(item => isRecord(item) && 'players' in item && !('matches' in item))) {
        return [normalizeMatchList(arr)];
    }

    // Round wrappers: [{ roundIndex, matches }, ...]
    if (arr.every(item => isRecord(item) && 'matches' in item && !('players' in item))) {
        return arr.map(item => normalizeMatchList((item as UnknownRecord).matches));
    }

    // Native SwissMatch[][] (or numeric-keyed rows)
    return arr.map(round => {
        const list = asArray(round);
        if (list.length === 0) {
            if (isRecord(round) && 'matches' in round) return normalizeMatchList(round.matches);
            return [];
        }
        if (list.every(item => isRecord(item) && 'players' in item)) return normalizeMatchList(list);
        if (list.every(item => isRecord(item) && 'matches' in item && !('players' in item))) {
            return list.flatMap(item => normalizeMatchList((item as UnknownRecord).matches));
        }
        if (isRecord(round) && 'matches' in round) return normalizeMatchList(round.matches);
        return normalizeMatchList(list);
    });
};

/** 예선 조: SwissMatch[][] — Firestore `{groupIndex,matches}[]` 및 숫자키 객체 지원 */
export const normalizeHybridPreliminaryGroups = (value: unknown): unknown[][] => {
    const arr = asArray(value);
    if (arr.length === 0) return [];

    // [{ groupIndex, matches: Match[] }, ...]
    if (arr.every(item => isRecord(item) && 'matches' in item && !('players' in item))) {
        return arr.map(item => normalizeMatchList((item as UnknownRecord).matches));
    }

    // 이미 Match[][] 이거나 숫자키 그룹
    return arr.map(group => {
        if (isRecord(group) && 'matches' in group && !('players' in group)) {
            return normalizeMatchList(group.matches);
        }
        const list = asArray(group);
        if (list.every(item => isRecord(item) && 'players' in item)) return normalizeMatchList(list);
        if (list.every(item => isRecord(item) && 'matches' in item && !('players' in item))) {
            return list.flatMap(item => normalizeMatchList((item as UnknownRecord).matches));
        }
        return normalizeMatchList(list);
    });
};

const normalizeSwissData = (value: unknown): unknown => {
    if (!isRecord(value)) return value;
    const normalized: UnknownRecord = {
        ...value,
        players: asArray(value.players),
        rounds: normalizeSwissRounds(value.rounds),
    };
    const groups = asArray(value.groups);
    if (groups.length > 0 || value.groups != null) {
        normalized.groups = groups.map(group => {
            if (!isRecord(group)) return group;
            return {
                ...group,
                players: asArray(group.players),
                rounds: normalizeSwissRounds(group.rounds),
            };
        });
    }
    return normalized;
};

const normalizeHybridData = (value: unknown): unknown => {
    if (!isRecord(value)) return value;
    return {
        ...value,
        players: asArray(value.players),
        preliminaryGroups: normalizeHybridPreliminaryGroups(value.preliminaryGroups),
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
        if (incoming[key] === undefined || incoming[key] === null) {
            normalized[key] = defaults[key];
            continue;
        }
        if (Array.isArray(incoming[key])) {
            normalized[key] = incoming[key];
            continue;
        }
        const legacyArray = asArray(incoming[key]);
        normalized[key] = legacyArray.length > 0 ? legacyArray : defaults[key];
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
