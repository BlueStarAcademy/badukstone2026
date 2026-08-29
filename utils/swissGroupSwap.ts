import type { SwissData, SwissMatch } from '../types';
import { recomputeSwissStats } from './tournament/swiss';

function replacePlayerIdInGroupRounds(rounds: SwissMatch[][], fromId: string, toId: string): void {
    for (const round of rounds) {
        for (const m of round) {
            m.players = m.players.map(p => (p === fromId ? toId : p)) as (string | 'BYE')[];
            if (m.winnerId === fromId) m.winnerId = toId;
        }
    }
}

/**
 * 서로 다른 조에 있는 두 선수의 소속을 맞바꿉니다.
 * 각 조의 대진표·승점 등은 교체된 선수 기준으로 유지됩니다.
 */
export function swapSwissPlayersBetweenGroups(
    swiss: SwissData,
    groupIndexA: number,
    studentIdA: string,
    groupIndexB: number,
    studentIdB: string
): { ok: true; data: SwissData } | { ok: false; message: string } {
    const groups = swiss.groups;
    if (!groups?.length) return { ok: false, message: '조별 스위스가 아닙니다.' };
    if (groupIndexA === groupIndexB) return { ok: false, message: '서로 다른 조를 선택해 주세요.' };
    if (groupIndexA < 0 || groupIndexA >= groups.length || groupIndexB < 0 || groupIndexB >= groups.length) {
        return { ok: false, message: '조 번호가 올바르지 않습니다.' };
    }

    const ga = groups[groupIndexA];
    const gb = groups[groupIndexB];
    const ia = ga.players.findIndex(p => p.studentId === studentIdA);
    const ib = gb.players.findIndex(p => p.studentId === studentIdB);
    if (ia < 0 || ib < 0) return { ok: false, message: '선택한 선수를 해당 조에서 찾을 수 없습니다.' };

    const cloned = JSON.parse(JSON.stringify(swiss)) as SwissData;
    const cga = cloned.groups![groupIndexA];
    const cgb = cloned.groups![groupIndexB];

    replacePlayerIdInGroupRounds(cga.rounds, studentIdA, studentIdB);
    replacePlayerIdInGroupRounds(cgb.rounds, studentIdB, studentIdA);

    const tmp = cga.players[ia];
    cga.players[ia] = cgb.players[ib];
    cgb.players[ib] = tmp;

    cga.players = recomputeSwissStats(cga.players, cga.rounds);
    cgb.players = recomputeSwissStats(cgb.players, cgb.rounds);

    cloned.players = cloned.groups!.flatMap(g => g.players);
    return { ok: true, data: cloned };
}
