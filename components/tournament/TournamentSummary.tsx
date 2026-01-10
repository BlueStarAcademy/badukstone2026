
import React from 'react';
import type { TournamentData, TournamentSettings, TournamentPlayer, Team } from '../../types';
import { parseRank } from '../../utils';

interface TournamentSummaryProps {
    data: TournamentData;
    settings: TournamentSettings;
    onApplyPenalty?: (teamName: 'A' | 'B') => void;
    onApplyBonus?: (teamName: 'A' | 'B') => void;
}

const calculateTeamScores = (team: Team, settings: TournamentSettings) => {
    let game1Score = 0;
    let game2Score = 0;
    let game3Score = 0;

    team.players.forEach(p => {
        if (p.game1Result !== null) game1Score += p.game1Result;
        if (p.game2Score !== null) {
            game2Score += p.game2Score * settings.game2StoneValue;
            if (p.game2LastStone) game2Score += settings.game2LastStoneBonus;
        }
        if (p.game3Score !== null) game3Score += p.game3Score * settings.game3StoneValue;
    });

    const penaltyDeduction = (team.mannerPenalties || 0) * (settings.relayMannerPenalty || 0);
    const bonusPoints = team.bonusScore || 0;
    const totalScore = game1Score + game2Score + game3Score - penaltyDeduction + bonusPoints;
    
    return { totalScore, game1Score, game2Score, game3Score, penaltyDeduction, bonusPoints };
};

const findMvp = (teams: Team[], settings: TournamentSettings): TournamentPlayer | null => {
    const allPlayers = teams.flatMap(t => t.players);
    if(allPlayers.length === 0) return null;

    let mvp: TournamentPlayer | null = null;
    let maxScore = -Infinity;

    allPlayers.forEach(p => {
        let playerScore = 0;
        if (p.game1Result !== null) playerScore += p.game1Result;
        if (p.game2Score !== null) {
             playerScore += p.game2Score * settings.game2StoneValue;
            if (p.game2LastStone) playerScore += settings.game2LastStoneBonus;
        }
        if (p.game3Score !== null) playerScore += p.game3Score * settings.game3StoneValue;
        
        if (playerScore > maxScore) {
            maxScore = playerScore;
            mvp = p;
        }
    });

    return mvp;
}

export const TournamentSummary = ({ data, settings, onApplyPenalty, onApplyBonus }: TournamentSummaryProps) => {
    const teamA = data.teams.find(t => t.name === 'A');
    const teamB = data.teams.find(t => t.name === 'B');

    if (!teamA || !teamB) {
        return { element: <div>팀 정보가 없습니다.</div>, winner: null };
    }

    const scoresA = calculateTeamScores(teamA, settings);
    const scoresB = calculateTeamScores(teamB, settings);

    const isFinished = settings.games.filter(g => g !== 'none').every((game, index) => {
        const gameKeyMap = {
            'game1': 'game1Result',
            'game2': 'game2Score',
            'game3': 'game3Score',
        } as const;
        const key = gameKeyMap[game];
        return [...teamA.players, ...teamB.players].every(p => p[key] !== null);
    });
    
    const winner = isFinished ? (scoresA.totalScore > scoresB.totalScore ? 'A' : scoresA.totalScore < scoresB.totalScore ? 'B' : 'Draw') : null;
    const mvp = isFinished ? findMvp([teamA, teamB], settings) : null;

    const maxTotalGameScore = Math.max(1, scoresA.game1Score + scoresB.game1Score, scoresA.game2Score + scoresB.game2Score, scoresA.game3Score + scoresB.game3Score);
    
    const element = (
        <div className="summary-container">
             <h3 className="summary-header">SCOREBOARD</h3>
            <div className="summary-box">
                <div className={`summary-team-score team-a ${winner === 'A' ? 'winner' : ''}`}>
                    <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px'}}>
                        <h3>TEAM A</h3>
                        <div style={{display: 'flex', gap: '2px'}}>
                            {onApplyBonus && <button className="btn-xs success" onClick={() => onApplyBonus('A')} title="보너스 점수">+</button>}
                            {onApplyPenalty && <button className="btn-xs danger" onClick={() => onApplyPenalty('A')} title="매너 감점">-</button>}
                        </div>
                    </div>
                    <p className="total-score">{scoresA.totalScore}</p>
                    <div className="summary-adjustment-info" style={{fontSize: '0.8rem', opacity: 0.9}}>
                        {scoresA.penaltyDeduction > 0 && (
                            <p className="penalty-info" style={{margin: '2px 0'}}>감점: -{scoresA.penaltyDeduction}</p>
                        )}
                        {scoresA.bonusPoints > 0 && (
                            <p className="bonus-info" style={{margin: '2px 0', color: '#81c784', fontWeight: 'bold'}}>보너스: +{scoresA.bonusPoints}</p>
                        )}
                    </div>
                    {winner === 'A' && <div className="winner-badge">WINNER</div>}
                </div>
                <div className="summary-center-info">
                    VS
                </div>
                <div className={`summary-team-score team-b ${winner === 'B' ? 'winner' : ''}`}>
                     <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '5px'}}>
                        <h3>TEAM B</h3>
                        <div style={{display: 'flex', gap: '2px'}}>
                            {onApplyBonus && <button className="btn-xs success" onClick={() => onApplyBonus('B')} title="보너스 점수">+</button>}
                            {onApplyPenalty && <button className="btn-xs danger" onClick={() => onApplyPenalty('B')} title="매너 감점">-</button>}
                        </div>
                    </div>
                    <p className="total-score">{scoresB.totalScore}</p>
                    <div className="summary-adjustment-info" style={{fontSize: '0.8rem', opacity: 0.9}}>
                        {scoresB.penaltyDeduction > 0 && (
                            <p className="penalty-info" style={{margin: '2px 0'}}>감점: -{scoresB.penaltyDeduction}</p>
                        )}
                        {scoresB.bonusPoints > 0 && (
                            <p className="bonus-info" style={{margin: '2px 0', color: '#81c784', fontWeight: 'bold'}}>보너스: +{scoresB.bonusPoints}</p>
                        )}
                    </div>
                     {winner === 'B' && <div className="winner-badge">WINNER</div>}
                </div>
            </div>

             <div className="summary-details">
                <h4 style={{textAlign: 'center', marginBottom: '1rem', color: '#cfd8dc'}}>GAME STATS</h4>
                <div className="game-score-row">
                    <span>바둑</span>
                    <div className="score-bar-container">
                        <div className="score-bar team-a" style={{ width: `${(scoresA.game1Score / maxTotalGameScore) * 100}%` }}>{scoresA.game1Score}</div>
                        <div className="score-bar team-b" style={{ width: `${(scoresB.game1Score / maxTotalGameScore) * 100}%` }}>{scoresB.game1Score}</div>
                    </div>
                </div>
                <div className="game-score-row">
                    <span>주사위</span>
                    <div className="score-bar-container">
                        <div className="score-bar team-a" style={{ width: `${(scoresA.game2Score / maxTotalGameScore) * 100}%` }}>{scoresA.game2Score}</div>
                        <div className="score-bar team-b" style={{ width: `${(scoresB.game2Score / maxTotalGameScore) * 100}%` }}>{scoresB.game2Score}</div>
                    </div>
                </div>
                <div className="game-score-row">
                    <span>컬링</span>
                     <div className="score-bar-container">
                        <div className="score-bar team-a" style={{ width: `${(scoresA.game3Score / maxTotalGameScore) * 100}%` }}>{scoresA.game3Score}</div>
                        <div className="score-bar team-b" style={{ width: `${(scoresB.game3Score / maxTotalGameScore) * 100}%` }}>{scoresB.game3Score}</div>
                    </div>
                </div>
            </div>

            {mvp && (
                <div style={{marginTop: '2rem', textAlign: 'center', padding: '1rem', background: 'rgba(255,215,0,0.2)', borderRadius: '8px', border: '1px solid gold'}}>
                    <h4 style={{color: 'gold', marginBottom: '0.5rem'}}>🏆 대회 MVP 🏆</h4>
                    <p style={{fontSize: '1.2rem', fontWeight: 'bold'}}>{mvp.name} <small>({mvp.rank})</small></p>
                </div>
            )}
        </div>
    );
    return { element, winner };
};
