
import React from 'react';
// FIX: Corrected import path for type definitions.
import type { EventSettings } from '../../types';

interface EventSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: EventSettings;
    onUpdateSettings: React.Dispatch<React.SetStateAction<EventSettings>>;
}

export const EventSettingsModal = ({ isOpen, onClose, settings, onUpdateSettings }: EventSettingsModalProps) => {
    if (!isOpen) return null;

    const prizeOrder: (keyof EventSettings['gachaPrizes'])[] = ['first', 'second', 'third', 'fourth', 'fifth'];

    const handleEventSettingChange = <K extends keyof EventSettings>(field: K, value: EventSettings[K]) => {
        onUpdateSettings(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleGachaPrizeChange = (key: keyof EventSettings['gachaPrizes'], value: string) => {
        onUpdateSettings(prev => ({
            ...prev,
            gachaPrizes: {
                ...prev.gachaPrizes,
                [key]: parseInt(value, 10) || 0
            }
        }));
    };
    
    const handleGachaPrizeCountChange = (key: keyof EventSettings['gachaPrizeCounts'], value: string) => {
        const newCounts = { ...settings.gachaPrizeCounts, [key]: parseInt(value, 10) || 0 };
        
        const keys: (keyof EventSettings['gachaPrizeCounts'])[] = ['first', 'second', 'third', 'fourth'];
        // FIX: Explicitly cast to number to fix arithmetic errors with unknown/symbol types.
        const totalOfOthers = keys.reduce((sum, k) => sum + (newCounts[k] as number || 0), 0);

        if (totalOfOthers > 100) {
            const overage = totalOfOthers - 100;
            newCounts[key] -= overage;
            newCounts.fifth = 0;
        } else {
            newCounts.fifth = 100 - totalOfOthers;
        }

        onUpdateSettings(prev => ({
            ...prev,
            gachaPrizeCounts: newCounts
        }));
    };
    
    // FIX: Cast Object.values results to number array to ensure valid reduce behavior and avoid symbol-related errors.
    const totalGachaCount = (Object.values(settings.gachaPrizeCounts) as number[]).reduce((a, b) => a + b, 0);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
                <h2>이벤트 설정</h2>
                <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', padding: '0 1rem' }}>
                    <div className="settings-form-section">
                        <h3>공통 설정</h3>
                        <div className="settings-form-row">
                            <div className="label-group">
                                <label htmlFor="minMissionsToSpin">이벤트 참여 최소 미션 횟수</label>
                                <p>한 달 동안 이 횟수만큼 미션을 완료해야 이벤트에 참여할 수 있습니다.</p>
                            </div>
                            <div className="input-group">
                                <input
                                    type="number"
                                    id="minMissionsToSpin"
                                    value={settings.minMissionsToSpin}
                                    onChange={(e) => handleEventSettingChange('minMissionsToSpin', parseInt(e.target.value, 10) || 0)}
                                    min="1"
                                />
                                <span>회</span>
                            </div>
                        </div>
                        <div className="settings-form-row">
                            <div className="label-group">
                                <label htmlFor="maxPenalties">이벤트 참여 불가 감점 횟수</label>
                                <p>한 달 동안 감점(예절 불량 등) 횟수가 이 값 이상이면 이벤트에 참여할 수 없습니다.</p>
                            </div>
                            <div className="input-group">
                                <input
                                    type="number"
                                    id="maxPenalties"
                                    value={settings.maxPenalties ?? 3} // Default to 3 if undefined
                                    onChange={(e) => handleEventSettingChange('maxPenalties', parseInt(e.target.value, 10) || 0)}
                                    min="1"
                                />
                                <span>회</span>
                            </div>
                        </div>
                    </div>

                    <div className="settings-form-section">
                        <h3>뽑기 이벤트 보상 설정 (총 100개)</h3>
                         <div className="settings-form-row" style={{paddingBottom: '0.5rem'}}>
                            <div className="label-group" style={{fontWeight: 'bold'}}>등수</div>
                            <div className="input-group" style={{fontWeight: 'bold', justifyContent: 'space-around'}}>
                                <span>보상 (스톤)</span>
                                <span>개수</span>
                            </div>
                        </div>
                         {prizeOrder.map((key, index) => (
                            <div key={String(key)} className="settings-form-row">
                                <div className="label-group">
                                    {/* FIX: Explicitly convert key to string to avoid implicit symbol conversion warnings. */}
                                    <label htmlFor={`gacha-prize-${String(key)}`}>{index + 1}등</label>
                                </div>
                                <div className="input-group" style={{gap: '1rem', justifyContent: 'space-around'}}>
                                    <input
                                        type="number"
                                        id={`gacha-prize-${String(key)}`}
                                        value={settings.gachaPrizes[key]}
                                        onChange={(e) => handleGachaPrizeChange(key, e.target.value)}
                                        min="0"
                                        style={{width: '100px'}}
                                    />
                                     <input
                                        type="number"
                                        id={`gacha-count-${String(key)}`}
                                        value={settings.gachaPrizeCounts[key]}
                                        onChange={(e) => handleGachaPrizeCountChange(key, e.target.value)}
                                        min="0"
                                        readOnly={key === 'fifth'}
                                        style={{width: '100px'}}
                                    />
                                </div>
                            </div>
                        ))}
                         <div className="settings-form-row" style={{borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', marginTop: '0.5rem'}}>
                            <div className="label-group" style={{fontWeight: 'bold'}}>합계</div>
                            <div className="input-group" style={{fontWeight: 'bold', justifyContent: 'flex-end', paddingRight: '1rem'}}>
                                <span>{totalGachaCount} 개</span>
                            </div>
                        </div>
                        {totalGachaCount !== 100 && <p className="login-error" style={{textAlign: 'center', marginTop: '1rem'}}>경고: 상품 총 개수가 100개가 아닙니다. 설정을 확인해주세요.</p>}
                    </div>
                </div>
                <div className="modal-actions">
                    <button type="button" className="btn primary" onClick={onClose}>닫기</button>
                </div>
            </div>
        </div>
    );
};
