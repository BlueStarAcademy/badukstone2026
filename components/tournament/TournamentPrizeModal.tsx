import React, { useState, useEffect } from 'react';
import type { TournamentSettings } from '../../types';
import type { BracketPrizeSettingsKey, TournamentBracketPrizeModalMode } from '../../utils/tournamentPrizes';
import { getBracketPrizeRow, bracketPrizeGroupCount } from '../../utils/tournamentPrizes';

interface TournamentPrizeModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: TournamentSettings;
    /** 토너먼트·풀리그·더블엘리는 bracket, 예선+본선 본선은 hybridBracket */
    prizeKey: BracketPrizeSettingsKey;
    /** 모달 제목 */
    mode: TournamentBracketPrizeModalMode;
    onAwardPrizes: (prizes: { champion: number; runnerUp: number; semiFinalist: number; participant: number }) => void;
}

const modalTitle: Record<TournamentBracketPrizeModalMode, string> = {
    bracket: '토너먼트 결과 시상',
    fullleague: '풀리그 결과 시상',
    doubleelim: '더블엘리미네이션 결과 시상',
    hybridBracket: '본선 토너먼트 결과 시상',
};

export const TournamentPrizeModal = ({
    isOpen,
    onClose,
    settings,
    prizeKey,
    mode,
    onAwardPrizes,
}: TournamentPrizeModalProps) => {
    const nGroups = bracketPrizeGroupCount(settings, prizeKey);
    const [prizeGroupIndex, setPrizeGroupIndex] = useState(0);
    const [prizes, setPrizes] = useState({
        champion: settings.championPrize,
        runnerUp: settings.runnerUpPrize,
        semiFinalist: settings.semiFinalistPrize,
        participant: settings.participantPrize,
    });

    useEffect(() => {
        if (!isOpen) return;
        setPrizeGroupIndex(0);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const row = getBracketPrizeRow(settings, prizeKey, prizeGroupIndex);
        setPrizes({
            champion: row.champion,
            runnerUp: row.runnerUp,
            semiFinalist: row.semiFinalist,
            participant: row.participant,
        });
    }, [settings, isOpen, prizeKey, prizeGroupIndex]);

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
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <h2>{modalTitle[mode]}</h2>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {nGroups > 1 && (
                            <div className="settings-form-section" style={{ marginBottom: '1rem' }}>
                                <div className="settings-form-row">
                                    <div className="label-group">
                                        <label htmlFor="prize-group-idx">적용 조</label>
                                    </div>
                                    <div className="input-group">
                                        <select
                                            id="prize-group-idx"
                                            value={prizeGroupIndex}
                                            onChange={e => setPrizeGroupIndex(Number(e.target.value))}
                                        >
                                            {Array.from({ length: nGroups }, (_, i) => (
                                                <option key={i} value={i}>
                                                    {i + 1}조 (대회 설정 기준)
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-color-secondary)', margin: 0 }}>
                                    조별로 금액이 다르면, 시상 전에 조를 선택한 뒤 금액을 확인하세요.
                                </p>
                            </div>
                        )}
                        <div className="settings-form-section">
                            <div className="settings-form-row">
                                <div className="label-group">
                                    <label htmlFor="prize-champion">우승</label>
                                </div>
                                <div className="input-group">
                                    <input
                                        id="prize-champion"
                                        type="number"
                                        value={prizes.champion}
                                        onChange={e => handleChange('champion', e.target.value)}
                                        placeholder="100"
                                    />
                                    <span>스톤</span>
                                </div>
                            </div>
                            <div className="settings-form-row">
                                <div className="label-group">
                                    <label htmlFor="prize-runnerUp">준우승</label>
                                </div>
                                <div className="input-group">
                                    <input
                                        id="prize-runnerUp"
                                        type="number"
                                        value={prizes.runnerUp}
                                        onChange={e => handleChange('runnerUp', e.target.value)}
                                        placeholder="50"
                                    />
                                    <span>스톤</span>
                                </div>
                            </div>
                            <div className="settings-form-row">
                                <div className="label-group">
                                    <label htmlFor="prize-semiFinalist">3-4위</label>
                                </div>
                                <div className="input-group">
                                    <input
                                        id="prize-semiFinalist"
                                        type="number"
                                        value={prizes.semiFinalist}
                                        onChange={e => handleChange('semiFinalist', e.target.value)}
                                        placeholder="25"
                                    />
                                    <span>스톤</span>
                                </div>
                            </div>
                            <div className="settings-form-row">
                                <div className="label-group">
                                    <label htmlFor="prize-participant">참가상</label>
                                </div>
                                <div className="input-group">
                                    <input
                                        id="prize-participant"
                                        type="number"
                                        value={prizes.participant}
                                        onChange={e => handleChange('participant', e.target.value)}
                                        placeholder="10"
                                    />
                                    <span>스톤</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="modal-actions">
                        <button type="button" className="btn" onClick={onClose}>
                            취소
                        </button>
                        <button type="submit" className="btn primary">
                            스톤 지급
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
