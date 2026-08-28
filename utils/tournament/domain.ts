import type { Student, SwissPlayer, TournamentPlayer } from '../../types';

export interface TournamentParticipant {
    id: string;
    name: string;
    rank: string;
}

/** Resolve stored ids without allowing deleted students to leak into an engine. */
export function resolveParticipants(ids: string[], students: Student[]): TournamentParticipant[] {
    const byId = new Map(students.map(student => [student.id, student]));
    return ids.flatMap(id => {
        const student = byId.get(id);
        return student ? [{ id: student.id, name: student.name, rank: student.rank }] : [];
    });
}

export function toSwissPlayer(participant: TournamentParticipant): SwissPlayer {
    return {
        studentId: participant.id,
        name: participant.name,
        score: 0,
        opponents: [],
        sos: 0,
        sosos: 0,
    };
}

export function toTournamentPlayer(participant: TournamentParticipant): TournamentPlayer {
    return {
        studentId: participant.id,
        name: participant.name,
        rank: participant.rank,
        game1Handicap: 0,
        game1Color: 'black',
        game1Result: null,
        game2Score: null,
        game2LastStone: false,
        game3Score: null,
    };
}
