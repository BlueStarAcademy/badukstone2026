
import React from 'react';
import type { TournamentData, TournamentSettings } from '../../types';
import {
    calculateRelayTeamScores,
    findRelayMvp,
} from '../../utils/tournament/relayScoring';

interface TournamentSummaryProps {
    data: TournamentData;
    settings: TournamentSettings;
    onApplyPenalty?: (teamName: 'A' | 'B') => void;
    onApplyBonus?: (teamName: 'A' | 'B') => void;
    onOpenContribution?: () => void;
}

export const TournamentSummary = ({
    data,
    settings,
    onApplyPenalty,
    onApplyBonus,
    onOpenContribution,
}: TournamentSummaryProps) => {
    const teamA = data.teams.find(t => t.name === 'A');
    const teamB = data.teams.find(t => t.name === 'B');

    if (!teamA || !teamB) {
        return { element: <div>팀 정보가 없습니다.</div>, winner: null, mvp: null };
    }

    const scoresA = calculateRelayTeamScores(teamA, teamB, settings);
    const scoresB = calculateRelayTeamScores(teamB, teamA, settings);

    const isFinished = settings.games.filter(g => g !== 'none').every((game) => {
        const gameKeyMap = {
            'game1': 'game1Result',
            'game2': 'game2Score',
            'game3': 'game3Score',
        } as const;
        const key = gameKeyMap[game];
        return [...teamA.players, ...teamB.players].every(p => p[key] !== null);
    });
    
    const winner = isFinished ? (scoresA.totalScore > scoresB.totalScore ? 'A' : scoresA.totalScore < scoresB.totalScore ? 'B' : 'Draw') : null;
    const mvp = isFinished ? findRelayMvp([teamA, teamB], settings) : null;

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
                            <p className="bonus-info">보너스: +{scoresA.bonusPoints}</p>
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
                            <p className="bonus-info">보너스: +{scoresB.bonusPoints}</p>
                        )}
                    </div>
                     {winner === 'B' && <div className="winner-badge">WINNER</div>}
                </div>
            </div>

             <div className="summary-details">
                <h4 className="summary-details-title">GAME STATS</h4>
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

            {onOpenContribution && (
                <div className="summary-contribution-action">
                    <button type="button" className="btn primary summary-contribution-btn" onClick={onOpenContribution}>
                        팀 기여도
                    </button>
                    {mvp && (
                        <p className="summary-contribution-hint">
                            MVP: {mvp.name} ({mvp.rank})
                        </p>
                    )}
                </div>
            )}
        </div>
    );
    return { element, winner, mvp };
};
