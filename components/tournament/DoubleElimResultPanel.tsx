
import React from 'react';
import type { Student, DoubleElimData } from '../../types';

interface DoubleElimResultPanelProps {
    doubleElim: DoubleElimData | null | undefined;
    students: Student[];
    isFinished: boolean;
    onOpenPrizeModal?: () => void;
}

export const DoubleElimResultPanel = ({ doubleElim, students, isFinished, onOpenPrizeModal }: DoubleElimResultPanelProps) => {
    if (!doubleElim || !doubleElim.grandFinal) {
        return (
            <div className="bracket-result-panel">
                <div className="bracket-result-box bracket-result-placeholder">
                    <div className="bracket-result-crown" aria-hidden>🏆</div>
                    <h3 className="bracket-result-title">최종 결과</h3>
                    <p className="bracket-result-message">대진표를 생성하면<br />결과가 여기에 표시됩니다</p>
                </div>
            </div>
        );
    }
    if (!isFinished) {
        return (
            <div className="bracket-result-panel">
                <div className="bracket-result-box bracket-result-placeholder">
                    <div className="bracket-result-crown" aria-hidden>🏆</div>
                    <h3 className="bracket-result-title">최종 결과</h3>
                    <p className="bracket-result-message">경기가 종료되면<br />우승·준우승·3·4위가 표시됩니다</p>
                </div>
            </div>
        );
    }

    const gf = doubleElim.grandFinal;
    const championId = gf.winnerId;
    const champion = championId ? students.find(s => s.id === championId) ?? null : null;
    const runnerUpId = gf.players.find(p => p && p !== 'BYE' && p !== championId) as string | undefined;
    const runnerUp = runnerUpId ? students.find(s => s.id === runnerUpId) ?? null : null;

    const lastLR = doubleElim.losersRounds[doubleElim.losersRounds.length - 1];
    const lbFinalMatch = lastLR?.matches[0];
    const thirdId = lbFinalMatch
        ? (lbFinalMatch.players.find(p => p && p !== 'BYE' && p !== lbFinalMatch.winnerId) as string | undefined)
        : undefined;
    const thirdPlace = thirdId ? students.find(s => s.id === thirdId) ?? null : null;

    const lastWR = doubleElim.winnersRounds[doubleElim.winnersRounds.length - 1];
    const wbFinalMatch = lastWR?.matches[0];
    const wbLoserId = wbFinalMatch?.winnerId
        ? (wbFinalMatch.players.find(p => p && p !== 'BYE' && p !== wbFinalMatch.winnerId) as string | undefined)
        : undefined;
    const top3Ids = new Set([championId, runnerUpId, thirdId].filter(Boolean));
    const fourthPlace = wbLoserId && !top3Ids.has(wbLoserId) ? students.find(s => s.id === wbLoserId) ?? null : null;

    return (
        <div className="bracket-result-panel">
            <div className="bracket-result-box bracket-result-filled">
                <div className="bracket-result-glow" aria-hidden />
                <h3 className="bracket-result-title">최종 결과</h3>
                <div className="bracket-result-rows">
                    {champion && <div className="bracket-result-row rank-1"><span className="bracket-result-icon" aria-hidden>🥇</span><span className="bracket-result-text">우승 {champion.name} <span className="bracket-result-meta">({champion.rank})</span></span></div>}
                    {runnerUp && <div className="bracket-result-row rank-2"><span className="bracket-result-icon" aria-hidden>🥈</span><span className="bracket-result-text">준우승 {runnerUp.name} <span className="bracket-result-meta">({runnerUp.rank})</span></span></div>}
                    {thirdPlace && <div className="bracket-result-row rank-3"><span className="bracket-result-icon" aria-hidden>🥉</span><span className="bracket-result-text">3위 {thirdPlace.name} <span className="bracket-result-meta">({thirdPlace.rank})</span></span></div>}
                    {fourthPlace && <div className="bracket-result-row rank-4"><span className="bracket-result-icon" aria-hidden>4</span><span className="bracket-result-text">4위 {fourthPlace.name} <span className="bracket-result-meta">({fourthPlace.rank})</span></span></div>}
                </div>
                <div className="bracket-result-actions">
                    {onOpenPrizeModal && <button type="button" className="btn primary" onClick={onOpenPrizeModal}>결과 및 시상</button>}
                </div>
            </div>
        </div>
    );
};
