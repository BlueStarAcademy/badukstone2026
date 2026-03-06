
import React, { useState } from 'react';
import type { Student, TournamentData, FullLeagueData, FullLeagueMatch, TournamentSettings } from '../../types';
import { generateId } from '../../utils';
import { TournamentPrizeModal } from './TournamentPrizeModal';

interface TournamentFullLeagueViewProps {
    data: TournamentData;
    students: Student[];
    setData: React.Dispatch<React.SetStateAction<TournamentData>>;
    onOpenPlayerManagement: () => void;
    settings: TournamentSettings;
    onBulkAddTransaction: (studentIds: string[], description: string, amount: number) => void;
}

export const TournamentFullLeagueView = (props: TournamentFullLeagueViewProps) => {
    const { data, students, setData, onOpenPlayerManagement, settings, onBulkAddTransaction } = props;
    const fullLeague = data.fullLeague;
    const participantIds = data.fullLeagueParticipantIds || [];
    const [isPrizeModalOpen, setIsPrizeModalOpen] = useState(false);

    const handleStartFullLeague = (ids: string[]) => {
        const participants = ids
            .map(id => students.find(s => s.id === id))
            .filter((s): s is Student => !!s);
        if (participants.length < 2) {
            alert('풀리그를 시작하려면 최소 2명이 필요합니다.');
            return;
        }
        const players = participants.map(p => ({ studentId: p.id, name: p.name, wins: 0, losses: 0 }));
        const matches: FullLeagueMatch[] = [];
        for (let i = 0; i < participants.length; i++) {
            for (let j = i + 1; j < participants.length; j++) {
                matches.push({
                    id: generateId(),
                    player1Id: participants[i].id,
                    player2Id: participants[j].id,
                    winnerId: null,
                });
            }
        }
        setData(prev => ({
            ...prev,
            fullLeagueParticipantIds: ids,
            fullLeague: { players, matches },
        }));
    };

    const handleSetWinner = (matchId: string, winnerId: string | null) => {
        if (!fullLeague) return;
        setData(prev => {
            if (!prev.fullLeague) return prev;
            const next = JSON.parse(JSON.stringify(prev.fullLeague)) as FullLeagueData;
            const m = next.matches.find(x => x.id === matchId);
            if (!m) return prev;
            m.winnerId = winnerId;
            next.players.forEach(p => {
                p.wins = next.matches.filter(mt => mt.winnerId === p.studentId).length;
                p.losses = next.matches.filter(mt => (mt.player1Id === p.studentId || mt.player2Id === p.studentId) && mt.winnerId && mt.winnerId !== p.studentId).length;
            });
            return { ...prev, fullLeague: next };
        });
    };

    const handleReset = () => {
        if (!window.confirm('풀리그를 초기화하면 모든 경기 결과가 사라집니다. 계속하시겠습니까?')) return;
        setData(prev => ({ ...prev, fullLeague: undefined, fullLeagueParticipantIds: [] }));
    };

    if (!fullLeague || fullLeague.players.length === 0) {
        return (
            <div className="tournament-fullleague-view" style={{ textAlign: 'center', padding: '3rem' }}>
                <div style={{ marginBottom: '1.5rem' }}>
                    <button className="btn" onClick={onOpenPlayerManagement}>선수 관리</button>
                </div>
                <p style={{ marginBottom: '1rem' }}>풀리그(전체 라운드로빈) 대진이 없습니다. 선수 관리에서 참가자를 선택한 뒤 시작하세요.</p>
                <button className="btn primary" onClick={() => participantIds.length >= 2 && handleStartFullLeague(participantIds)} disabled={participantIds.length < 2}>
                    풀리그 시작
                </button>
            </div>
        );
    }

    const sortedPlayers = [...fullLeague.players].sort((a, b) => b.wins - a.wins || a.losses - b.losses);

    const handleAwardPrizes = (prizes: { champion: number; runnerUp: number; semiFinalist: number; participant: number }) => {
        if (!fullLeague) return;
        if (sortedPlayers.length === 0) return;

        const championId = sortedPlayers[0]?.studentId;
        const runnerUpId = sortedPlayers[1]?.studentId;
        const semiFinalistIds: string[] = [];
        if (sortedPlayers[2]) semiFinalistIds.push(sortedPlayers[2].studentId);
        if (sortedPlayers[3]) semiFinalistIds.push(sortedPlayers[3].studentId);

        const prizeWinners = new Set<string>([
            championId,
            runnerUpId,
            ...semiFinalistIds,
        ].filter(Boolean) as string[]);
        const participantsWithPrize = sortedPlayers.filter(p => !prizeWinners.has(p.studentId));

        if (championId && prizes.champion > 0) {
            onBulkAddTransaction([championId], '풀리그 우승', prizes.champion);
        }
        if (runnerUpId && prizes.runnerUp > 0) {
            onBulkAddTransaction([runnerUpId], '풀리그 준우승', prizes.runnerUp);
        }
        if (semiFinalistIds.length > 0 && prizes.semiFinalist > 0) {
            onBulkAddTransaction(semiFinalistIds, '풀리그 3-4위', prizes.semiFinalist);
        }
        if (participantsWithPrize.length > 0 && prizes.participant > 0) {
            onBulkAddTransaction(
                participantsWithPrize.map(p => p.studentId),
                '풀리그 참가상',
                prizes.participant
            );
        }

        setIsPrizeModalOpen(false);
        alert('풀리그 시상이 완료되었습니다.');
    };

    return (
        <div className="tournament-fullleague-view">
            <div className="fullleague-controls">
                <button className="btn" onClick={onOpenPlayerManagement}>선수 관리</button>
                <button className="btn danger" onClick={handleReset}>풀리그 초기화</button>
            </div>
            <div className="fullleague-layout">
                <div className="fullleague-matches-container">
                    <h3 className="fullleague-section-title">경기 목록</h3>
                    <ul className="fullleague-match-list">
                        {fullLeague.matches.map(match => {
                            const p1 = fullLeague.players.find(p => p.studentId === match.player1Id);
                            const p2 = fullLeague.players.find(p => p.studentId === match.player2Id);
                            const name1 = p1?.name ?? '?';
                            const name2 = p2?.name ?? '?';
                            const winnerId = match.winnerId;
                            return (
                                <li key={match.id} className="fullleague-match">
                                    <div
                                        className={`fullleague-player ${winnerId === match.player1Id ? 'winner' : ''} clickable`}
                                        onClick={() => handleSetWinner(match.id, winnerId === match.player1Id ? match.player2Id : match.player1Id)}
                                    >
                                        {name1}
                                        {winnerId === match.player1Id && <span className="winner-label">승</span>}
                                    </div>
                                    <div className="fullleague-vs">VS</div>
                                    <div
                                        className={`fullleague-player ${winnerId === match.player2Id ? 'winner' : ''} clickable`}
                                        onClick={() => handleSetWinner(match.id, winnerId === match.player2Id ? null : match.player2Id)}
                                    >
                                        {name2}
                                        {winnerId === match.player2Id && <span className="winner-label">승</span>}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>
                <div className="fullleague-standings-container">
                    <h3 className="fullleague-section-title">순위</h3>
                    <div className="fullleague-table-wrapper">
                        <table className="fullleague-standings-table">
                            <thead>
                                <tr>
                                    <th>순위</th>
                                    <th>이름</th>
                                    <th>승</th>
                                    <th>패</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedPlayers.map((p, i) => (
                                    <tr key={p.studentId} className={i < 3 ? `rank-${i + 1}` : ''}>
                                        <td>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</td>
                                        <td style={{ fontWeight: 'bold' }}>{p.name}</td>
                                        <td>{p.wins}</td>
                                        <td>{p.losses}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="fullleague-standings-actions">
                        <button
                            type="button"
                            className="btn primary"
                            onClick={() => setIsPrizeModalOpen(true)}
                        >
                            순위 보상
                        </button>
                    </div>
                </div>
            </div>
            <TournamentPrizeModal
                isOpen={isPrizeModalOpen}
                onClose={() => setIsPrizeModalOpen(false)}
                settings={settings}
                onAwardPrizes={handleAwardPrizes}
            />
        </div>
    );
};
