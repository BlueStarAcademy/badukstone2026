
import React, { useState, useMemo } from 'react';
import type { Student, TournamentData, TournamentSettings, SwissPlayer, SwissMatch, TournamentPlayer, TournamentBracket, TournamentMatch } from '../../types';
import { parseRank, generateId } from '../../utils';
import { TournamentBracketView } from './TournamentBracketView';
import { ConfirmationModal } from '../modals/ConfirmationModal';

interface TournamentHybridViewProps {
    students: Student[];
    data: TournamentData;
    setData: React.Dispatch<React.SetStateAction<TournamentData>>;
    settings: TournamentSettings;
    onOpenPlayerManagement: () => void;
    onBulkAddTransaction: (studentIds: string[], description: string, amount: number) => void;
}

interface PreliminaryGroupViewProps {
    group: SwissMatch[];
    groupIndex: number;
    players: SwissPlayer[];
    onSetWinner: (matchId: string, winnerId: string) => void;
}

const PreliminaryGroupView: React.FC<PreliminaryGroupViewProps> = ({ group, groupIndex, players, onSetWinner }) => {
    const getPlayer = (id: string) => players.find(p => p.studentId === id);

    const groupPlayers = useMemo(() => {
        const playerIds = new Set(group.flatMap(m => m.players));
        return players.filter(p => playerIds.has(p.studentId)).sort((a,b) => b.score - a.score);
    }, [group, players]);

    return (
        <div className="swiss-round" style={{border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', background: 'var(--surface-color-hover)'}}>
            <h3>{groupIndex + 1}조</h3>
            <table className="swiss-standings-table" style={{marginBottom: '1rem'}}>
                <thead><tr><th>선수</th><th>승점</th></tr></thead>
                <tbody>
                    {groupPlayers.map(p => (
                        <tr key={p.studentId}>
                            <td>{p.name}</td>
                            <td>{p.score}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <ul className="swiss-match-list">
                {group.map(match => {
                    const player1 = getPlayer(match.players[0] as string);
                    const player2 = getPlayer(match.players[1] as string);
                    return (
                        <li key={match.id} className="swiss-match">
                            <div className={`swiss-player clickable ${match.winnerId === player1?.studentId ? 'winner' : ''} ${match.winnerId && match.winnerId !== player1?.studentId ? 'loser' : ''}`} onClick={() => player1 && onSetWinner(match.id, player1.studentId)}>
                                <span>{player1?.name}</span>
                                {match.winnerId === player1?.studentId && <span className="winner-label">승</span>}
                            </div>
                            <div className="swiss-vs">VS</div>
                            <div className={`swiss-player clickable ${match.winnerId === player2?.studentId ? 'winner' : ''} ${match.winnerId && match.winnerId !== player2?.studentId ? 'loser' : ''}`} onClick={() => player2 && onSetWinner(match.id, player2.studentId)}>
                                <span>{player2?.name}</span>
                                {match.winnerId === player2?.studentId && <span className="winner-label">승</span>}
                            </div>
                        </li>
                    )
                })}
            </ul>
        </div>
    );
};

export const TournamentHybridView = (props: TournamentHybridViewProps) => {
    const { students, data, setData, settings, onOpenPlayerManagement, onBulkAddTransaction } = props;
    const { hybridParticipantIds } = data;
    const { hybridMode, hybridAdvanceCount, hybridGroupCount } = settings;

    const [confirmation, setConfirmation] = useState<{ message: React.ReactNode, actions: any[] } | null>(null);

    const handleGeneratePreliminaries = () => {
        const participants = (hybridParticipantIds || [])
            .map(id => students.find(s => s.id === id))
            .filter((s): s is Student => !!s);
        
        if (participants.length < (hybridAdvanceCount || 8)) {
            alert(`참가 인원(${participants.length}명)이 본선 진출 인원(${hybridAdvanceCount}명)보다 적습니다.`);
            return;
        }

        let sortedParticipants: Student[];
        if (hybridMode === 'rank') {
            sortedParticipants = [...participants].sort((a, b) => parseRank(b.rank) - parseRank(a.rank));
        } else {
            sortedParticipants = [...participants].sort(() => 0.5 - Math.random());
        }

        const numGroups = hybridGroupCount || Math.ceil(participants.length / 5);
        const groups: Student[][] = Array.from({ length: numGroups }, () => []);

        sortedParticipants.forEach((player, index) => {
            const groupIndex = index % numGroups;
            const reverseGroupIndex = numGroups - 1 - groupIndex;
            if (Math.floor(index / numGroups) % 2 === 0) {
                groups[groupIndex].push(player);
            } else {
                groups[reverseGroupIndex].push(player);
            }
        });

        const swissPlayers: SwissPlayer[] = participants.map(p => ({
            studentId: p.id,
            name: p.name,
            score: 0,
            opponents: [],
            sos: 0,
            sosos: 0,
        }));

        const preliminaryGroups: SwissMatch[][] = groups.map(group => {
            const matches: SwissMatch[] = [];
            for (let i = 0; i < group.length; i++) {
                for (let j = i + 1; j < group.length; j++) {
                    matches.push({
                        id: generateId(),
                        players: [group[i].id, group[j].id],
                        winnerId: null,
                    });
                }
            }
            return matches;
        });
        
        setData(prev => ({
            ...prev,
            hybrid: {
                players: swissPlayers,
                preliminaryGroups,
                bracket: null,
            }
        }));
    };

    const handleSetPreliminaryWinner = (matchId: string, winnerId: string) => {
        setData(prev => {
            if (!prev.hybrid) return prev;
            const newData = JSON.parse(JSON.stringify(prev));
            let matchFound = false;

            for (const group of newData.hybrid.preliminaryGroups) {
                const match = group.find((m: SwissMatch) => m.id === matchId);
                if (match) {
                    const newWinnerId = match.winnerId === winnerId ? null : winnerId;
                    match.winnerId = newWinnerId;
                    matchFound = true;
                    break;
                }
            }
            
            if (matchFound) {
                newData.hybrid.players.forEach((p: SwissPlayer) => p.score = 0);
                newData.hybrid.preliminaryGroups.flat().forEach((m: SwissMatch) => {
                    if (m.winnerId) {
                        const winner = newData.hybrid.players.find((p: SwissPlayer) => p.studentId === m.winnerId);
                        if(winner) winner.score++;
                    }
                });
            }
            return newData;
        });
    };

    const handleAdvanceToBracket = () => {
        if (!data.hybrid) return;

        const advanceCount = hybridAdvanceCount || 8;
        const qualifiedPlayers = [...data.hybrid.players]
            .sort((a, b) => b.score - a.score)
            .slice(0, advanceCount);

        const numPlayers = qualifiedPlayers.length;
        const bracketSize = Math.pow(2, Math.ceil(Math.log2(numPlayers)));
        const numByes = bracketSize - numPlayers;

        const createPlayer = (p: SwissPlayer): TournamentPlayer => {
            const student = students.find(s => s.id === p.studentId);
            return {
                studentId: p.studentId, name: p.name, rank: student?.rank || 'N/A',
                game1Handicap: 0, game1Color: 'black', game1Result: null,
                game2Score: null, game2LastStone: false, game3Score: null,
            };
        };
        const tournamentPlayers = qualifiedPlayers.map(createPlayer);

        let playersForRound1: (TournamentPlayer | 'BYE')[] = [];
        const topSeeds = tournamentPlayers.slice(0, numByes);
        const otherPlayers = tournamentPlayers.slice(numByes);

        let topSeedIdx = 0;
        let otherPlayerIdx = 0;
        const otherPlayersShuffled = [...otherPlayers].sort(() => Math.random() - 0.5);

        for (let i = 0; i < bracketSize / 2; i++) {
            if (topSeedIdx < numByes) {
                playersForRound1.push(topSeeds[topSeedIdx++]);
                playersForRound1.push('BYE');
            } else {
                playersForRound1.push(otherPlayersShuffled[otherPlayerIdx++]);
                playersForRound1.push(otherPlayersShuffled[otherPlayerIdx++]);
            }
        }
        
        const firstRoundMatches: TournamentMatch[] = [];
        for (let i = 0; i < playersForRound1.length; i += 2) {
            firstRoundMatches.push({
                id: generateId(),
                players: [playersForRound1[i], playersForRound1[i + 1] || null],
                winnerId: null,
            });
        }
        firstRoundMatches.forEach(match => {
            const player1 = match.players[0];
            if (player1 !== 'BYE' && player1 !== null && match.players[1] === 'BYE') {
                match.winnerId = player1.studentId;
            }
        });
        
        const rounds = [{ title: `${bracketSize}강`, matches: firstRoundMatches }];
        let currentRoundMatches = firstRoundMatches;
        
        while (currentRoundMatches.length > 2) {
            const currentRoundSize = currentRoundMatches.length * 2;
            const nextRoundMatches: TournamentMatch[] = [];
            for (let i = 0; i < currentRoundMatches.length; i += 2) {
                nextRoundMatches.push({ 
                    id: generateId(), 
                    players: [null, null], 
                    winnerId: null,
                });
            }
            const nextRoundTitle = currentRoundSize / 2 === 4 ? '준결승' : `${currentRoundSize / 2}강`;
            rounds.push({ title: nextRoundTitle, matches: nextRoundMatches });
            currentRoundMatches = nextRoundMatches;
        }

        if (currentRoundMatches.length === 2) {
            const finalMatch = { id: generateId(), players: [null, null], winnerId: null };
            const thirdPlaceMatch = { id: generateId(), players: [null, null], winnerId: null };
            rounds.push({ title: '결승 & 3/4위전', matches: [finalMatch, thirdPlaceMatch] });
        } else if (currentRoundMatches.length === 1) {
             rounds[rounds.length-1].title = '결승';
        }

        setData(prev => ({
            ...prev,
            hybrid: {
                ...prev.hybrid!,
                bracket: { rounds, players: tournamentPlayers },
            }
        }));
    };

    const handleReset = () => {
        setConfirmation({
            message: "정말 예선 및 본선 대진표를 모두 초기화하시겠습니까?",
            actions: [
                { text: '취소', onClick: () => setConfirmation(null) },
                { text: '초기화', className: 'danger', onClick: () => {
                    setData(prev => ({ ...prev, hybrid: undefined }));
                    setConfirmation(null);
                }}
            ]
        });
    }

    // Intercept setData from child TournamentBracketView to update hybrid.bracket instead of root bracket
    const handleBracketDataUpdate = (updateAction: React.SetStateAction<TournamentData>) => {
        setData(globalPrev => {
            // Create a fake previous state where root.bracket is populated from hybrid.bracket
            // This satisfies TournamentBracketView logic which expects root.bracket
            const fakePrev = { ...globalPrev, bracket: globalPrev.hybrid?.bracket || null };
            
            // Apply the update
            const updateFn = typeof updateAction === 'function' ? updateAction : () => updateAction;
            const nextState = updateFn(fakePrev);
            
            // Put the updated bracket back into hybrid.bracket
            return {
                ...globalPrev,
                hybrid: {
                    ...globalPrev.hybrid!,
                    bracket: nextState.bracket
                }
            };
        });
    };

    if (!data.hybrid) {
        return (
             <div className="tournament-bracket-view" style={{ textAlign: 'center', padding: '3rem' }}>
                <div style={{marginBottom: '1.5rem'}}>
                    <button className="btn" onClick={onOpenPlayerManagement}>선수 관리</button>
                </div>
                <p style={{ marginBottom: '1rem' }}>참가 선수를 선택하고 예선 리그를 생성하세요.</p>
                <div style={{display: 'flex', justifyContent: 'center', gap: '1rem'}}>
                    <button className="btn primary" onClick={handleGeneratePreliminaries} disabled={(hybridParticipantIds || []).length < 2}>예선 리그 생성</button>
                </div>
            </div>
        );
    }
    
    if (data.hybrid && !data.hybrid.bracket) {
        const allMatchesPlayed = data.hybrid.preliminaryGroups.flat().every(m => m.winnerId);
        return (
            <div className="tournament-swiss-view">
                 <div className="swiss-controls">
                    <button className="btn" onClick={onOpenPlayerManagement}>선수 관리</button>
                    <button className="btn primary" onClick={handleAdvanceToBracket} disabled={!allMatchesPlayed}>본선 대진표 생성</button>
                    <button className="btn danger" onClick={handleReset}>대진표 초기화</button>
                </div>
                <p>각 조의 모든 경기를 진행한 후, '본선 대진표 생성' 버튼을 누르세요. 상위 {hybridAdvanceCount || 8}명이 진출합니다.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem', marginTop: '1rem' }}>
                    {data.hybrid.preliminaryGroups.map((group, i) => (
                        <PreliminaryGroupView key={i} group={group} groupIndex={i} players={data.hybrid!.players} onSetWinner={handleSetPreliminaryWinner} />
                    ))}
                </div>
            </div>
        );
    }

    if (data.hybrid && data.hybrid.bracket) {
         return (
            <TournamentBracketView
                data={{...data, bracket: data.hybrid.bracket}}
                students={students}
                setData={handleBracketDataUpdate}
                settings={settings}
                onBulkAddTransaction={onBulkAddTransaction}
                onOpenPlayerManagement={onOpenPlayerManagement}
            />
        );
    }

    return null;
};
