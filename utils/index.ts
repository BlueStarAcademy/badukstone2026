export const parseRank = (rankStr: string): number => {
    const cleanRank = rankStr.trim();
    
    if (cleanRank.includes('단')) {
        return 100 + parseInt(cleanRank.replace('단', ''), 10);
    }
    if (cleanRank.includes('급')) {
        return 100 - parseInt(cleanRank.replace('급', ''), 10);
    }
    if (cleanRank === '입문') {
        return 69; // 30급이 70이므로 그보다 낮게 설정 (effectively 31급)
    }
    return 0;
};

export const getGroupForRank = (rankStr: string): { group: string } => {
    const rankNum = parseRank(rankStr);
    if (rankNum >= 101) return { group: '유단자' }; // 1단 이상
    if (rankNum >= 91) return { group: '고급' };   // 9급(91) ~ 1급(99)
    if (rankNum >= 82) return { group: '중급' };   // 18급(82) ~ 10급(90)
    if (rankNum >= 75) return { group: '초급2' };  // 25급(75) ~ 19급(81)
    return { group: '초급1' };                 // 입문(69), 30급(70) ~ 26급(74)
};

export const generateId = () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

import type { SwissMatch, SwissPlayer } from '../types';

/**
 * 두 선수의 상대 전적(승자승). A가 이겼으면 1, B가 이겼으면 -1, 무승부/미대국이면 0.
 */
export const getSwissHeadToHead = (
    rounds: SwissMatch[][],
    playerIdA: string,
    playerIdB: string
): number => {
    for (const round of rounds) {
        for (const match of round) {
            if (match.players[0] === 'BYE' || match.players[1] === 'BYE') continue;
            const hasA = match.players[0] === playerIdA || match.players[1] === playerIdA;
            const hasB = match.players[0] === playerIdB || match.players[1] === playerIdB;
            if (hasA && hasB) {
                if (match.winnerId === playerIdA) return 1;
                if (match.winnerId === playerIdB) return -1;
                return 0;
            }
        }
    }
    return 0;
};

/**
 * 스위스 순위: 승점 → SOS → SOSOS → 승자승 순으로 정렬 (동점 시 승자승 적용)
 */
export const sortSwissPlayers = (players: SwissPlayer[], rounds: SwissMatch[][]): SwissPlayer[] => {
    return [...players].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.sos !== a.sos) return b.sos - a.sos;
        if (b.sosos !== a.sosos) return b.sosos - a.sosos;
        const h2h = getSwissHeadToHead(rounds, a.studentId, b.studentId);
        if (h2h !== 0) return -h2h; // sort: 음수면 a가 앞(상위). A가 이겼으면 h2h=1 → -1 반환해 A가 앞으로
        return 0;
    });
};

export const formatRelativeTime = (isoString: string): string => {
    const date = new Date(isoString);
    const now = new Date();
    const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);

    if (seconds < 60) return `${seconds}초 전`;
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    return `${days}일 전`;
};