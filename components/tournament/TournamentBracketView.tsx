
import React, { useState } from 'react';
import type { Student, TournamentBracket, TournamentData, TournamentSettings, TournamentMatch, TournamentPlayer } from '../../types';
import { ConfirmationModal } from '../modals/ConfirmationModal';
import { TournamentPrizeModal } from './TournamentPrizeModal';
import { parseRank, generateId } from '../../utils';
import { BracketTree } from './BracketTree';

interface TournamentBracketViewProps {
    data: TournamentData;
    students: Student[];
    setData: React.Dispatch<React.SetStateAction<TournamentData>>;
    settings: TournamentSettings;
    onBulkAddTransaction: (studentIds: string[], description: string, amount: number) => void;
    onOpenPlayerManagement: () => void;
}

const TournamentWinnerDisplay = ({ bracketData, students }: { bracketData: TournamentBracket, students: Student[] }) => {
    const finalRound = bracketData.rounds[bracketData.rounds.length - 1];
    const semiFinalRound = bracketData.rounds.find(r => r.title === '4강전' || r.title === '준결승');

    const championId = finalRound.matches[0].winnerId;
    const champion = championId ? students.find(s => s.id === championId) : null;
    
    const runnerUpPlayer = finalRound.matches[0].players.find(p => p && p !== 'BYE' && p.studentId !== championId);
    const runnerUp = runnerUpPlayer ? students.find(s => s.id === (runnerUpPlayer as TournamentPlayer).studentId) : null;

    let thirdPlaceWinners: (Student | null)[] = [];
    if (finalRound.matches.length > 1 && finalRound.matches[1].winnerId) {
        const thirdPlace = students.find(s => s.id === finalRound.matches[1].winnerId);
        thirdPlaceWinners.push(thirdPlace || null);
    } else if (semiFinalRound) {
        const semifinalLosers = semiFinalRound.matches.flatMap(m => m.players)
            .filter((p): p is TournamentPlayer => !!(p && p !== 'BYE' && p.studentId !== championId && p.studentId !== runnerUp?.id))
            .map(p => students.find(s => s.id === p.studentId) || null);
        thirdPlaceWinners = semifinalLosers;
    }


    return (
        <div className="tournament-winner-display">
            <h3 style={{marginBottom: '1.5rem', color: '#333'}}>🏆 최종 결과 🏆</h3>
            <div className="winner-podium">
                {runnerUp && (
                     <div className="podium-step rank-2">
                        <div className="trophy-icon">🥈</div>
                        <h4 className="winner-name">{runnerUp.name}</h4>
                        <p className="winner-rank">{runnerUp.rank}</p>
                    </div>
                )}
                 {champion && (
                     <div className="podium-step rank-1">
                        <div className="trophy-icon">🥇</div>
                        <h4 className="winner-name">{champion.name}</h4>
                        <p className="winner-rank">{champion.rank}</p>
                    </div>
                )}
                 {thirdPlaceWinners.length > 0 && (
                     <div className="podium-step rank-3">
                        <div className="trophy-icon">🥉</div>
                         {thirdPlaceWinners.map((winner, index) => (
                            winner && <div key={index}>
                                <h4 className="winner-name">{winner.name}</h4>
                                <p className="winner-rank">{winner.rank}</p>
                            </div>
                         ))}
                    </div>
                )}
            </div>
        </div>
    );
};


export const TournamentBracketView = (props: TournamentBracketViewProps) => {
    const { data, students, setData, settings, onBulkAddTransaction, onOpenPlayerManagement } = props;
    const { bracket: bracketData, bracketParticipantIds } = data;

    const [confirmation, setConfirmation] = useState<{ message: React.ReactNode, actions: any[] } | null>(null);
    const [isPrizeModalOpen, setIsPrizeModalOpen] = useState(false);

    const handleGenerateBracket = () => {
        const participants = (bracketParticipantIds || [])
            .map(id => students.find(s => s.id === id))
            .filter((s): s is Student => !!s)
            .sort((a, b) => parseRank(b.rank) - parseRank(a.rank)); 
        
        if (participants.length < 2) {
            alert('토너먼트를 생성하려면 최소 2명의 참가자가 필요합니다.');
            return;
        }

        const numPlayers = participants.length;
        const bracketSize = Math.pow(2, Math.ceil(Math.log2(numPlayers)));
        const numByes = bracketSize - numPlayers;

        const tournamentPlayers: TournamentPlayer[] = participants.map(p => ({
            studentId: p.id, name: p.name, rank: p.rank,
            game1Handicap: 0, game1Color: 'black', game1Result: null,
            game2Score: null, game2LastStone: false, game3Score: null,
        }));
        
        const topSeeds = tournamentPlayers.slice(0, numByes);
        const otherPlayers = tournamentPlayers.slice(numByes);

        let playersForRound1: (TournamentPlayer | 'BYE')[] = [];
        
        const otherPlayersShuffled = [...otherPlayers].sort(() => Math.random() - 0.5);

        let topSeedIdx = 0;
        let otherPlayerIdx = 0;

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
        
        let firstTitle = `${bracketSize}강`;
        if (bracketSize === 4) firstTitle = '4강전';
        if (bracketSize === 2) firstTitle = '결승';

        const rounds = [{ title: firstTitle, matches: firstRoundMatches }];
        let currentRoundMatches = firstRoundMatches;
        let currentRoundSize = bracketSize;
        
        while (currentRoundSize > 4) {
            const nextRoundSize = currentRoundSize / 2;
            const nextRoundMatches: TournamentMatch[] = [];
            for (let i = 0; i < nextRoundSize / 2; i++) {
                nextRoundMatches.push({ 
                    id: generateId(), 
                    players: [null, null], 
                    winnerId: null,
                });
            }
            const nextRoundTitle = nextRoundSize === 4 ? '4강전' : `${nextRoundSize}강`;
            rounds.push({ title: nextRoundTitle, matches: nextRoundMatches });
            currentRoundSize = nextRoundSize;
        }

        if (currentRoundSize === 4 || (bracketSize <= 4 && rounds.length === 1 && rounds[0].title === '4강전')) { 
            const finalMatch = { id: generateId(), players: [null, null], winnerId: null };
            const thirdPlaceMatch = { id: generateId(), players: [null, null], winnerId: null };
            rounds.push({ title: '결승 & 3/4위전', matches: [finalMatch, thirdPlaceMatch] });
        } else if (bracketSize === 2 && rounds.length === 1 && rounds[0].title === '결승') {
             // 2 players only
        }

        setData(prev => ({
            ...prev,
            bracket: { rounds, players: tournamentPlayers }
        }));
    };
    
    const handleSetMatchWinner = (roundIndex: number, matchIndex: number, clickedPlayerId: string) => {
        setData(prev => {
            if (!prev.bracket) return prev;
            const newBracket = JSON.parse(JSON.stringify(prev.bracket)) as TournamentBracket;
            
            const match = newBracket.rounds[roundIndex].matches[matchIndex];
            const newWinnerId = match.winnerId === clickedPlayerId ? null : clickedPlayerId;
            match.winnerId = newWinnerId;
    
            // Reset subsequent rounds
            for (let rIdx = roundIndex + 1; rIdx < newBracket.rounds.length; rIdx++) {
                for (let mIdx = 0; mIdx < newBracket.rounds[rIdx].matches.length; mIdx++) {
                    const currentMatch = newBracket.rounds[rIdx].matches[mIdx];
                    currentMatch.players = [null, null];
                    currentMatch.winnerId = null;
                }
            }
            
            // Advance winners/losers
            for (let rIdx = roundIndex; rIdx < newBracket.rounds.length - 1; rIdx++) {
                const currentRound = newBracket.rounds[rIdx];
                const nextRound = newBracket.rounds[rIdx + 1];
    
                if ((currentRound.title === '4강전' || currentRound.title === '준결승') && nextRound.title.includes('결승')) {
                     const semi1 = currentRound.matches[0];
                     const semi2 = currentRound.matches[1];
                     const finalMatch = nextRound.matches[0];
                     const thirdPlaceMatch = nextRound.matches[1];
    
                     const winner1 = semi1.winnerId ? newBracket.players.find(p => p.studentId === semi1.winnerId) : null;
                     const loser1Player = semi1.players.find(p => p && p !== 'BYE' && p.studentId !== semi1.winnerId);
                     const loser1 = loser1Player ? newBracket.players.find(p => p.studentId === (loser1Player as TournamentPlayer).studentId) : null;
    
                     const winner2 = semi2.winnerId ? newBracket.players.find(p => p.studentId === semi2.winnerId) : null;
                     const loser2Player = semi2.players.find(p => p && p !== 'BYE' && p.studentId !== semi2.winnerId);
                     const loser2 = loser2Player ? newBracket.players.find(p => p.studentId === (loser2Player as TournamentPlayer).studentId) : null;
    
                     finalMatch.players[0] = winner1 || null;
                     finalMatch.players[1] = winner2 || null;
                     if (thirdPlaceMatch) {
                        thirdPlaceMatch.players[0] = loser1 || null;
                        thirdPlaceMatch.players[1] = loser2 || null;
                     }
                } else {
                     for (let mIdx = 0; mIdx < currentRound.matches.length; mIdx++) {
                        const winnerId = currentRound.matches[mIdx].winnerId;
                        if (winnerId) {
                            const winner = newBracket.players.find(p => p.studentId === winnerId);
                            const nextMatchIndex = Math.floor(mIdx / 2);
                            const playerSlot = mIdx % 2;
                            if (nextRound.matches[nextMatchIndex]) {
                                nextRound.matches[nextMatchIndex].players[playerSlot] = winner || null;
                            }
                        }
                    }
                }
            }
            return { ...prev, bracket: newBracket };
        });
    };

    const handleResetBracket = () => {
         setConfirmation({
            message: "정말 대진표를 초기화하시겠습니까? 모든 경기 결과가 사라집니다.",
            actions: [
                { text: '취소', onClick: () => setConfirmation(null) },
                {
                    text: '초기화', className: 'danger', onClick: () => {
                        setData(prev => ({ ...prev, bracket: null }));
                        setConfirmation(null);
                    }
                }
            ]
        });
    };
    
    const handleAwardPrizes = (prizes: { champion: number, runnerUp: number, semiFinalist: number, participant: number }) => {
        if (!bracketData) return;
        
        const finalRound = bracketData.rounds[bracketData.rounds.length - 1];
        const semiFinalRound = bracketData.rounds.find(r => r.title === '4강전' || r.title === '준결승');
        
        const championId = finalRound.matches[0].winnerId;
        const runnerUpPlayer = finalRound.matches[0].players.find(p => p && p !== 'BYE' && p.studentId !== championId);
        const runnerUpId = runnerUpPlayer ? (runnerUpPlayer as TournamentPlayer).studentId : null;
        
        let semiFinalistIds: string[] = [];
        if (finalRound.matches.length > 1) { // 3/4위전 존재
             const thirdPlaceId = finalRound.matches[1].winnerId;
             const fourthPlacePlayer = finalRound.matches[1].players.find(p => p && p !== 'BYE' && p.studentId !== thirdPlaceId);
             const fourthPlaceId = fourthPlacePlayer ? (fourthPlacePlayer as TournamentPlayer).studentId : null;
             if (thirdPlaceId) semiFinalistIds.push(thirdPlaceId);
             if (fourthPlaceId) semiFinalistIds.push(fourthPlaceId);
        } else if (semiFinalRound) {
            semiFinalistIds = semiFinalRound.matches.flatMap(m => m.players)
                .filter((p): p is TournamentPlayer => !!(p && p !== 'BYE' && p.studentId !== championId && p.studentId !== runnerUpId))
                .map(p => p.studentId);
        }

        const prizewinners = new Set([championId, runnerUpId, ...semiFinalistIds]);
        const participantsWithPrize = bracketData.players.filter(p => !prizewinners.has(p.studentId));
        
        if (championId && prizes.champion > 0) onBulkAddTransaction([championId], '토너먼트 우승', prizes.champion);
        if (runnerUpId && prizes.runnerUp > 0) onBulkAddTransaction([runnerUpId], '토너먼트 준우승', prizes.runnerUp);
        if (semiFinalistIds.length > 0 && prizes.semiFinalist > 0) onBulkAddTransaction(semiFinalistIds, '토너먼트 3-4위', prizes.semiFinalist);
        if (participantsWithPrize.length > 0 && prizes.participant > 0) {
            onBulkAddTransaction(participantsWithPrize.map(p=>p.studentId), '토너먼트 참가상', prizes.participant);
        }
        
        setIsPrizeModalOpen(false);
        alert('시상이 완료되었습니다.');
    };

    if (!bracketData) {
        return (
            <div className="tournament-bracket-view" style={{ textAlign: 'center', padding: '3rem' }}>
                <div style={{marginBottom: '1.5rem'}}>
                    <button className="btn" onClick={onOpenPlayerManagement}>선수 관리</button>
                </div>
                <p style={{ marginBottom: '1rem' }}>대진표가 없습니다. '선수 관리'에서 참가자를 선택하고 대진표를 생성해주세요.</p>
                <div style={{display: 'flex', justifyContent: 'center', gap: '1rem'}}>
                     <button className="btn primary" onClick={handleGenerateBracket} disabled={(bracketParticipantIds || []).length < 2}>대진표 생성</button>
                </div>
            </div>
        );
    }
    
    const isFinished = bracketData.rounds[bracketData.rounds.length - 1].matches.every(m => m.winnerId);
    const firstRoundCount = bracketData.rounds[0]?.matches.length ?? 0;
    const useBracketTabs = firstRoundCount >= 8 && bracketData.players.length >= 16;
    const [bracketTab, setBracketTab] = useState(0);

    const renderBracketBody = () => {
        const rounds = bracketData.rounds;
        if (useBracketTabs) {
            const half = Math.ceil(firstRoundCount / 2);
            const tabs = [
                { label: `1~${half}경기`, roundFilter: (ri: number, mi: number) => ri === 0 ? mi < half : true },
                { label: `${half + 1}~${firstRoundCount}경기`, roundFilter: (ri: number, mi: number) => ri === 0 ? mi >= half : true }
            ];
            const t = tabs[Math.min(bracketTab, tabs.length - 1)];
            return (
                <>
                    <div className="group-tab-buttons" style={{ marginBottom: '1rem' }}>
                        {tabs.map((tab, i) => (
                            <button key={i} className={`tab-btn ${bracketTab === i ? 'active' : ''}`} onClick={() => setBracketTab(i)}>{tab.label}</button>
                        ))}
                    </div>
                    <BracketTree
                        rounds={rounds}
                        roundFilter={t.roundFilter}
                        handleSetMatchWinner={handleSetMatchWinner}
                    />
                </>
            );
        }
        return <BracketTree rounds={rounds} handleSetMatchWinner={handleSetMatchWinner} />;
    };

    return (
        <div className="tournament-bracket-view">
             <div className="bracket-controls">
                <button className="btn" onClick={onOpenPlayerManagement}>선수 관리</button>
                <button className="btn" onClick={() => setIsPrizeModalOpen(true)} disabled={!isFinished}>결과 및 시상</button>
                <button className="btn danger" onClick={handleResetBracket}>대진표 초기화</button>
            </div>
            <div className="bracket-wrapper">
                {renderBracketBody()}
            </div>
            {isFinished && <TournamentWinnerDisplay bracketData={bracketData} students={students} />}
            {isPrizeModalOpen && <TournamentPrizeModal isOpen={isPrizeModalOpen} onClose={() => setIsPrizeModalOpen(false)} settings={settings} onAwardPrizes={handleAwardPrizes} />}
            {confirmation && <ConfirmationModal {...confirmation} onClose={() => setConfirmation(null)} />}
        </div>
    );
};
