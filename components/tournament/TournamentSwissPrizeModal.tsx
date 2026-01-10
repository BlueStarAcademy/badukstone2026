import React, { useState, useEffect, useMemo } from 'react';
import type { TournamentSettings, SwissData } from '../../types';

interface TournamentSwissPrizeModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: TournamentSettings;
    swissData?: SwissData;
    onAwardPrizes: (prizes: { first: number, second: number, third: number, participant: number }) => void;
}

export const TournamentSwissPrizeModal = ({ isOpen, onClose, settings, swissData, onAwardPrizes }: TournamentSwissPrizeModalProps) => {
    const [prizes, setPrizes] = useState({
        first: settings.swiss1stPrize,
        second: settings.swiss2ndPrize,
        third: settings.swiss3rdPrize,
        participant: settings.participantPrize,
    });

    useEffect(() => {
        setPrizes({
            first: settings.swiss1stPrize,
            second: settings.swiss2ndPrize,
            third: settings.swiss3rdPrize,
            participant: settings.participantPrize,
        });
    }, [settings, isOpen]);

    const finalRanks = useMemo(() => {
        if (!swissData) return [];
        const sortedPlayers = [...swissData.players].sort((a, b) => b.score - a.score || b.sos - a.sos || b.sosos - a.sosos);
        if (sortedPlayers.length === 0) return [];
        
        const ranks: { name: string; rank: number; score: number, sos: number, sosos: number }[] = [];
        let currentRank = 1;
        
        for (let i = 0; i < sortedPlayers.length; i++) {
            if (i > 0) {
                const prev = sortedPlayers[i-1];
                const curr = sortedPlayers[i];
                if (curr.score < prev.score || curr.sos < prev.sos || curr.sosos < prev.sosos) {
                     currentRank = i + 1;
                }
            }
             ranks.push({ 
                name: sortedPlayers[i].name, 
                rank: currentRank, 
                score: sortedPlayers[i].score,
                sos: sortedPlayers[i].sos,
                sosos: sortedPlayers[i].sosos
            });
        }
        return ranks;
    }, [swissData]);

    if (!isOpen) return null;

    const handleChange = (field: keyof typeof prizes, value: string) => {
        setPrizes(prev => ({ ...prev, [field]: Number(value) || 0 }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onAwardPrizes(prizes);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h2>스위스 리그 결과 시상</h2>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                        <div>
                            <h4>최종 순위</h4>
                            <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '0.5rem' }}>
                                <table className="swiss-standings-table">
                                    <thead><tr><th>순위</th><th>이름</th><th>승점</th><th>SOS</th><th>SOSOS</th></tr></thead>
                                    <tbody>
                                        {finalRanks.map((p, i) => (
                                            <tr key={i}><td>{p.rank}</td><td>{p.name}</td><td>{p.score}</td><td>{p.sos}</td><td>{p.sosos}</td></tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="settings-form-section" style={{marginTop: 0}}>
                            <h4>보상 설정 (스톤)</h4>
                            <div className="settings-form-row">
                                <div className="label-group"><label htmlFor="prize-first">1위</label></div>
                                <div className="input-group">
                                    <input id="prize-first" type="number" value={prizes.first} onChange={e => handleChange('first', e.target.value)} />
                                </div>
                            </div>
                             <div className="settings-form-row">
                                <div className="label-group"><label htmlFor="prize-second">2위</label></div>
                                <div className="input-group">
                                    <input id="prize-second" type="number" value={prizes.second} onChange={e => handleChange('second', e.target.value)} />
                                </div>
                            </div>
                            <div className="settings-form-row">
                                <div className="label-group"><label htmlFor="prize-third">3위</label></div>
                                <div className="input-group">
                                    <input id="prize-third" type="number" value={prizes.third} onChange={e => handleChange('third', e.target.value)} />
                                </div>
                            </div>
                             <div className="settings-form-row">
                                <div className="label-group"><label htmlFor="prize-participant">참가상</label></div>
                                <div className="input-group">
                                    <input id="prize-participant" type="number" value={prizes.participant} onChange={e => handleChange('participant', e.target.value)} />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="modal-actions">
                        <button type="button" className="btn" onClick={onClose}>취소</button>
                        <button type="submit" className="btn primary">스톤 지급</button>
                    </div>
                </form>
            </div>
        </div>
    );
};