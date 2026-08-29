import type { TournamentByePriority, TournamentMatch, TournamentPlayer, TournamentBracket } from '../types';
import { generateId } from './index';
import {
    DEFAULT_BYE_PRIORITY,
    planElimBracket,
    pickByeRecipientSeedIndices,
    pairSeedsWithByePads,
} from './byePlacement';

export {
    DEFAULT_BYE_PRIORITY,
    minimalPow2BracketSize,
    previousPow2BracketSize,
    planCompactElimBracket,
    planElimBracket,
    planDoubleElimBracket,
    listValidStartRoundSizes,
    listValidDoubleElimStartRoundSizes,
    formatStartRoundLabel,
    describeElimBracketPlan,
    describeDoubleElimBracketPlan,
} from './byePlacement';

export function isPlayInRoundTitle(title: string): boolean {
    return title.startsWith('예선');
}

export function elimRoundTitle(size: number): string {
    if (size <= 2) return '결승';
    if (size === 4) return '4강전';
    return `${size}강`;
}

export function pickElimSeedBuckets<T>(
    seedsStrongestFirst: T[],
    priority: TournamentByePriority,
    forcedMainDrawSize?: number | null
): { byeRecipients: T[]; playInPlayers: T[]; mainDrawSize: number; playInMatchCount: number } {
    const n = seedsStrongestFirst.length;
    const { mainDrawSize, playInMatchCount, byeCount } = planElimBracket(n, forcedMainDrawSize);
    if (playInMatchCount <= 0) {
        return {
            byeRecipients: [],
            playInPlayers: [...seedsStrongestFirst],
            mainDrawSize,
            playInMatchCount: 0,
        };
    }
    const byeIdx = new Set(pickByeRecipientSeedIndices(n, byeCount, priority));
    const byeRecipients: T[] = [];
    const playInPlayers: T[] = [];
    seedsStrongestFirst.forEach((p, i) => {
        (byeIdx.has(i) ? byeRecipients : playInPlayers).push(p);
    });
    return { byeRecipients, playInPlayers, mainDrawSize, playInMatchCount };
}

/**
 * 예선 경기 i 승자 → 본선(메인 드로우) 매치/슬롯.
 * - 부전승이 있는 매치(앞쪽 byeCount개): [부전승, 예선승자] → slot 1
 * - 나머지: [예선승자, 예선승자] 쌍 (playIn > mainMatches일 때, 예: 7→4)
 */
export function playInFeederTarget(
    playInMatchIndex: number,
    playInMatchCount: number,
    mainDrawSize: number
): { matchIndex: number; slot: 0 | 1 } {
    const byeCount = Math.max(0, mainDrawSize - playInMatchCount);
    if (playInMatchIndex < byeCount) {
        return { matchIndex: playInMatchIndex, slot: 1 };
    }
    const dual = playInMatchIndex - byeCount;
    return {
        matchIndex: byeCount + Math.floor(dual / 2),
        slot: (dual % 2) as 0 | 1,
    };
}

/** 일반 라운드 진행 시 다음 매치 위치 (결승·3/4위전 제외) */
export function standardFeederTarget(matchIndex: number): { matchIndex: number; slot: 0 | 1 } {
    return { matchIndex: Math.floor(matchIndex / 2), slot: (matchIndex % 2) as 0 | 1 };
}

export function getElimFeederTarget(
    currentTitle: string,
    nextTitle: string,
    matchIndex: number,
    playInMatchCount: number,
    mainDrawSize?: number
): { matchIndex: number; slot: 0 | 1 } | null {
    if (nextTitle.includes('결승') && (currentTitle === '4강전' || currentTitle === '준결승' || currentTitle === '4강')) {
        // 결승/3·4위는 호출측에서 별도 처리
        return null;
    }
    if (isPlayInRoundTitle(currentTitle)) {
        const size = mainDrawSize ?? playInMatchCount * 2;
        return playInFeederTarget(matchIndex, playInMatchCount, size);
    }
    return standardFeederTarget(matchIndex);
}

function shuffleInPlace<T>(arr: T[], enabled: boolean): T[] {
    if (!enabled) return [...arr];
    return [...arr].sort(() => Math.random() - 0.5);
}

function emptyMatch(): TournamentMatch {
    return { id: generateId(), players: [null, null], winnerId: null };
}

/**
 * 본선 라운드에 부전승 시드 배치.
 * 앞쪽 byeCount 매치: [부전승, null(예선 피더)]
 * 이후 매치: [null, null] (예선승자 vs 예선승자)
 */
export function placeMainDrawSeeds(
    mainMatches: TournamentMatch[],
    byeRecipients: TournamentPlayer[],
    _playInMatchCount?: number
): void {
    const byeQueue = [...byeRecipients];
    const byeCount = byeQueue.length;
    for (let i = 0; i < mainMatches.length; i++) {
        if (i < byeCount) {
            mainMatches[i].players[0] = byeQueue.shift() ?? null;
            mainMatches[i].players[1] = null;
        } else {
            mainMatches[i].players[0] = null;
            mainMatches[i].players[1] = null;
        }
        mainMatches[i].winnerId = null;
    }
}

/**
 * 단판 토너먼트 라운드 생성 (예선→본선 최적 구조).
 * @param forcedMainDrawSize 몇강전부터 시작할지 (2의 거듭제곱). 미지정 시 자동.
 */
export function buildSingleElimRounds(
    tournamentPlayers: TournamentPlayer[],
    priority: TournamentByePriority = DEFAULT_BYE_PRIORITY,
    shufflePairings = true,
    forcedMainDrawSize?: number | null
): { rounds: TournamentBracket['rounds']; mainDrawSize: number; playInMatchCount: number } {
    const seeds = [...tournamentPlayers];
    const { byeRecipients, playInPlayers, mainDrawSize, playInMatchCount } = pickElimSeedBuckets(
        seeds,
        priority,
        forcedMainDrawSize
    );
    const rounds: TournamentBracket['rounds'] = [];

    if (playInMatchCount > 0) {
        const pvp = shuffleInPlace(playInPlayers, shufflePairings);
        const playInMatches: TournamentMatch[] = [];
        for (let i = 0; i < playInMatchCount; i++) {
            const a = pvp[i * 2];
            const b = pvp[i * 2 + 1];
            playInMatches.push({
                id: generateId(),
                players: [a ?? null, b ?? null],
                winnerId: null,
            });
        }
        rounds.push({
            title: `예선 (${playInMatchCount}경기 → ${mainDrawSize}강)`,
            matches: playInMatches,
        });
    }

    let roundSize = mainDrawSize;
    const mainMatches: TournamentMatch[] = [];
    for (let i = 0; i < roundSize / 2; i++) mainMatches.push(emptyMatch());

    if (playInMatchCount > 0) {
        placeMainDrawSeeds(mainMatches, byeRecipients as TournamentPlayer[], playInMatchCount);
    } else {
        const paired = pairSeedsWithByePads(
            seeds,
            mainDrawSize,
            priority,
            shufflePairings
        );
        for (let i = 0; i < mainMatches.length; i++) {
            const [a, b] = paired[i] ?? ['BYE', 'BYE'];
            mainMatches[i].players = [a, b];
            if (a && a !== 'BYE' && b === 'BYE') {
                mainMatches[i].winnerId = a.studentId;
            } else if (b && b !== 'BYE' && a === 'BYE') {
                mainMatches[i].winnerId = b.studentId;
            }
        }
    }
    rounds.push({ title: elimRoundTitle(roundSize), matches: mainMatches });

    while (roundSize > 4) {
        roundSize = roundSize / 2;
        const nextMatches: TournamentMatch[] = [];
        for (let i = 0; i < roundSize / 2; i++) nextMatches.push(emptyMatch());
        rounds.push({ title: elimRoundTitle(roundSize), matches: nextMatches });
    }

    if (mainDrawSize >= 4) {
        rounds.push({
            title: '결승 & 3/4위전',
            matches: [emptyMatch(), emptyMatch()],
        });
    } else if (mainDrawSize === 2 && rounds[rounds.length - 1]?.title !== '결승') {
        rounds[rounds.length - 1].title = '결승';
    }

    const built: TournamentBracket = { rounds, players: tournamentPlayers };
    propagateSingleElimWinners(built);

    return { rounds: built.rounds, mainDrawSize, playInMatchCount };
}

/** 예선→본선 진출 및 이후 라운드 승자 반영 */
export function propagateSingleElimWinners(bracket: TournamentBracket): void {
    const playInRound = bracket.rounds.find(r => isPlayInRoundTitle(r.title));
    const playInMatchCount = playInRound?.matches.length ?? 0;

    for (let rIdx = 0; rIdx < bracket.rounds.length - 1; rIdx++) {
        const currentRound = bracket.rounds[rIdx];
        const nextRound = bracket.rounds[rIdx + 1];

        if (
            (currentRound.title === '4강전' || currentRound.title === '준결승' || currentRound.title === '4강') &&
            nextRound.title.includes('결승')
        ) {
            const semi1 = currentRound.matches[0];
            const semi2 = currentRound.matches[1];
            const finalMatch = nextRound.matches[0];
            const thirdPlaceMatch = nextRound.matches[1];

            const winner1 = semi1?.winnerId ? bracket.players.find(p => p.studentId === semi1.winnerId) : null;
            const loser1Player = semi1?.players.find(p => p && p !== 'BYE' && p.studentId !== semi1.winnerId);
            const loser1 = loser1Player
                ? bracket.players.find(p => p.studentId === (loser1Player as TournamentPlayer).studentId)
                : null;

            const winner2 = semi2?.winnerId ? bracket.players.find(p => p.studentId === semi2.winnerId) : null;
            const loser2Player = semi2?.players.find(p => p && p !== 'BYE' && p.studentId !== semi2.winnerId);
            const loser2 = loser2Player
                ? bracket.players.find(p => p.studentId === (loser2Player as TournamentPlayer).studentId)
                : null;

            if (finalMatch) {
                finalMatch.players[0] = winner1 || null;
                finalMatch.players[1] = winner2 || null;
            }
            if (thirdPlaceMatch) {
                if (semi1?.winnerId && semi2?.winnerId) {
                    thirdPlaceMatch.players[0] = loser1 || null;
                    thirdPlaceMatch.players[1] = loser2 || null;
                } else {
                    thirdPlaceMatch.players[0] = null;
                    thirdPlaceMatch.players[1] = null;
                }
            }
            continue;
        }

        if (isPlayInRoundTitle(currentRound.title)) {
            // 본선 부전승 시드는 유지하고 예선 승자 슬롯만 갱신
            const mainDrawSize = nextRound.matches.length * 2;
            for (let mIdx = 0; mIdx < currentRound.matches.length; mIdx++) {
                const winnerId = currentRound.matches[mIdx].winnerId;
                const target = playInFeederTarget(mIdx, playInMatchCount, mainDrawSize);
                const nextMatch = nextRound.matches[target.matchIndex];
                if (!nextMatch) continue;
                nextMatch.players[target.slot] = winnerId
                    ? bracket.players.find(p => p.studentId === winnerId) || null
                    : null;
                if (nextMatch.winnerId) {
                    const stillIn =
                        nextMatch.players[0] &&
                        nextMatch.players[0] !== 'BYE' &&
                        (nextMatch.players[0] as TournamentPlayer).studentId === nextMatch.winnerId;
                    const stillIn2 =
                        nextMatch.players[1] &&
                        nextMatch.players[1] !== 'BYE' &&
                        (nextMatch.players[1] as TournamentPlayer).studentId === nextMatch.winnerId;
                    if (!stillIn && !stillIn2) nextMatch.winnerId = null;
                }
            }
            continue;
        }

        for (let mIdx = 0; mIdx < currentRound.matches.length; mIdx++) {
            const winnerId = currentRound.matches[mIdx].winnerId;
            if (!winnerId) continue;
            const winner = bracket.players.find(p => p.studentId === winnerId);
            const target = standardFeederTarget(mIdx);
            if (nextRound.matches[target.matchIndex]) {
                nextRound.matches[target.matchIndex].players[target.slot] = winner || null;
            }
        }
    }
}

/** 예선에 등장하지 않는 선수 = 본선 부전승 시드 */
export function getByeRecipientsFromBracket(bracket: TournamentBracket): TournamentPlayer[] {
    const playIn = bracket.rounds.find(r => isPlayInRoundTitle(r.title));
    if (!playIn) return [];
    const playInIds = new Set<string>();
    for (const match of playIn.matches) {
        for (const p of match.players) {
            if (p && p !== 'BYE') playInIds.add((p as TournamentPlayer).studentId);
        }
    }
    return bracket.players.filter(p => !playInIds.has(p.studentId));
}

/** 이후 라운드 초기화 후 본선 부전승 시드·예선 승자 슬롯 복구 */
export function resetAndPropagateSingleElim(bracket: TournamentBracket, fromRoundIndex: number): void {
    const playIn = bracket.rounds.find(r => isPlayInRoundTitle(r.title));
    const playInMatchCount = playIn?.matches.length ?? 0;
    const mainRoundIndex = playIn ? 1 : 0;

    for (let rIdx = fromRoundIndex + 1; rIdx < bracket.rounds.length; rIdx++) {
        for (const match of bracket.rounds[rIdx].matches) {
            match.players = [null, null];
            match.winnerId = null;
        }
    }

    if (playIn && fromRoundIndex < mainRoundIndex) {
        const main = bracket.rounds[mainRoundIndex];
        if (main) placeMainDrawSeeds(main.matches, getByeRecipientsFromBracket(bracket), playInMatchCount);
    }

    propagateSingleElimWinners(bracket);
}
