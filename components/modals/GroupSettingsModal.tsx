
import React, { useState, useEffect } from 'react';
import type { GroupSettings, GeneralSettings } from '../../types';

interface GroupSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    groupSettings: GroupSettings;
    generalSettings: GeneralSettings;
    onUpdateGroupSettings: (newSettings: GroupSettings) => void;
    onUpdateGeneralSettings: (newSettings: GeneralSettings) => void;
}

const DragHandle = () => (
    <svg className="drag-handle" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ cursor: 'grab', color: '#999' }}>
        <path d="M9 4V6m0 2V10m0 2v2m0 2v2m6-12V6m0 2V10m0 2v2m0 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);


export const GroupSettingsModal = ({ isOpen, onClose, groupSettings, generalSettings, onUpdateGroupSettings, onUpdateGeneralSettings }: GroupSettingsModalProps) => {
    const [draggedGroup, setDraggedGroup] = useState<string | null>(null);
    const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);

    useEffect(() => {
        // Sync groupOrder with groupSettings keys if they are out of sync.
        const settingsKeys = Object.keys(groupSettings);
        const orderKeys = generalSettings.groupOrder || [];
        
        const newKeysInSettings = settingsKeys.filter(k => !orderKeys.includes(k));
        const validOrderFromKeys = orderKeys.filter(k => settingsKeys.includes(k));
        
        if (newKeysInSettings.length > 0 || validOrderFromKeys.length !== orderKeys.length) {
            onUpdateGeneralSettings({
                ...generalSettings,
                groupOrder: [...validOrderFromKeys, ...newKeysInSettings]
            });
        }
    }, [groupSettings, generalSettings, onUpdateGeneralSettings]);


    if (!isOpen) return null;

    const handleGroupSettingChange = (group: string, field: 'name' | 'maxStones', value: string) => {
        const newSettings = { ...groupSettings };
        const currentGroup = newSettings[group];

        if (field === 'name') {
            newSettings[group] = { ...currentGroup, name: value };
        } else {
            const newMaxStones = parseInt(value, 10) || 0;
            newSettings[group] = { ...currentGroup, maxStones: newMaxStones };
        }
        onUpdateGroupSettings(newSettings);
    };

    const handleGeneralSettingChange = (field: keyof GeneralSettings, value: string) => {
        const newSettings = {
            ...generalSettings,
            [field]: parseInt(value, 10) || 0,
        };
        onUpdateGeneralSettings(newSettings);
    };

    const handleDragStart = (e: React.DragEvent, group: string) => {
        setDraggedGroup(group);
        e.dataTransfer.effectAllowed = 'move';
        // (e.currentTarget as HTMLElement).classList.add('dragging'); // Optional: Table rows handle this via CSS usually
    };

    const handleDragEnter = (e: React.DragEvent, group: string) => {
        if (draggedGroup && draggedGroup !== group) {
            setDragOverGroup(group);
        }
    };
    
    const handleDragLeave = (e: React.DragEvent) => {
        setDragOverGroup(null);
    };

    const handleDrop = (e: React.DragEvent, targetGroup: string) => {
        e.preventDefault();
        setDragOverGroup(null);
        
        if (!draggedGroup || draggedGroup === targetGroup) {
            setDraggedGroup(null);
            return;
        };

        const newOrder = [...generalSettings.groupOrder];
        const draggedIndex = newOrder.indexOf(draggedGroup);
        
        newOrder.splice(draggedIndex, 1);
        
        const targetIndex = newOrder.indexOf(targetGroup);
        newOrder.splice(targetIndex, 0, draggedGroup);

        onUpdateGeneralSettings({ ...generalSettings, groupOrder: newOrder });
        setDraggedGroup(null);
    };

    const handleDragEnd = (e: React.DragEvent) => {
        setDraggedGroup(null);
        setDragOverGroup(null);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
                <h2>그룹 및 일반 설정</h2>
                <div className="modal-body">
                    <div className="settings-section">
                        <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '0.5rem', marginBottom: '1rem', color: 'var(--secondary-color)' }}>일반 설정</h3>
                        <div className="general-settings-grid">
                            <div className="general-setting-item">
                                <label htmlFor="attendance-stones">출석 보상</label>
                                <div className="input-with-unit">
                                    <input
                                        type="number"
                                        id="attendance-stones"
                                        value={generalSettings.attendanceStoneValue}
                                        onChange={(e) => handleGeneralSettingChange('attendanceStoneValue', e.target.value)}
                                        min="0"
                                    />
                                    <span>스톤</span>
                                </div>
                                <p className="help-text">학생 출석 시 지급</p>
                            </div>
                            <div className="general-setting-item">
                                <label htmlFor="joseki-mission-stones">정석 미션 보상</label>
                                <div className="input-with-unit">
                                    <input
                                        type="number"
                                        id="joseki-mission-stones"
                                        value={generalSettings.josekiMissionValue}
                                        onChange={(e) => handleGeneralSettingChange('josekiMissionValue', e.target.value)}
                                        min="0"
                                    />
                                    <span>스톤</span>
                                </div>
                                <p className="help-text">연속 미션 완료 시 지급</p>
                            </div>
                            <div className="general-setting-item">
                                <label htmlFor="birthday-coupon-value">생일 쿠폰 지급액</label>
                                <div className="input-with-unit">
                                    <input
                                        type="number"
                                        id="birthday-coupon-value"
                                        value={generalSettings.birthdayCouponValue || 300}
                                        onChange={(e) => handleGeneralSettingChange('birthdayCouponValue', e.target.value)}
                                        min="0"
                                    />
                                    <span>스톤</span>
                                </div>
                                <p className="help-text">생일월 자동 지급 쿠폰</p>
                            </div>
                        </div>
                    </div>

                    <div className="settings-section" style={{ marginTop: '2rem' }}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem'}}>
                            <h3 style={{ margin: 0, color: 'var(--secondary-color)' }}>그룹 설정</h3>
                            <span style={{ fontSize: '0.85rem', color: '#666' }}>💡 드래그하여 순서 변경</span>
                        </div>
                        
                        <div className="table-container">
                            <table className="group-settings-table">
                                <thead>
                                    <tr>
                                        <th style={{width: '50px'}}>순서</th>
                                        <th>그룹 ID</th>
                                        <th>표시 이름</th>
                                        <th style={{width: '120px'}}>최대 스톤</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {generalSettings.groupOrder.filter(group => groupSettings[group]).map((group, index) => (
                                        <tr 
                                            key={group}
                                            draggable
                                            onDragStart={e => handleDragStart(e, group)}
                                            onDragEnter={e => handleDragEnter(e, group)}
                                            onDragLeave={handleDragLeave}
                                            onDragOver={e => e.preventDefault()}
                                            onDrop={e => handleDrop(e, group)}
                                            onDragEnd={handleDragEnd}
                                            className={`${draggedGroup === group ? 'dragging' : ''} ${dragOverGroup === group ? 'drag-over' : ''}`}
                                        >
                                            <td style={{textAlign: 'center'}}><DragHandle /></td>
                                            <td style={{color: '#666', fontSize: '0.9rem'}}>{group}</td>
                                            <td>
                                                <input
                                                    type="text"
                                                    value={groupSettings[group]?.name || ''}
                                                    onChange={(e) => handleGroupSettingChange(group, 'name', e.target.value)}
                                                    className="compact-input"
                                                />
                                            </td>
                                            <td>
                                                <div className="input-with-unit compact">
                                                    <input
                                                        type="number"
                                                        value={groupSettings[group]?.maxStones || ''}
                                                        onChange={(e) => handleGroupSettingChange(group, 'maxStones', e.target.value)}
                                                        min="0"
                                                        className="compact-input"
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
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
