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
    BracketRankPrizeFields,
    SwissGroupPrizesEditor,
    SwissRankPrizeFields,
    RelayGroupPrizesEditor,
    HybridPrelimGroupPrizesEditor,
    HybridBracketGroupPrizesEditor,
    MissionGroupPrizesEditor,
} from './TournamentGroupPrizeEditors';
import {
    parseSwissGroupSizes,
    SWISS_PAID_RANK_MAX,
    BRACKET_PAID_RANK_MAX,
    defaultBracketGroupPrize,
    defaultSwissGroupPrize,
    getBracketPaidRankCount,
    getSwissPaidRankCount,
} from '../../utils/tournamentPrizes';
import { ModalShell } from '../ui/ModalShell';

interface TournamentSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: TournamentSettings;
    onUpdateSettings: React.Dispatch<React.SetStateAction<TournamentSettings>>;
    activeTab: 'relay' | 'bracket' | 'swiss' | 'hybrid' | 'fullleague' | 'doubleelim' | 'mission';
}

const MODE_LABEL: Record<TournamentSettingsModalProps['activeTab'], string> = {
    relay: '팀 대항전',
    bracket: '토너먼트',
    swiss: '스위스 리그',
    hybrid: '예선+본선',
    fullleague: '풀리그',
    doubleelim: '더블엘리미네이션',
    mission: '미션 바둑',
};

export const TournamentSettingsModal = ({ isOpen, onClose, settings, onUpdateSettings, activeTab }: TournamentSettingsModalProps) => {
    const [newMatchMission, setNewMatchMission] = useState({ template: '', min: 1, max: 10, defaultStars: 3 });
    const [newWearableMission, setNewWearableMission] = useState({ text: '', stars: 1 });

    if (!isOpen) return null;

    const handleSettingChange = (field: keyof TournamentSettings, value: any) => {
        onUpdateSettings(prev => ({
            ...prev,
            [field]: value,
        }));
    };

    const handleGameChange = (index: number, value: string) => {
        const newGames = [...settings.games];
        newGames[index] = value as any;
        onUpdateSettings(prev => ({
            ...prev,
            games: newGames,
        }));
    };

    const handleMissionBadukSettingChange = (field: keyof NonNullable<TournamentSettings['missionBaduk']>, value: any) => {
        onUpdateSettings(prev => ({
            ...prev,
            missionBaduk: {
                ...(prev.missionBaduk || ({} as any)),
                [field]: value,
            },
        }));
    };

    const handleMissionBadukPointsChange = (field: keyof NonNullable<TournamentSettings['missionBaduk']>['points'], value: number) => {
        onUpdateSettings(prev => ({
            ...prev,
            missionBaduk: {
                ...(prev.missionBaduk || ({} as any)),
                points: {
                    ...(prev.missionBaduk?.points || ({} as any)),
                    [field]: value,
                },
            },
        }));
    };

    const handleAddMatchMission = () => {
        if (!newMatchMission.template.trim()) {
            alert('미션 내용을 입력해주세요.');
            return;
        }
        onUpdateSettings(prev => ({
            ...prev,
            missionBaduk: {
                ...prev.missionBaduk!,
                matchMissions: [...(prev.missionBaduk?.matchMissions || []), { id: generateId(), ...newMatchMission }],
            },
        }));
        setNewMatchMission({ template: '', min: 1, max: 10, defaultStars: 3 });
    };

    const handleDeleteMatchMission = (id: string) => {
        onUpdateSettings(prev => ({
            ...prev,
            missionBaduk: {
                ...prev.missionBaduk!,
                matchMissions: prev.missionBaduk!.matchMissions.filter(m => m.id !== id),
            },
        }));
    };

    const handleUpdateMatchMission = (id: string, field: keyof MissionBadukMatchMissionDef, value: any) => {
        onUpdateSettings(prev => ({
            ...prev,
            missionBaduk: {
                ...prev.missionBaduk!,
                matchMissions: prev.missionBaduk!.matchMissions.map(m => (m.id === id ? { ...m, [field]: value } : m)),
            },
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
                    { id: generateId(), text: newWearableMission.text.trim(), stars: newWearableMission.stars },
                ],
            },
        }));
        setNewWearableMission({ text: '', stars: 1 });
    };

    const handleDeleteWearableMission = (id: string) => {
        onUpdateSettings(prev => ({
            ...prev,
            missionBaduk: {
                ...prev.missionBaduk!,
                wearableMissions: prev.missionBaduk!.wearableMissions.filter(m => m.id !== id),
            },
        }));
    };

    const handleUpdateWearableMission = (id: string, field: keyof MissionBadukWearableMissionDef, value: any) => {
        onUpdateSettings(prev => ({
            ...prev,
            missionBaduk: {
                ...prev.missionBaduk!,
                wearableMissions: prev.missionBaduk!.wearableMissions.map(m => (m.id === id ? { ...m, [field]: value } : m)),
            },
        }));
    };

    const syncBracketDefaults = (next: ReturnType<typeof defaultBracketGroupPrize>) => {
        onUpdateSettings(prev => ({
            ...prev,
            championPrize: next.champion,
            runnerUpPrize: next.runnerUp,
            thirdPlacePrize: next.third ?? next.semiFinalist,
            fourthPlacePrize: next.fourth ?? next.semiFinalist,
            semiFinalistPrize: next.third ?? next.semiFinalist,
            participantPrize: next.participant,
            bracketExtraRankPrizes: next.extraRanks?.length ? [...next.extraRanks] : undefined,
        }));
    };

    const syncSwissDefaults = (next: ReturnType<typeof defaultSwissGroupPrize>) => {
        onUpdateSettings(prev => ({
            ...prev,
            swiss1stPrize: next.first,
            swiss2ndPrize: next.second,
            swiss3rdPrize: next.third,
            participantPrize: next.participant,
            swissExtraRankPrizes: next.extraRanks?.length ? [...next.extraRanks] : undefined,
        }));
    };

    const bracketPaid = getBracketPaidRankCount(settings);
    const swissPaid = getSwissPaidRankCount(settings);
    const groupSizeSum = parseSwissGroupSizes(settings.swissGroupSizes).reduce((a, b) => a + b, 0);

    return (
        <ModalShell
            title="대회 설정"
            description={`${MODE_LABEL[activeTab]} 운영 규칙과 순위별 상금을 한 화면에서 조정합니다.`}
            size="lg"
            onClose={onClose}
            className="tournament-settings-modal"
            bodyClassName="tsm-body"
            footer={
                <button type="button" className="btn primary" onClick={onClose}>
                    완료
                </button>
            }
        >
                    {(activeTab === 'bracket' || activeTab === 'swiss' || activeTab === 'hybrid' || activeTab === 'doubleelim') && (
                        <section className="tsm-section">
                            <div className="tsm-section-head">
                                <h3>부전승 우선순위</h3>
                                <p>홀수 대진·시드 배정 시 어떤 기준을 우선할지 선택합니다.</p>
                            </div>
                            <div className="tsm-field-row">
                                <label htmlFor="bye-priority">모드</label>
                                <select
                                    id="bye-priority"
                                    value={settings.byePriority ?? 'min_byes'}
                                    onChange={e => handleSettingChange('byePriority', e.target.value as TournamentByePriority)}
                                >
                                    <option value="min_byes">① 부전승 최소화</option>
                                    <option value="min_matches">② 시합 판수 최소화</option>
                                    <option value="max_matches">③ 시합 판수 최대화</option>
                                </select>
                            </div>
                        </section>
                    )}

                    {activeTab === 'relay' && (
                        <div className="tsm-layout">
                            <section className="tsm-section">
                                <div className="tsm-section-head">
                                    <h3>경기 종목</h3>
                                    <p>팀 대항전 1~3경기 종목을 구성합니다.</p>
                                </div>
                                <div className="tsm-field-grid tsm-field-grid--3">
                                    {[0, 1, 2].map(i => (
                                        <label key={i} className="tsm-field">
                                            <span>{i + 1}경기</span>
                                            <select value={settings.games[i]} onChange={e => handleGameChange(i, e.target.value)}>
                                                <option value="none">없음</option>
                                                <option value="game1">바둑</option>
                                                <option value="game2">주사위 바둑</option>
                                                <option value="game3">컬링</option>
                                            </select>
                                        </label>
                                    ))}
                                </div>
                            </section>
                            <section className="tsm-section">
                                <div className="tsm-section-head">
                                    <h3>핸디캡 · 점수</h3>
                                    <p>종목별 덤·점수·예절 감점을 조정합니다.</p>
                                </div>
                                <div className="tsm-field-grid tsm-field-grid--3">
                                    <label className="tsm-field">
                                        <span>동급 호선 덤 (백)</span>
                                        <span className="tsm-prize-input-wrap">
                                            <input
                                                type="number"
                                                step="0.5"
                                                value={settings.game1SameRankHandicap}
                                                onChange={e => handleSettingChange('game1SameRankHandicap', Number(e.target.value))}
                                            />
                                            <span className="tsm-prize-unit">집</span>
                                        </span>
                                    </label>
                                    <label className="tsm-field">
                                        <span>급수차 덤 (1급수)</span>
                                        <span className="tsm-prize-input-wrap">
                                            <input
                                                type="number"
                                                step="0.5"
                                                value={settings.game1RankDiffHandicap}
                                                onChange={e => handleSettingChange('game1RankDiffHandicap', Number(e.target.value))}
                                            />
                                            <span className="tsm-prize-unit">집</span>
                                        </span>
                                    </label>
                                    <label className="tsm-field">
                                        <span>주사위 바둑 (돌당)</span>
                                        <span className="tsm-prize-input-wrap">
                                            <input
                                                type="number"
                                                value={settings.game2StoneValue}
                                                onChange={e => handleSettingChange('game2StoneValue', Number(e.target.value))}
                                            />
                                            <span className="tsm-prize-unit">점</span>
                                        </span>
                                    </label>
                                    <label className="tsm-field">
                                        <span>마지막 돌 보너스</span>
                                        <span className="tsm-prize-input-wrap">
                                            <input
                                                type="number"
                                                value={settings.game2LastStoneBonus}
                                                onChange={e => handleSettingChange('game2LastStoneBonus', Number(e.target.value))}
                                            />
                                            <span className="tsm-prize-unit">점</span>
                                        </span>
                                    </label>
                                    <label className="tsm-field">
                                        <span>컬링 (성공당)</span>
                                        <span className="tsm-prize-input-wrap">
                                            <input
                                                type="number"
                                                value={settings.game3StoneValue}
                                                onChange={e => handleSettingChange('game3StoneValue', Number(e.target.value))}
                                            />
                                            <span className="tsm-prize-unit">점</span>
                                        </span>
                                    </label>
                                    <label className="tsm-field">
                                        <span>예절 감점</span>
                                        <span className="tsm-prize-input-wrap">
                                            <input
                                                type="number"
                                                value={settings.relayMannerPenalty}
                                                onChange={e => handleSettingChange('relayMannerPenalty', Number(e.target.value))}
                                            />
                                            <span className="tsm-prize-unit">점</span>
                                        </span>
                                    </label>
                                </div>
                            </section>
                            <div className="tsm-span-2">
                                <RelayGroupPrizesEditor settings={settings} onChange={handleSettingChange} />
                            </div>
                        </div>
                    )}

                    {(activeTab === 'bracket' || activeTab === 'fullleague' || activeTab === 'doubleelim') && (
                        <div className="tsm-layout">
                            <section className="tsm-section tsm-span-2">
                                <div className="tsm-section-head tsm-section-head--row">
                                    <div>
                                        <h3>순위별 상금</h3>
                                        <p>3·4위를 분리하고 5~8위 등 세부 순위를 설정할 수 있습니다. 조별 상금을 쓰지 않을 때 시상 기본값입니다.</p>
                                    </div>
                                    <label className="tsm-field tsm-field--compact">
                                        <span>순위 상금</span>
                                        <span className="tsm-prize-input-wrap">
                                            <input
                                                type="number"
                                                min={1}
                                                max={BRACKET_PAID_RANK_MAX}
                                                value={bracketPaid}
                                                onChange={e =>
                                                    handleSettingChange(
                                                        'bracketPaidRankCount',
                                                        Math.min(
                                                            BRACKET_PAID_RANK_MAX,
                                                            Math.max(1, Math.floor(Number(e.target.value)) || 4)
                                                        )
                                                    )
                                                }
                                            />
                                            <span className="tsm-prize-unit">등까지</span>
                                        </span>
                                    </label>
                                </div>
                                <BracketRankPrizeFields
                                    paidCount={bracketPaid}
                                    prizes={defaultBracketGroupPrize(settings)}
                                    onChange={syncBracketDefaults}
                                />
                            </section>
                            <div className="tsm-span-2">
                                <BracketGroupPrizesEditor settings={settings} onChange={handleSettingChange} />
                            </div>
                        </div>
                    )}

                    {activeTab === 'swiss' && (
                        <div className="tsm-layout">
                            <section className="tsm-section tsm-span-2">
                                <div className="tsm-section-head tsm-section-head--row">
                                    <div>
                                        <h3>순위별 상금</h3>
                                        <p>1위부터 원하는 등수까지 칸을 늘릴 수 있습니다. 참가상은 별도입니다.</p>
                                    </div>
                                    <label className="tsm-field tsm-field--compact">
                                        <span>순위 상금</span>
                                        <span className="tsm-prize-input-wrap">
                                            <input
                                                type="number"
                                                min={1}
                                                max={SWISS_PAID_RANK_MAX}
                                                value={swissPaid}
                                                onChange={e =>
                                                    handleSettingChange(
                                                        'swissPaidRankCount',
                                                        Math.min(SWISS_PAID_RANK_MAX, Math.max(1, Math.floor(Number(e.target.value)) || 3))
                                                    )
                                                }
                                            />
                                            <span className="tsm-prize-unit">등까지</span>
                                        </span>
                                    </label>
                                </div>
                                <SwissRankPrizeFields
                                    paidCount={swissPaid}
                                    prizes={defaultSwissGroupPrize(settings)}
                                    onChange={syncSwissDefaults}
                                />
                            </section>

                            <section className="tsm-section">
                                <div className="tsm-section-head">
                                    <h3>조별 진행</h3>
                                    <p>참가자를 조로 나눈 뒤 각 조에서만 스위스를 진행합니다.</p>
                                </div>
                                <label className="tsm-toggle">
                                    <input
                                        type="checkbox"
                                        checked={settings.swissUseGroups}
                                        onChange={e => handleSettingChange('swissUseGroups', e.target.checked)}
                                    />
                                    <span>조별 스위스 사용</span>
                                </label>
                                {settings.swissUseGroups && (
                                    <label className="tsm-field" style={{ marginTop: '0.85rem' }}>
                                        <span>조 인원 (초기값)</span>
                                        <span className="tsm-prize-input-wrap">
                                            <input
                                                type="text"
                                                placeholder="4,4,8"
                                                value={settings.swissGroupSizes}
                                                onChange={e => handleSettingChange('swissGroupSizes', e.target.value)}
                                            />
                                            <span className="tsm-prize-unit">합 {groupSizeSum || '—'}명</span>
                                        </span>
                                    </label>
                                )}
                            </section>

                            <div className="tsm-span-2">
                                <SwissGroupPrizesEditor settings={settings} onChange={handleSettingChange} />
                            </div>
                        </div>
                    )}

                    {activeTab === 'hybrid' && (
                        <div className="tsm-layout">
                            <section className="tsm-section">
                                <div className="tsm-section-head">
                                    <h3>예선 · 본선 규칙</h3>
                                    <p>진출 인원, 조 개수, 배정 방식을 설정합니다.</p>
                                </div>
                                <div className="tsm-field-grid tsm-field-grid--2">
                                    <label className="tsm-field">
                                        <span>예선 순위 상금</span>
                                        <span className="tsm-prize-input-wrap">
                                            <input
                                                type="number"
                                                min={1}
                                                max={SWISS_PAID_RANK_MAX}
                                                value={swissPaid}
                                                onChange={e =>
                                                    handleSettingChange(
                                                        'swissPaidRankCount',
                                                        Math.min(SWISS_PAID_RANK_MAX, Math.max(1, Math.floor(Number(e.target.value)) || 3))
                                                    )
                                                }
                                            />
                                            <span className="tsm-prize-unit">등까지</span>
                                        </span>
                                    </label>
                                    <label className="tsm-field">
                                        <span>본선 순위 상금</span>
                                        <span className="tsm-prize-input-wrap">
                                            <input
                                                type="number"
                                                min={1}
                                                max={BRACKET_PAID_RANK_MAX}
                                                value={bracketPaid}
                                                onChange={e =>
                                                    handleSettingChange(
                                                        'bracketPaidRankCount',
                                                        Math.min(
                                                            BRACKET_PAID_RANK_MAX,
                                                            Math.max(1, Math.floor(Number(e.target.value)) || 4)
                                                        )
                                                    )
                                                }
                                            />
                                            <span className="tsm-prize-unit">등까지</span>
                                        </span>
                                    </label>
                                    <label className="tsm-field">
                                        <span>조당 본선 진출</span>
                                        <span className="tsm-prize-input-wrap">
                                            <input
                                                type="number"
                                                min={1}
                                                value={settings.hybridAdvanceCount || 2}
                                                onChange={e => handleSettingChange('hybridAdvanceCount', Number(e.target.value))}
                                            />
                                            <span className="tsm-prize-unit">명</span>
                                        </span>
                                    </label>
                                    <label className="tsm-field">
                                        <span>예선 조 개수</span>
                                        <span className="tsm-prize-input-wrap">
                                            <input
                                                type="number"
                                                value={settings.hybridGroupCount || 0}
                                                onChange={e => handleSettingChange('hybridGroupCount', Number(e.target.value))}
                                                placeholder="자동"
                                            />
                                            <span className="tsm-prize-unit">개</span>
                                        </span>
                                    </label>
                                    <label className="tsm-field tsm-span-2-inner">
                                        <span>배정 방식</span>
                                        <select value={settings.hybridMode || 'rank'} onChange={e => handleSettingChange('hybridMode', e.target.value)}>
                                            <option value="rank">급수 순 (스네이크)</option>
                                            <option value="random">무작위</option>
                                        </select>
                                    </label>
                                </div>
                            </section>
                            <div className="tsm-span-2">
                                <HybridPrelimGroupPrizesEditor settings={settings} onChange={handleSettingChange} />
                            </div>
                            <div className="tsm-span-2">
                                <HybridBracketGroupPrizesEditor settings={settings} onChange={handleSettingChange} />
                            </div>
                        </div>
                    )}

                    {activeTab === 'mission' && settings.missionBaduk && (
                        <div className="tsm-layout">
                            <section className="tsm-section">
                                <div className="tsm-section-head">
                                    <h3>기본 설정</h3>
                                </div>
                                <div className="tsm-field-grid tsm-field-grid--2">
                                    <label className="tsm-field">
                                        <span>제한 시간</span>
                                        <span className="tsm-prize-input-wrap">
                                            <input
                                                type="number"
                                                value={settings.missionBaduk.timeLimit}
                                                onChange={e => handleMissionBadukSettingChange('timeLimit', Number(e.target.value))}
                                            />
                                            <span className="tsm-prize-unit">분</span>
                                        </span>
                                    </label>
                                    <label className="tsm-field">
                                        <span>점수→스톤</span>
                                        <span className="tsm-prize-input-wrap">
                                            <span className="tsm-prize-unit">1점 =</span>
                                            <input
                                                type="number"
                                                value={settings.missionBaduk.scoreToStoneRatio}
                                                onChange={e => handleMissionBadukSettingChange('scoreToStoneRatio', Number(e.target.value))}
                                            />
                                            <span className="tsm-prize-unit">스톤</span>
                                        </span>
                                    </label>
                                </div>
                            </section>

                            <section className="tsm-section">
                                <div className="tsm-section-head">
                                    <h3>점수 배점</h3>
                                </div>
                                <div className="tsm-point-grid">
                                    {(
                                        [
                                            ['win19', '19줄 승리'],
                                            ['win13', '13줄 승리'],
                                            ['win9', '9줄 승리'],
                                            ['penaltyDeduction', '감점'],
                                            ['wearableMissionSuccess', settings.missionBaduk.wearableMissionLabel || '미션2'],
                                        ] as const
                                    ).map(([key, label]) => (
                                        <label key={key} className={`tsm-point-item${key === 'penaltyDeduction' ? ' is-penalty' : ''}`}>
                                            <span>{label}</span>
                                            <input
                                                type="number"
                                                value={(settings.missionBaduk!.points as any)?.[key] ?? (key === 'penaltyDeduction' ? 1 : key.startsWith('win') ? (key === 'win19' ? 3 : key === 'win13' ? 2 : 1) : 1)}
                                                onChange={e => handleMissionBadukPointsChange(key as any, Number(e.target.value))}
                                            />
                                        </label>
                                    ))}
                                </div>
                                <p className="tsm-mini-label">별점 추가 점수</p>
                                <div className="tsm-point-grid tsm-point-grid--5">
                                    {([1, 2, 3, 4, 5] as const).map(n => (
                                        <label key={n} className="tsm-point-item">
                                            <span>★{n}</span>
                                            <input
                                                type="number"
                                                value={(settings.missionBaduk!.points as any)?.[`star${n}`] ?? n}
                                                onChange={e => handleMissionBadukPointsChange(`star${n}` as any, Number(e.target.value))}
                                            />
                                        </label>
                                    ))}
                                </div>
                            </section>

                            <div className="tsm-span-2">
                                <MissionGroupPrizesEditor settings={settings} onChange={handleSettingChange} />
                            </div>

                            <section className="tsm-section tsm-span-2">
                                <div className="tsm-section-head">
                                    <h3>미션 목록</h3>
                                </div>
                                <h4 className="tsm-subhead">{settings.missionBaduk.matchMissionLabel || '미션1'}</h4>
                                <div className="tsm-mission-list">
                                    {settings.missionBaduk.matchMissions.map(mission => (
                                        <div key={mission.id} className="tsm-mission-row">
                                            <input type="text" value={mission.template} onChange={e => handleUpdateMatchMission(mission.id, 'template', e.target.value)} />
                                            <input type="number" value={mission.min} onChange={e => handleUpdateMatchMission(mission.id, 'min', Number(e.target.value))} title="Min" />
                                            <span>~</span>
                                            <input type="number" value={mission.max} onChange={e => handleUpdateMatchMission(mission.id, 'max', Number(e.target.value))} title="Max" />
                                            <span>★</span>
                                            <input
                                                type="number"
                                                value={mission.defaultStars ?? 3}
                                                min={1}
                                                max={5}
                                                onChange={e => handleUpdateMatchMission(mission.id, 'defaultStars', Number(e.target.value))}
                                            />
                                            <button type="button" className="btn-xs danger" onClick={() => handleDeleteMatchMission(mission.id)}>
                                                삭제
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <div className="tsm-mission-row tsm-mission-add">
                                    <input
                                        type="text"
                                        value={newMatchMission.template}
                                        onChange={e => setNewMatchMission({ ...newMatchMission, template: e.target.value })}
                                        placeholder="새 미션 내용 ({n} 포함 가능)"
                                    />
                                    <input
                                        type="number"
                                        value={newMatchMission.min}
                                        onChange={e => setNewMatchMission({ ...newMatchMission, min: Number(e.target.value) })}
                                    />
                                    <input
                                        type="number"
                                        value={newMatchMission.max}
                                        onChange={e => setNewMatchMission({ ...newMatchMission, max: Number(e.target.value) })}
                                    />
                                    <span>★</span>
                                    <input
                                        type="number"
                                        value={newMatchMission.defaultStars}
                                        min={1}
                                        max={5}
                                        onChange={e => setNewMatchMission({ ...newMatchMission, defaultStars: Number(e.target.value) })}
                                    />
                                    <button type="button" className="btn-sm primary" onClick={handleAddMatchMission}>
                                        추가
                                    </button>
                                </div>

                                <h4 className="tsm-subhead">{settings.missionBaduk.wearableMissionLabel || '미션2'}</h4>
                                <div className="tsm-mission-list">
                                    {settings.missionBaduk.wearableMissions.map((mission, idx) => (
                                        <div key={mission.id || idx} className="tsm-mission-row">
                                            <input
                                                type="text"
                                                value={mission.text || (mission as any)}
                                                onChange={e => handleUpdateWearableMission(mission.id, 'text', e.target.value)}
                                            />
                                            <span>★</span>
                                            <input
                                                type="number"
                                                value={mission.stars || 1}
                                                min={1}
                                                max={5}
                                                onChange={e => handleUpdateWearableMission(mission.id, 'stars', Number(e.target.value))}
                                            />
                                            <button type="button" className="btn-xs danger" onClick={() => handleDeleteWearableMission(mission.id)}>
                                                삭제
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <div className="tsm-mission-row tsm-mission-add">
                                    <input
                                        type="text"
                                        value={newWearableMission.text}
                                        onChange={e => setNewWearableMission({ ...newWearableMission, text: e.target.value })}
                                        placeholder="새 아이템 미션 내용"
                                    />
                                    <span>★</span>
                                    <input
                                        type="number"
                                        value={newWearableMission.stars}
                                        min={1}
                                        max={5}
                                        onChange={e => setNewWearableMission({ ...newWearableMission, stars: Number(e.target.value) })}
                                    />
                                    <button type="button" className="btn-sm primary" onClick={handleAddWearableMission}>
                                        추가
                                    </button>
                                </div>
                            </section>
                        </div>
                    )}
        </ModalShell>
    );
};
