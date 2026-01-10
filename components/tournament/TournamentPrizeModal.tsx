import React, { useState, useEffect } from 'react';
import type { TournamentSettings } from '../../types';

interface TournamentPrizeModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: TournamentSettings;
    onAwardPrizes: (prizes: { champion: number, runnerUp: number, semiFinalist: number, participant: number }) => void;
}

export const TournamentPrizeModal = ({ isOpen, onClose, settings, onAwardPrizes }: TournamentPrizeModalProps) => {
    const [prizes, setPrizes] = useState({
        champion: settings.championPrize,
        runnerUp: settings.runnerUpPrize,
        semiFinalist: settings.semiFinalistPrize,
        participant: settings.participantPrize,
    });

    useEffect(() => {
        setPrizes({
            champion: settings.championPrize,
            runnerUp: settings.runnerUpPrize,
            semiFinalist: settings.semiFinalistPrize,
            participant: settings.participantPrize,
        });
    }, [settings, isOpen]);

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
                <h2>토너먼트 결과 시상</h2>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                         <div className="settings-form-section">
                            <div className="settings-form-row">
                                <div className="label-group"><label htmlFor="prize-champion">우승</label></div>
                                <div className="input-group">
                                    <input id="prize-champion" type="number" value={prizes.champion} onChange={e => handleChange('champion', e.target.value)} placeholder="100" />
                                    <span>스톤</span>
                                </div>
                            </div>
                             <div className="settings-form-row">
                                <div className="label-group"><label htmlFor="prize-runnerUp">준우승</label></div>
                                <div className="input-group">
                                    <input id="prize-runnerUp" type="number" value={prizes.runnerUp} onChange={e => handleChange('runnerUp', e.target.value)} placeholder="50" />
                                     <span>스톤</span>
                                </div>
                            </div>
                            <div className="settings-form-row">
                                <div className="label-group"><label htmlFor="prize-semiFinalist">3-4위</label></div>
                                <div className="input-group">
                                    <input id="prize-semiFinalist" type="number" value={prizes.semiFinalist} onChange={e => handleChange('semiFinalist', e.target.value)} placeholder="25" />
                                     <span>스톤</span>
                                </div>
                            </div>
                             <div className="settings-form-row">
                                <div className="label-group"><label htmlFor="prize-participant">참가상</label></div>
                                <div className="input-group">
                                    <input id="prize-participant" type="number" value={prizes.participant} onChange={e => handleChange('participant', e.target.value)} placeholder="10" />
                                     <span>스톤</span>
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