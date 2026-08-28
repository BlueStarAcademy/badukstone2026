
import React, { useState } from 'react';
import type {
    TournamentSettings,
    TournamentByePriority,
    MissionBadukMatchMissionDef,
    MissionBadukWearableMissionDef,
} from '../../types';
import { generateId } from '../../utils';
import {
    BracketGroupPrizesEditor,
    SwissGroupPrizesEditor,
    RelayGroupPrizesEditor,
    HybridPrelimGroupPrizesEditor,
    HybridBracketGroupPrizesEditor,
    MissionGroupPrizesEditor,
} from './TournamentGroupPrizeEditors';
import { parseSwissGroupSizes, SWISS_PAID_RANK_MAX } from '../../utils/tournamentPrizes';

interface TournamentSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: TournamentSettings;
    onUpdateSettings: React.Dispatch<React.SetStateAction<TournamentSettings>>;
    activeTab: 'relay' | 'bracket' | 'swiss' | 'hybrid' | 'fullleague' | 'doubleelim' | 'mission';
}

export const TournamentSettingsModal = ({ isOpen, onClose, settings, onUpdateSettings, activeTab }: TournamentSettingsModalProps) => {
    
    // Mission Baduk CRUD States
    const [newMatchMission, setNewMatchMission] = useState({ template: '', min: 1, max: 10, defaultStars: 3 });
    const [newWearableMission, setNewWearableMission] = useState({ text: '', stars: 1 });

    if (!isOpen) return null;

    const handleSettingChange = (field: keyof TournamentSettings, value: any) => {
        onUpdateSettings(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleGameChange = (index: number, value: string) => {
        const newGames = [...settings.games];
        newGames[index] = value as any;
        onUpdateSettings(prev => ({
            ...prev,
            games: newGames
        }));
    };

    const handleMissionBadukSettingChange = (field: keyof NonNullable<TournamentSettings['missionBaduk']>, value: any) => {
        onUpdateSettings(prev => ({
            ...prev,
            missionBaduk: {
                ...(prev.missionBaduk || {} as any),
                [field]: value
            }
        }));
    };

    const handleMissionBadukPointsChange = (field: keyof NonNullable<TournamentSettings['missionBaduk']>['points'], value: number) => {
        onUpdateSettings(prev => ({
            ...prev,
            missionBaduk: {
                ...(prev.missionBaduk || {} as any),
                points: {
                    ...(prev.missionBaduk?.points || {} as any),
                    [field]: value
                }
            }
        }));
    };

    // --- Mission Baduk CRUD Handlers ---
    const handleAddMatchMission = () => {
        if (!newMatchMission.template.trim()) {
            alert('미션 내용을 입력해주세요.');
            return;
        }
        onUpdateSettings(prev => ({
            ...prev,
            missionBaduk: {
                ...prev.missionBaduk!,
                matchMissions: [
                    ...(prev.missionBaduk?.matchMissions || []),
                    { id: generateId(), ...newMatchMission }
                ]
            }
        }));
        setNewMatchMission({ template: '', min: 1, max: 10, defaultStars: 3 });
    };

    const handleDeleteMatchMission = (id: string) => {
        onUpdateSettings(prev => ({
            ...prev,
            missionBaduk: {
                ...prev.missionBaduk!,
                matchMissions: prev.missionBaduk!.matchMissions.filter(m => m.id !== id)
            }
        }));
    };

    const handleUpdateMatchMission = (id: string, field: keyof MissionBadukMatchMissionDef, value: any) => {
        onUpdateSettings(prev => ({
            ...prev,
            missionBaduk: {
                ...prev.missionBaduk!,
                matchMissions: prev.missionBaduk!.matchMissions.map(m => m.id === id ? { ...m, [field]: value } : m)
            }
        }));
    };

    const handleAddWearableMission = () => {
        if (!newWearableMission.text.trim()) return;
        onUpdateSettings(prev => ({
            ...prev,
            missionBaduk: {
                ...prev.missionBaduk!,
                wearableMissions: [
                    ...(prev.missionBaduk?.wearableMissions || []),
                    { id: generateId(), text: newWearableMission.text.trim(), stars: newWearableMission.stars }
                ]
            }
        }));
        setNewWearableMission({ text: '', stars: 1 });
    };

    const handleDeleteWearableMission = (id: string) => {
        onUpdateSettings(prev => ({
            ...prev,
            missionBaduk: {
                ...prev.missionBaduk!,
                wearableMissions: prev.missionBaduk!.wearableMissions.filter(m => m.id !== id)
            }
        }));
    };

    const handleUpdateWearableMission = (id: string, field: keyof MissionBadukWearableMissionDef, value: any) => {
        onUpdateSettings(prev => ({
            ...prev,
            missionBaduk: {
                ...prev.missionBaduk!,
                wearableMissions: prev.missionBaduk!.wearableMissions.map(m => m.id === id ? { ...m, [field]: value } : m)
            }
        }));
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
                <h2>대회 설정 ({
                    activeTab === 'relay' ? '팀 대항전' :
                    activeTab === 'bracket' ? '토너먼트' :
                    activeTab === 'swiss' ? '스위스 리그' :
                    activeTab === 'hybrid' ? '예선+본선' :
                    activeTab === 'fullleague' ? '풀리그' :
                    activeTab === 'doubleelim' ? '더블엘리미네이션' : '미션 바둑'
                })</h2>
                <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>

                    {(activeTab === 'bracket' || activeTab === 'swiss' || activeTab === 'hybrid' || activeTab === 'doubleelim') && (
                        <div className="settings-form-section">
                            <h3>부전승 우선순위</h3>
                            <div className="settings-form-row">
                                <div className="label-group"><label htmlFor="bye-priority">모드</label></div>
                                <select
                                    id="bye-priority"
                                    value={settings.byePriority ?? 'min_byes'}
                                    onChange={e =>
                                        handleSettingChange('byePriority', e.target.value as TournamentByePriority)
                                    }
                                >
                                    <option value="min_byes">① 부전승 최소화</option>
                                    <option value="min_matches">② 시합 판수 최소화</option>
                                    <option value="max_matches">③ 시합 판수 최대화</option>
                                </select>
                            </div>
                        </div>
                    )}
                    
                    {activeTab === 'relay' && (
                        <div className="settings-form-section">
                            <h3>경기 종목 및 규칙</h3>
                            <div className="settings-form-row">
                                 <div className="label-group"><label>1경기 종목</label></div>
                                 <select value={settings.games[0]} onChange={(e) => handleGameChange(0, e.target.value)}>
                                    <option value="none">없음</option>
                                    <option value="game1">바둑</option>
                                    <option value="game2">주사위 바둑</option>
                                    <option value="game3">컬링</option>
                                </select>
                            </div>
                            <div className="settings-form-row">
                                 <div className="label-group"><label>2경기 종목</label></div>
                                 <select value={settings.games[1]} onChange={(e) => handleGameChange(1, e.target.value)}>
                                    <option value="none">없음</option>
                                    <option value="game1">바둑</option>
                                    <option value="game2">주사위 바둑</option>
                                    <option value="game3">컬링</option>
                                </select>
                            </div>
                            <div className="settings-form-row">
                                 <div className="label-group"><label>3경기 종목</label></div>
                                 <select value={settings.games[2]} onChange={(e) => handleGameChange(2, e.target.value)}>
                                    <option value="none">없음</option>
                                    <option value="game1">바둑</option>
                                    <option value="game2">주사위 바둑</option>
                                    <option value="game3">컬링</option>
                                </select>
                            </div>
                            
                            <h4>핸디캡 및 점수</h4>
                            <div className="settings-form-row">
                                <div className="label-group"><label>동급 호선 덤 (백)</label></div>
                                <div className="input-group"><input type="number" step="0.5" value={settings.game1SameRankHandicap} onChange={e => handleSettingChange('game1SameRankHandicap', Number(e.target.value))} /><span>집</span></div>
                            </div>
                            <div className="settings-form-row">
                                <div className="label-group"><label>급수차 덤 (1급수 당)</label></div>
                                <div className="input-group"><input type="number" step="0.5" value={settings.game1RankDiffHandicap} onChange={e => handleSettingChange('game1RankDiffHandicap', Number(e.target.value))} /><span>집</span></div>
                            </div>
                            <div className="settings-form-row">
                                <div className="label-group"><label>주사위 바둑 점수 (돌 1개당)</label></div>
                                <div className="input-group"><input type="number" value={settings.game2StoneValue} onChange={e => handleSettingChange('game2StoneValue', Number(e.target.value))} /><span>점</span></div>
                            </div>
                            <div className="settings-form-row">
                                <div className="label-group"><label>주사위 바둑 마지막 돌 보너스</label></div>
                                <div className="input-group"><input type="number" value={settings.game2LastStoneBonus} onChange={e => handleSettingChange('game2LastStoneBonus', Number(e.target.value))} /><span>점</span></div>
                            </div>
                            <div className="settings-form-row">
                                <div className="label-group"><label>컬링 점수 (성공 1개당)</label></div>
                                <div className="input-group"><input type="number" value={settings.game3StoneValue} onChange={e => handleSettingChange('game3StoneValue', Number(e.target.value))} /><span>점</span></div>
                            </div>
                             <div className="settings-form-row">
                                <div className="label-group"><label>예절 감점 (1회당)</label></div>
                                <div className="input-group"><input type="number" value={settings.relayMannerPenalty} onChange={e => handleSettingChange('relayMannerPenalty', Number(e.target.value))} /><span>점</span></div>
                            </div>
                            <RelayGroupPrizesEditor settings={settings} onChange={handleSettingChange} />
                        </div>
                    )}

                    {(activeTab === 'bracket' || activeTab === 'fullleague' || activeTab === 'doubleelim') && (
                        <div className="settings-form-section">
                            <h3>상금 설정 (기본값)</h3>
                            <p style={{ fontSize: '0.88rem', color: 'var(--text-color-secondary)', marginBottom: '0.75rem' }}>
                                조별 상금을 쓰지 않을 때 시상 화면에 채워지는 기본값입니다.
                            </p>
                            <div className="settings-form-row">
                                <div className="label-group"><label>우승</label></div>
                                <div className="input-group"><input type="number" value={settings.championPrize} onChange={e => handleSettingChange('championPrize', Number(e.target.value))} /><span>스톤</span></div>
                            </div>
                            <div className="settings-form-row">
                                <div className="label-group"><label>준우승</label></div>
                                <div className="input-group"><input type="number" value={settings.runnerUpPrize} onChange={e => handleSettingChange('runnerUpPrize', Number(e.target.value))} /><span>스톤</span></div>
                            </div>
                            <div className="settings-form-row">
                                <div className="label-group"><label>3-4위</label></div>
                                <div className="input-group"><input type="number" value={settings.semiFinalistPrize} onChange={e => handleSettingChange('semiFinalistPrize', Number(e.target.value))} /><span>스톤</span></div>
                            </div>
                            <div className="settings-form-row">
                                <div className="label-group"><label>참가상</label></div>
                                <div className="input-group"><input type="number" value={settings.participantPrize} onChange={e => handleSettingChange('participantPrize', Number(e.target.value))} /><span>스톤</span></div>
                            </div>
                            <BracketGroupPrizesEditor settings={settings} onChange={handleSettingChange} />
                        </div>
                    )}

                    {activeTab === 'swiss' && (
                        <div className="settings-form-section">
                            <h3>상금 설정 (기본값)</h3>
                            <div className="settings-form-row">
                                <div className="label-group"><label>1위</label></div>
                                <div className="input-group"><input type="number" value={settings.swiss1stPrize} onChange={e => handleSettingChange('swiss1stPrize', Number(e.target.value))} /><span>스톤</span></div>
                            </div>
                            <div className="settings-form-row">
                                <div className="label-group"><label>2위</label></div>
                                <div className="input-group"><input type="number" value={settings.swiss2ndPrize} onChange={e => handleSettingChange('swiss2ndPrize', Number(e.target.value))} /><span>스톤</span></div>
                            </div>
                            <div className="settings-form-row">
                                <div className="label-group"><label>3위</label></div>
                                <div className="input-group"><input type="number" value={settings.swiss3rdPrize} onChange={e => handleSettingChange('swiss3rdPrize', Number(e.target.value))} /><span>스톤</span></div>
                            </div>
                            <div className="settings-form-row">
                                <div className="label-group"><label>참가상</label></div>
                                <div className="input-group"><input type="number" value={settings.participantPrize} onChange={e => handleSettingChange('participantPrize', Number(e.target.value))} /><span>스톤</span></div>
                            </div>
                            <div className="settings-form-row">
                                <div className="label-group"><label htmlFor="swiss-paid-rank-count">순위 상금 (몇 등까지)</label></div>
                                <div className="input-group">
                                    <input
                                        id="swiss-paid-rank-count"
                                        type="number"
                                        min={1}
                                        max={SWISS_PAID_RANK_MAX}
                                        value={settings.swissPaidRankCount ?? 3}
                                        onChange={e =>
                                            handleSettingChange(
                                                'swissPaidRankCount',
                                                Math.min(
                                                    SWISS_PAID_RANK_MAX,
                                                    Math.max(1, Math.floor(Number(e.target.value)) || 3)
                                                )
                                            )
                                        }
                                    />
                                    <span>등까지 (참가상 별도)</span>
                                </div>
                            </div>
                            <h4 style={{ marginTop: '1.25rem' }}>조별 진행</h4>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-color-secondary)', marginBottom: '0.75rem' }}>
                                켜면 참가자를 급수 순(또는 무작위)으로 정렬한 뒤, 아래 인원만큼 앞에서부터 1조·2조…로 나누어 각 조에서만 스위스를 진행합니다. 조 인원 합은 반드시 참가자 수와 같아야 합니다.
                            </p>
                            <div className="settings-form-row">
                                <div className="label-group"><label htmlFor="swiss-use-groups">조별 스위스</label></div>
                                <div className="input-group">
                                    <input
                                        id="swiss-use-groups"
                                        type="checkbox"
                                        checked={settings.swissUseGroups}
                                        onChange={e => handleSettingChange('swissUseGroups', e.target.checked)}
                                    />
                                </div>
                            </div>
                            {settings.swissUseGroups && (
                                <>
                                    <div className="settings-form-row">
                                        <div className="label-group"><label htmlFor="swiss-group-sizes">조 인원 (초기값)</label></div>
                                        <div className="input-group" style={{ flexWrap: 'wrap', gap: '0.35rem' }}>
                                            <input
                                                id="swiss-group-sizes"
                                                type="text"
                                                placeholder="4,4,8"
                                                value={settings.swissGroupSizes}
                                                onChange={e => handleSettingChange('swissGroupSizes', e.target.value)}
                                                style={{ minWidth: '140px' }}
                                            />
                                            <span style={{ fontSize: '0.88rem', color: 'var(--text-color-secondary)' }}>
                                                쉼표 구분. 아래 탭에서 조마다 수정 가능 (합계 {parseSwissGroupSizes(settings.swissGroupSizes).reduce((a, b) => a + b, 0) || '—'}명)
                                            </span>
                                        </div>
                                    </div>
                                    <p style={{ fontSize: '0.88rem', color: 'var(--text-color-secondary)', marginTop: '-0.25rem' }}>
                                        조별 상금·인원은 「조별 상금」카드의 탭에서 설정합니다.
                                    </p>
                                </>
                            )}
                            <SwissGroupPrizesEditor settings={settings} onChange={handleSettingChange} />
                        </div>
                    )}

                    {activeTab === 'hybrid' && (
                        <div className="settings-form-section">
                            <h3>예선+본선 설정</h3>
                            <div className="settings-form-row">
                                <div className="label-group"><label htmlFor="hybrid-swiss-paid-rank-count">순위 상금 (몇 등까지)</label></div>
                                <div className="input-group">
                                    <input
                                        id="hybrid-swiss-paid-rank-count"
                                        type="number"
                                        min={1}
                                        max={SWISS_PAID_RANK_MAX}
                                        value={settings.swissPaidRankCount ?? 3}
                                        onChange={e =>
                                            handleSettingChange(
                                                'swissPaidRankCount',
                                                Math.min(
                                                    SWISS_PAID_RANK_MAX,
                                                    Math.max(1, Math.floor(Number(e.target.value)) || 3)
                                                )
                                            )
                                        }
                                    />
                                    <span>등까지 (예선 시상·스위스 공통, 참가상 별도)</span>
                                </div>
                            </div>
                            <div className="settings-form-row">
                                <div className="label-group"><label>조당 본선 진출 인원</label></div>
                                <div className="input-group"><input type="number" min="1" value={settings.hybridAdvanceCount || 2} onChange={e => handleSettingChange('hybridAdvanceCount', Number(e.target.value))} /><span>명</span></div>
                            </div>
                            <div className="settings-form-row">
                                <div className="label-group"><label>예선 조 개수 (선택)</label></div>
                                <div className="input-group"><input type="number" value={settings.hybridGroupCount || 0} onChange={e => handleSettingChange('hybridGroupCount', Number(e.target.value))} placeholder="자동" /><span>개</span></div>
                            </div>
                             <div className="settings-form-row">
                                <div className="label-group"><label>배정 방식</label></div>
                                <select value={settings.hybridMode || 'rank'} onChange={e => handleSettingChange('hybridMode', e.target.value)}>
                                    <option value="rank">급수 순 (스네이크)</option>
                                    <option value="random">무작위</option>
                                </select>
                            </div>
                            <HybridPrelimGroupPrizesEditor settings={settings} onChange={handleSettingChange} />
                            <HybridBracketGroupPrizesEditor settings={settings} onChange={handleSettingChange} />
                        </div>
                    )}

                    {activeTab === 'mission' && settings.missionBaduk && (
                        <div className="settings-form-section">
                            <h3>미션 바둑 설정</h3>
                            
                            <div className="settings-card">
                                <h4>기본 설정</h4>
                                <div className="settings-form-row">
                                    <div className="label-group"><label>제한 시간 (분)</label></div>
                                    <div className="input-group">
                                        <input type="number" value={settings.missionBaduk.timeLimit} onChange={e => handleMissionBadukSettingChange('timeLimit', Number(e.target.value))} />
                                        <span>분</span>
                                    </div>
                                </div>
                                <div className="settings-form-row">
                                    <div className="label-group"><label>점수 당 스톤 환산비</label></div>
                                    <div className="input-group">
                                        <span>1점 = </span>
                                        <input type="number" value={settings.missionBaduk.scoreToStoneRatio} onChange={e => handleMissionBadukSettingChange('scoreToStoneRatio', Number(e.target.value))} />
                                        <span>스톤</span>
                                    </div>
                                </div>
                            </div>

                            <div className="settings-card">
                                <h4>💯 점수 배점 설정</h4>
                                <div className="point-grid">
                                    <div className="point-item">
                                        <label>19줄 승리</label>
                                        <input type="number" value={settings.missionBaduk.points?.win19 ?? 3} onChange={e => handleMissionBadukPointsChange('win19', Number(e.target.value))} />
                                    </div>
                                    <div className="point-item">
                                        <label>13줄 승리</label>
                                        <input type="number" value={settings.missionBaduk.points?.win13 ?? 2} onChange={e => handleMissionBadukPointsChange('win13', Number(e.target.value))} />
                                    </div>
                                    <div className="point-item">
                                        <label>9줄 승리</label>
                                        <input type="number" value={settings.missionBaduk.points?.win9 ?? 1} onChange={e => handleMissionBadukPointsChange('win9', Number(e.target.value))} />
                                    </div>
                                    <div className="point-item" style={{borderColor: '#ffcdd2', background: '#ffebee'}}>
                                        <label style={{color: '#c62828'}}>감점</label>
                                        <input type="number" value={settings.missionBaduk.points?.penaltyDeduction ?? 1} onChange={e => handleMissionBadukPointsChange('penaltyDeduction', Number(e.target.value))} style={{color: '#c62828'}} />
                                    </div>
                                    <div className="point-item">
                                        <label>{settings.missionBaduk.wearableMissionLabel || '미션2'}</label>
                                        <input type="number" value={settings.missionBaduk.points?.wearableMissionSuccess ?? 1} onChange={e => handleMissionBadukPointsChange('wearableMissionSuccess', Number(e.target.value))} title="별점 없는 경우 기본 점수" />
                                    </div>
                                </div>
                                <h5 style={{marginTop: '1.5rem', marginBottom: '0.5rem', color: '#555', borderTop: '1px dashed #eee', paddingTop: '1rem'}}>⭐ 별점 별 추가 점수 (미션1 & 미션2 공통)</h5>
                                <div className="point-grid" style={{gridTemplateColumns: 'repeat(5, 1fr)'}}>
                                    <div className="point-item">
                                        <label>★1</label>
                                        <input type="number" value={settings.missionBaduk.points?.star1 ?? 1} onChange={e => handleMissionBadukPointsChange('star1', Number(e.target.value))} />
                                    </div>
                                    <div className="point-item">
                                        <label>★2</label>
                                        <input type="number" value={settings.missionBaduk.points?.star2 ?? 2} onChange={e => handleMissionBadukPointsChange('star2', Number(e.target.value))} />
                                    </div>
                                    <div className="point-item">
                                        <label>★3</label>
                                        <input type="number" value={settings.missionBaduk.points?.star3 ?? 3} onChange={e => handleMissionBadukPointsChange('star3', Number(e.target.value))} />
                                    </div>
                                    <div className="point-item">
                                        <label>★4</label>
                                        <input type="number" value={settings.missionBaduk.points?.star4 ?? 4} onChange={e => handleMissionBadukPointsChange('star4', Number(e.target.value))} />
                                    </div>
                                    <div className="point-item">
                                        <label>★5</label>
                                        <input type="number" value={settings.missionBaduk.points?.star5 ?? 5} onChange={e => handleMissionBadukPointsChange('star5', Number(e.target.value))} />
                                    </div>
                                </div>
                            </div>

                            <MissionGroupPrizesEditor settings={settings} onChange={handleSettingChange} />

                            <div className="settings-card">
                                <h4>📋 미션 목록 관리</h4>
                                
                                <h5 style={{marginTop: '1rem'}}>{settings.missionBaduk.matchMissionLabel || '미션1'} 목록</h5>
                                <div style={{maxHeight: '200px', overflowY: 'auto', border: '1px solid #eee', marginBottom: '1rem', padding: '0.5rem'}}>
                                    {settings.missionBaduk.matchMissions.map((mission, idx) => (
                                        <div key={mission.id} style={{display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center'}}>
                                            <input type="text" value={mission.template} onChange={(e) => handleUpdateMatchMission(mission.id, 'template', e.target.value)} style={{flex: 1, padding: '4px'}} />
                                            <input type="number" value={mission.min} onChange={(e) => handleUpdateMatchMission(mission.id, 'min', Number(e.target.value))} style={{width: '50px', padding: '4px'}} placeholder="Min" />
                                            <span>~</span>
                                            <input type="number" value={mission.max} onChange={(e) => handleUpdateMatchMission(mission.id, 'max', Number(e.target.value))} style={{width: '50px', padding: '4px'}} placeholder="Max" />
                                            <span title="최대 별점">★</span>
                                            <input type="number" value={mission.defaultStars ?? 3} onChange={(e) => handleUpdateMatchMission(mission.id, 'defaultStars', Number(e.target.value))} style={{width: '40px', padding: '4px'}} min="1" max="5" />
                                            <button className="btn-xs danger" onClick={() => handleDeleteMatchMission(mission.id)}>삭제</button>
                                        </div>
                                    ))}
                                </div>
                                <div style={{display: 'flex', gap: '0.5rem', marginBottom: '2rem'}}>
                                    <input type="text" value={newMatchMission.template} onChange={(e) => setNewMatchMission({...newMatchMission, template: e.target.value})} placeholder="새 미션 내용 ({n} 포함 가능)" style={{flex: 1, padding: '6px'}} />
                                    <input type="number" value={newMatchMission.min} onChange={(e) => setNewMatchMission({...newMatchMission, min: Number(e.target.value)})} placeholder="최소" style={{width: '60px', padding: '6px'}} />
                                    <input type="number" value={newMatchMission.max} onChange={(e) => setNewMatchMission({...newMatchMission, max: Number(e.target.value)})} placeholder="최대" style={{width: '60px', padding: '6px'}} />
                                    <span title="기본 별점">★</span>
                                    <input type="number" value={newMatchMission.defaultStars} onChange={(e) => setNewMatchMission({...newMatchMission, defaultStars: Number(e.target.value)})} style={{width: '40px', padding: '6px'}} min="1" max="5" />
                                    <button className="btn-sm primary" onClick={handleAddMatchMission}>추가</button>
                                </div>

                                <h5>{settings.missionBaduk.wearableMissionLabel || '미션2'} 목록</h5>
                                <div style={{maxHeight: '150px', overflowY: 'auto', border: '1px solid #eee', marginBottom: '1rem', padding: '0.5rem'}}>
                                    {settings.missionBaduk.wearableMissions.map((mission, idx) => (
                                        <div key={mission.id || idx} style={{display: 'flex', gap: '0.5rem', marginBottom: '0.3rem', padding: '2px', background: '#f9f9f9'}}>
                                            <input type="text" value={mission.text || (mission as any)} onChange={(e) => handleUpdateWearableMission(mission.id, 'text', e.target.value)} style={{flex: 1, padding: '4px'}} />
                                            <span title="별점">★</span>
                                            <input type="number" value={mission.stars || 1} onChange={(e) => handleUpdateWearableMission(mission.id, 'stars', Number(e.target.value))} style={{width: '40px', padding: '4px'}} min="1" max="5" />
                                            <button className="btn-xs danger" onClick={() => handleDeleteWearableMission(mission.id)}>삭제</button>
                                        </div>
                                    ))}
                                </div>
                                <div style={{display: 'flex', gap: '0.5rem'}}>
                                    <input type="text" value={newWearableMission.text} onChange={(e) => setNewWearableMission({...newWearableMission, text: e.target.value})} placeholder="새 아이템 미션 내용" style={{flex: 1, padding: '6px'}} />
                                    <span title="별점">★</span>
                                    <input type="number" value={newWearableMission.stars} onChange={(e) => setNewWearableMission({...newWearableMission, stars: Number(e.target.value)})} style={{width: '40px', padding: '6px'}} min="1" max="5" />
                                    <button className="btn-sm primary" onClick={handleAddWearableMission}>추가</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="modal-actions">
                    <button type="button" className="btn primary" onClick={onClose}>닫기</button>
                </div>
            </div>
        </div>
    );
};
