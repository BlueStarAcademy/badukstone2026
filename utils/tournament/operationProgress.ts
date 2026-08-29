import type { TournamentData, TournamentSettings } from '../../types';
import { asArray, normalizeHybridPreliminaryGroups, normalizeSwissRounds } from './compatibility';

export interface OperationProgress {
    completed: number;
    total: number;
    remaining: number;
    ratio: number;
    isComplete: boolean;
}

export type TournamentOperationMode = 'relay' | 'bracket' | 'swiss' | 'hybrid' | 'fullleague' | 'doubleelim';
export type TournamentOperationStage = '설정' | '참가자' | '대진' | '경기' | '순위' | '시상';

export interface TournamentOperationStatus extends OperationProgress {
    stage: TournamentOperationStage;
    nextAction: string;
    participantCount: number;
    awardsCompleted: number;
    awardsRequired: number;
}

const participantIdsByMode = (data: TournamentData, mode: TournamentOperationMode) => {
    const selected = mode === 'relay' ? data.relayParticipantIds
        : mode === 'bracket' ? data.bracketParticipantIds
        : mode === 'swiss' ? data.swissParticipantIds
        : mode === 'hybrid' ? data.hybridParticipantIds
        : mode === 'fullleague' ? data.fullLeagueParticipantIds
        : data.doubleElimParticipantIds;
    if (selected?.length) return selected;

    // Older saved tournaments may predate per-mode participant ID lists.
    if (mode === 'relay') return [...new Set(asArray(data.teams).flatMap(team => asArray((team as any).players).map((player: any) => player.studentId)))];
    if (mode === 'bracket') return asArray(data.bracket?.players).map((player: any) => player.studentId) || [];
    if (mode === 'swiss') return asArray(data.swiss?.players).map((player: any) => player.studentId) || [];
    if (mode === 'hybrid') return asArray(data.hybrid?.players).map((player: any) => player.studentId) || [];
    if (mode === 'fullleague') return asArray(data.fullLeague?.players).map((player: any) => player.studentId) || [];
    return asArray(data.doubleElim?.playerIds) || [];
};

const flattenBracketMatches = (data: TournamentData, mode: 'bracket' | 'hybrid') =>
    asArray((mode === 'bracket' ? data.bracket : data.hybrid?.bracket)?.rounds).flatMap(
        (round: any) => asArray(round?.matches)
    );

export function getTournamentOperationStatus(
    data: TournamentData,
    settings: TournamentSettings,
    mode: TournamentOperationMode,
    awardsCompleted = 0,
    awardsRequired = mode === 'relay' ? 2 : 1
): TournamentOperationStatus {
    const participantCount = participantIdsByMode(data, mode).length;
    let items: { winnerId?: string | null; complete?: boolean }[] = [];
    let drawCreated = false;
    let requiredDrawComplete = true;
    let relayIsDraw = false;

    if (mode === 'relay') {
        const teamA = data.teams.find(team => team.name === 'A');
        const teamB = data.teams.find(team => team.name === 'B');
        const pairCount = Math.min(teamA?.players.length || 0, teamB?.players.length || 0);
        const games = settings.games.filter(game => game !== 'none');
        items = games.flatMap(game =>
            Array.from({ length: pairCount }, (_, index) => {
                const a = teamA!.players[index];
                const b = teamB!.players[index];
                const key = game === 'game1' ? 'game1Result' : game === 'game2' ? 'game2Score' : 'game3Score';
                return { complete: a[key] !== null && b[key] !== null };
            })
        );
        drawCreated = pairCount > 0 && games.length > 0;
        const teamScore = (team: NonNullable<typeof teamA>) =>
            team.players.reduce(
                (sum, player) =>
                    sum +
                    (player.game1Result || 0) +
                    (player.game2Score || 0) * settings.game2StoneValue +
                    (player.game2LastStone ? settings.game2LastStoneBonus : 0) +
                    (player.game3Score || 0) * settings.game3StoneValue,
                (team.bonusScore || 0) - (team.mannerPenalties || 0) * (settings.relayMannerPenalty || 0)
            );
        relayIsDraw = !!teamA && !!teamB && teamScore(teamA) === teamScore(teamB);
    } else if (mode === 'bracket') {
        items = flattenBracketMatches(data, mode);
        drawCreated = !!data.bracket;
    } else if (mode === 'hybrid') {
        const preliminary = normalizeHybridPreliminaryGroups(data.hybrid?.preliminaryGroups).flat();
        const bracket = flattenBracketMatches(data, mode);
        const prelimDone = preliminary.length > 0 && preliminary.every((match: any) => !!match.winnerId);
        const hasBracket = !!data.hybrid?.bracket;
        items = hasBracket ? ([...preliminary, ...bracket] as any) : (preliminary as any);
        drawCreated = !!data.hybrid;
        // 예선이 끝나도 본선 대진이 없으면 아직 대진 단계
        requiredDrawComplete = prelimDone && hasBracket;
    } else if (mode === 'swiss') {
        const groups = asArray(data.swiss?.groups);
        const rounds = groups.length
            ? groups.flatMap((group: any) => normalizeSwissRounds(group.rounds))
            : normalizeSwissRounds(data.swiss?.rounds);
        const generated = rounds.flat();
        const roundLimit = Math.max(1, Math.floor(settings.swissRounds || 1));
        let expectedTotal = 0;
        if (rounds.length) {
            if (groups.length) {
                for (const group of groups) {
                    const firstRoundLen = asArray(normalizeSwissRounds((group as any)?.rounds)[0]).length || 0;
                    expectedTotal += firstRoundLen * roundLimit;
                }
            } else {
                expectedTotal = (asArray(rounds[0]).length || 0) * roundLimit;
            }
        }
        const placeholderCount = Math.max(0, expectedTotal - generated.length);
        items = [
            ...generated,
            ...Array.from({ length: placeholderCount }, () => ({ winnerId: null })),
        ] as any;
        drawCreated = generated.length > 0;
    } else if (mode === 'fullleague') {
        items = asArray(data.fullLeague?.matches);
        drawCreated = asArray(data.fullLeague?.matches).length > 0;
    } else {
        const doubleElim = data.doubleElim;
        items = doubleElim
            ? [
                ...asArray(doubleElim.winnersRounds).flatMap((round: any) => asArray(round.matches)),
                ...asArray(doubleElim.losersRounds).flatMap((round: any) => asArray(round.matches)),
                ...(doubleElim.grandFinal ? [doubleElim.grandFinal] : []),
                ...(doubleElim.grandFinalReset &&
                doubleElim.grandFinal?.winnerId &&
                doubleElim.grandFinal.winnerId === doubleElim.grandFinal.players[1]
                    ? [doubleElim.grandFinalReset]
                    : []),
            ]
            : [];
        drawCreated = !!doubleElim;
    }

    const progress = getOperationProgress(items, item => item.complete === true || !!item.winnerId);
    const matchesComplete = progress.isComplete && requiredDrawComplete;
    let stage: TournamentOperationStage;
    let nextAction: string;

    if (participantCount === 0) {
        stage = '참가자';
        nextAction = '선수 관리에서 참가자를 선택하세요.';
    } else if (!drawCreated) {
        stage = '대진';
        nextAction = '참가자를 확인하고 대진을 생성하세요.';
    } else if (!matchesComplete) {
        stage = '경기';
        if (mode === 'hybrid') {
            const preliminary = normalizeHybridPreliminaryGroups(data.hybrid?.preliminaryGroups).flat();
            const prelimDone = preliminary.length > 0 && preliminary.every((match: any) => !!match.winnerId);
            const hasBracket = !!data.hybrid?.bracket;
            if (!prelimDone) {
                nextAction = '예선 경기 결과를 입력하세요.';
            } else if (!hasBracket) {
                stage = '대진';
                nextAction = '본선 대진표를 생성하세요.';
            } else {
                nextAction = '본선 경기 결과를 입력하세요.';
            }
        } else {
            nextAction = mode === 'swiss' && progress.remaining > 0
                ? '현재 경기 결과를 입력하고 다음 라운드를 생성하세요.'
                : '남은 경기 결과를 입력하세요.';
        }
    } else if (awardsCompleted < awardsRequired) {
        stage = '순위';
        nextAction = mode === 'relay' && relayIsDraw
            ? '현재 동점입니다. 보너스 또는 감점을 확인해 승리팀을 확정하세요.'
            : mode === 'relay'
            ? `승리팀과 패배팀 시상을 확인하세요. (${awardsCompleted}/${awardsRequired})`
            : mode === 'hybrid'
            ? '예선·본선 순위를 확인하고 시상을 진행하세요.'
            : '최종 순위를 확인하고 시상을 진행하세요.';
    } else {
        stage = '시상';
        nextAction = '시상이 완료되었습니다. 시상 내역을 확인할 수 있습니다.';
    }

    return { ...progress, stage, nextAction, participantCount, awardsCompleted, awardsRequired };
}

export function getOperationProgress<T>(items: T[], isCompleted: (item: T) => boolean): OperationProgress {
    const completed = items.filter(isCompleted).length;
    const total = items.length;
    return {
        completed,
        total,
        remaining: total - completed,
        ratio: total === 0 ? 0 : completed / total,
        isComplete: total > 0 && completed === total,
    };
}
