import React from 'react';
import type { GeneralSettings } from '../../types';

interface ChessSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: GeneralSettings;
    onUpdateSettings: (newSettings: GeneralSettings) => void;
}

export const ChessSettingsModal = ({ isOpen, onClose, settings, onUpdateSettings }: ChessSettingsModalProps) => {
    if (!isOpen) return null;

    const handleChange = (field: keyof GeneralSettings, value: string) => {
        const newSettings = {
            ...settings,
            [field]: parseInt(value, 10) || 0,
        };
        onUpdateSettings(newSettings);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h2>체스반 설정</h2>
                <div className="modal-body">
                    <div className="settings-form-section">
                        <div className="settings-form-row">
                            <div className="label-group">
                                <label htmlFor="chess-attendance-stones">출석 보상 스톤</label>
                                <p>체스반 학생이 출석할 때마다 지급되는 스톤 개수입니다.</p>
                            </div>
                            <div className="input-group">
                                <input
                                    type="number"
                                    id="chess-attendance-stones"
                                    value={settings.chessAttendanceValue || 0}
                                    onChange={(e) => handleChange('chessAttendanceValue', e.target.value)}
                                    min="0"
                                    placeholder="5"
                                />
                                <span>스톤</span>
                            </div>
                        </div>
                        <div className="settings-form-row">
                            <div className="label-group">
                                <label htmlFor="elo-k-factor">ELO K-Factor</label>
                                <p>레이팅 변동폭을 결정하는 상수입니다. 높을수록 변동이 큽니다. (일반적으로 10~40)</p>
                            </div>
                            <div className="input-group">
                                <input
                                    type="number"
                                    id="elo-k-factor"
                                    value={settings.eloKFactor || 32}
                                    onChange={(e) => handleChange('eloKFactor', e.target.value)}
                                    min="1"
                                    placeholder="32"
                                />
                            </div>
                        </div>
                        <div className="settings-form-row">
                            <div className="label-group">
                                <label htmlFor="non-chess-player-rating">비체스반 초기 레이팅</label>
                                <p>체스반 소속이 아닌 상대(온라인 등)와의 대국 기록 시 사용될 기본 레이팅입니다.</p>
                            </div>
                            <div className="input-group">
                                <input
                                    type="number"
                                    id="non-chess-player-rating"
                                    value={settings.nonChessPlayerRating || 1000}
                                    onChange={(e) => handleChange('nonChessPlayerRating', e.target.value)}
                                    min="0"
                                    placeholder="1000"
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="modal-actions">
                    <button type="button" className="btn primary" onClick={onClose}>닫기</button>
                </div>
            </div>
        </div>
    );
};