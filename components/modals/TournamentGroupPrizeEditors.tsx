import React, { useState, useEffect } from 'react';
import type {
    TournamentSettings,
    TournamentBracketGroupPrizes,
    TournamentSwissGroupPrizes,
    TournamentRelayGroupPrizes,
    TournamentMissionGroupPrizes,
} from '../../types';
import {
    defaultBracketGroupPrize,
    defaultSwissGroupPrize,
    getBracketPrizeRow,
    getMissionPrizeRow,
    getSwissPaidRankCount,
    getSwissRankAmounts,
    swissRowFromRankAmounts,
    parseSwissGroupSizes,
    syncSwissPrizeRowsToGroupCount,
} from '../../utils/tournamentPrizes';

type Setter = (field: keyof TournamentSettings, value: unknown) => void;

const btnSm: React.CSSProperties = { padding: '2px 8px', fontSize: '0.85rem' };

const tabBarStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.35rem',
    marginBottom: '0.75rem',
};

/** 스위스·예선 스타일 순위 상금 입력 (참가상 제외) */
export const SwissRankPrizeFields = ({
    paidCount,
    prizes,
    onChange,
}: {
    paidCount: number;
    prizes: TournamentSwissGroupPrizes;
    onChange: (next: TournamentSwissGroupPrizes) => void;
}) => {
    const amounts = getSwissRankAmounts(prizes, paidCount);
    const setAmount = (i: number, v: number) => {
        const next = [...amounts];
        next[i] = v;
        onChange(swissRowFromRankAmounts(next, prizes.participant));
    };
    return (
        <>
            {amounts.map((amt, i) => (
                <div key={i} className="settings-form-row">
                    <div className="label-group">
                        <label>{i + 1}위</label>
                    </div>
                    <div className="input-group">
                        <input type="number" value={amt} onChange={e => setAmount(i, Number(e.target.value) || 0)} />
                        <span>스톤</span>
                    </div>
                </div>
            ))}
            <div className="settings-form-row">
                <div className="label-group">
                    <label>참가상</label>
                </div>
                <div className="input-group">
                    <input
                        type="number"
                        value={prizes.participant}
                        onChange={e =>
                            onChange(swissRowFromRankAmounts(getSwissRankAmounts(prizes, paidCount), Number(e.target.value) || 0))
                        }
                    />
                    <span>스톤</span>
                </div>
            </div>
        </>
    );
};

export const BracketGroupPrizesEditor = ({
    settings,
    onChange,
}: {
    settings: TournamentSettings;
    onChange: Setter;
}) => {
    const rows = settings.bracketPrizesByGroup;
    const list: TournamentBracketGroupPrizes[] =
        rows && rows.length > 0 ? rows : [defaultBracketGroupPrize(settings)];

    const setRows = (next: TournamentBracketGroupPrizes[]) => {
        onChange('bracketPrizesByGroup', next.length ? next : undefined);
    };

    const update = (idx: number, patch: Partial<TournamentBracketGroupPrizes>) => {
        const next = list.map((r, i) => (i === idx ? { ...r, ...patch } : r));
        setRows(next);
    };

    return (
        <div className="settings-card" style={{ marginTop: '1rem' }}>
            <h4>조별 상금 (토너먼트·풀리그·더블엘리미네이션)</h4>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-color-secondary)', marginBottom: '0.75rem' }}>
                행을 여러 개 두면 시상 시 조 번호를 골라 해당 금액으로 지급합니다. 비우면 위 기본 상금만 사용합니다.
            </p>
            {list.map((row, idx) => (
                <div
                    key={idx}
                    style={{
                        border: '1px solid var(--border-color)',
                        borderRadius: 8,
                        padding: '0.75rem',
                        marginBottom: '0.5rem',
                        background: 'var(--surface-color-hover)',
                    }}
                >
                    <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{idx + 1}조</div>
                    <div className="settings-form-row">
                        <div className="label-group">
                            <label>우승</label>
                        </div>
                        <div className="input-group">
                            <input type="number" value={row.champion} onChange={e => update(idx, { champion: Number(e.target.value) || 0 })} />
                            <span>스톤</span>
                        </div>
                    </div>
                    <div className="settings-form-row">
                        <div className="label-group">
                            <label>준우승</label>
                        </div>
                        <div className="input-group">
                            <input type="number" value={row.runnerUp} onChange={e => update(idx, { runnerUp: Number(e.target.value) || 0 })} />
                            <span>스톤</span>
                        </div>
                    </div>
                    <div className="settings-form-row">
                        <div className="label-group">
                            <label>3-4위</label>
                        </div>
                        <div className="input-group">
                            <input type="number" value={row.semiFinalist} onChange={e => update(idx, { semiFinalist: Number(e.target.value) || 0 })} />
                            <span>스톤</span>
                        </div>
                    </div>
                    <div className="settings-form-row">
                        <div className="label-group">
                            <label>참가상</label>
                        </div>
                        <div className="input-group">
                            <input type="number" value={row.participant} onChange={e => update(idx, { participant: Number(e.target.value) || 0 })} />
                            <span>스톤</span>
                        </div>
                    </div>
                    {list.length > 1 && (
                        <button type="button" className="btn-sm danger" style={btnSm} onClick={() => setRows(list.filter((_, i) => i !== idx))}>
                            이 조 삭제
                        </button>
                    )}
                </div>
            ))}
            <button
                type="button"
                className="btn-sm"
                style={{ ...btnSm, marginTop: 4 }}
                onClick={() => setRows([...list, { ...list[list.length - 1] }])}
            >
                조(행) 추가
            </button>
            <button
                type="button"
                className="btn-sm"
                style={{ ...btnSm, marginLeft: 8 }}
                onClick={() => onChange('bracketPrizesByGroup', undefined)}
            >
                조별 상금 끄기 (기본만)
            </button>
        </div>
    );
};

export const SwissGroupPrizesEditor = ({ settings, onChange }: { settings: TournamentSettings; onChange: Setter }) => {
    const paidCount = getSwissPaidRankCount(settings);
    const groupSizes = parseSwissGroupSizes(settings.swissGroupSizes);
    const groupCount = groupSizes.length;
    const [activeTab, setActiveTab] = useState(0);

    const rows = settings.swissPrizesByGroup;
    const list: TournamentSwissGroupPrizes[] =
        rows && rows.length > 0 ? rows.map(r => ({ ...r })) : [defaultSwissGroupPrize(settings)];

    const setRows = (next: TournamentSwissGroupPrizes[]) => {
        onChange('swissPrizesByGroup', next.length ? next : undefined);
    };

    const updateRow = (idx: number, nextRow: TournamentSwissGroupPrizes) => {
        const base =
            settings.swissUseGroups && groupCount > 0
                ? syncSwissPrizeRowsToGroupCount(settings.swissPrizesByGroup, groupCount, settings)
                : list;
        const next = base.map((r, i) => (i === idx ? nextRow : r));
        setRows(next);
    };

    useEffect(() => {
        if (!settings.swissUseGroups || groupCount === 0) return;
        const cur = settings.swissPrizesByGroup;
        if (!cur || cur.length !== groupCount) {
            onChange('swissPrizesByGroup', syncSwissPrizeRowsToGroupCount(cur, groupCount, settings));
        }
    }, [settings.swissUseGroups, settings.swissGroupSizes, groupCount]);

    useEffect(() => {
        if (activeTab >= groupCount && groupCount > 0) setActiveTab(0);
    }, [groupCount, activeTab]);

    const setGroupSizeAt = (idx: number, value: number) => {
        const nextSizes = [...groupSizes];
        const v = Math.max(1, Math.floor(value) || 1);
        if (idx >= 0 && idx < nextSizes.length) nextSizes[idx] = v;
        onChange('swissGroupSizes', nextSizes.join(','));
    };

    const groupedList =
        settings.swissUseGroups && groupCount > 0
            ? syncSwissPrizeRowsToGroupCount(settings.swissPrizesByGroup, groupCount, settings)
            : list;

    if (settings.swissUseGroups && groupCount === 0) {
        return (
            <div className="settings-card" style={{ marginTop: '1rem' }}>
                <h4>조별 상금·인원 (스위스 리그)</h4>
                <p style={{ fontSize: '0.88rem', color: 'var(--danger-color, #c0392b)' }}>
                    위에서 조 인원을 먼저 입력해 주세요. (예: 4,4,8)
                </p>
            </div>
        );
    }

    if (settings.swissUseGroups) {
        const idx = Math.min(activeTab, groupedList.length - 1);
        const row = groupedList[idx] ?? defaultSwissGroupPrize(settings);
        const sizeVal = groupSizes[idx] ?? 0;

        return (
            <div className="settings-card" style={{ marginTop: '1rem' }}>
                <h4>조별 상금·인원 (스위스 리그)</h4>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-color-secondary)', marginBottom: '0.75rem' }}>
                    탭마다 해당 조 인원과 상금을 설정합니다. 조 개수는 위 「조 인원」 합계와 같습니다.
                </p>
                <div style={tabBarStyle}>
                    {groupSizes.map((sz, i) => (
                        <button
                            key={i}
                            type="button"
                            className="btn-sm"
                            style={{
                                ...btnSm,
                                border: i === idx ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                                background: i === idx ? 'var(--primary-color)' : 'var(--surface-color)',
                                color: i === idx ? '#fff' : 'inherit',
                            }}
                            onClick={() => setActiveTab(i)}
                        >
                            {i + 1}조 ({sz}명)
                        </button>
                    ))}
                </div>
                <div
                    style={{
                        border: '1px solid var(--border-color)',
                        borderRadius: 8,
                        padding: '0.75rem',
                        background: 'var(--surface-color-hover)',
                    }}
                >
                    <div className="settings-form-row">
                        <div className="label-group">
                            <label htmlFor={`swiss-grp-${idx}-size`}>이 조 인원</label>
                        </div>
                        <div className="input-group">
                            <input
                                id={`swiss-grp-${idx}-size`}
                                type="number"
                                min={1}
                                value={sizeVal}
                                onChange={e => setGroupSizeAt(idx, Number(e.target.value))}
                            />
                            <span>명</span>
                        </div>
                    </div>
                    <SwissRankPrizeFields paidCount={paidCount} prizes={row} onChange={r => updateRow(idx, r)} />
                </div>
                <button type="button" className="btn-sm" style={{ ...btnSm, marginTop: 8 }} onClick={() => onChange('swissPrizesByGroup', undefined)}>
                    조별 상금 끄기 (기본만)
                </button>
            </div>
        );
    }

    return (
        <div className="settings-card" style={{ marginTop: '1rem' }}>
            <h4>조별 상금 (스위스 리그)</h4>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-color-secondary)', marginBottom: '0.75rem' }}>
                조별 스위스를 끈 상태에서는 아래 한 세트가 전체 스위스 시상 기본값으로 쓰입니다. 켜면 위 탭에서 조마다 다르게 둘 수 있습니다.
            </p>
            <div
                style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    padding: '0.75rem',
                    background: 'var(--surface-color-hover)',
                }}
            >
                <SwissRankPrizeFields paidCount={paidCount} prizes={list[0]} onChange={r => setRows([r])} />
            </div>
            <button type="button" className="btn-sm" style={{ ...btnSm, marginTop: 8 }} onClick={() => onChange('swissPrizesByGroup', undefined)}>
                조별 상금 끄기 (기본만)
            </button>
        </div>
    );
};

export const RelayGroupPrizesEditor = ({ settings, onChange }: { settings: TournamentSettings; onChange: Setter }) => {
    const rows = settings.relayPrizesByGroup;
    const fallbackRow: TournamentRelayGroupPrizes = {
        winPrize: settings.championPrize,
        losePrize: settings.participantPrize,
        participantPrize: settings.participantPrize,
    };
    const list: TournamentRelayGroupPrizes[] = rows && rows.length > 0 ? rows : [fallbackRow, { ...fallbackRow }];

    const setRows = (next: TournamentRelayGroupPrizes[]) => {
        onChange('relayPrizesByGroup', next.length ? next : undefined);
    };

    const update = (idx: number, patch: Partial<TournamentRelayGroupPrizes>) => {
        const next = list.map((r, i) => (i === idx ? { ...r, ...patch } : r));
        setRows(next);
    };

    return (
        <div className="settings-card" style={{ marginTop: '1rem' }}>
            <h4>조별 상금 (팀 대항전)</h4>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-color-secondary)', marginBottom: '0.75rem' }}>
                1조 = A팀, 2조 = B팀 기준으로 승리·패배 시 지급 기본 스톤을 다르게 둘 수 있습니다.
            </p>
            {list.map((row, idx) => (
                <div
                    key={idx}
                    style={{
                        border: '1px solid var(--border-color)',
                        borderRadius: 8,
                        padding: '0.75rem',
                        marginBottom: '0.5rem',
                        background: 'var(--surface-color-hover)',
                    }}
                >
                    <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
                        {idx + 1}조 ({idx === 0 ? 'A팀' : idx === 1 ? 'B팀' : `팀 ${idx + 1}`})
                    </div>
                    <div className="settings-form-row">
                        <div className="label-group">
                            <label>승리 시</label>
                        </div>
                        <div className="input-group">
                            <input type="number" value={row.winPrize} onChange={e => update(idx, { winPrize: Number(e.target.value) || 0 })} />
                            <span>스톤</span>
                        </div>
                    </div>
                    <div className="settings-form-row">
                        <div className="label-group">
                            <label>패배 시</label>
                        </div>
                        <div className="input-group">
                            <input type="number" value={row.losePrize} onChange={e => update(idx, { losePrize: Number(e.target.value) || 0 })} />
                            <span>스톤</span>
                        </div>
                    </div>
                    <div className="settings-form-row">
                        <div className="label-group">
                            <label>참가(기본)</label>
                        </div>
                        <div className="input-group">
                            <input
                                type="number"
                                value={row.participantPrize}
                                onChange={e => update(idx, { participantPrize: Number(e.target.value) || 0 })}
                            />
                            <span>스톤</span>
                        </div>
                    </div>
                    {list.length > 2 && (
                        <button type="button" className="btn-sm danger" style={btnSm} onClick={() => setRows(list.filter((_, i) => i !== idx))}>
                            이 조 삭제
                        </button>
                    )}
                </div>
            ))}
            <button type="button" className="btn-sm" style={{ ...btnSm, marginTop: 4 }} onClick={() => setRows([...list, { ...list[list.length - 1] }])}>
                조(행) 추가
            </button>
            <button type="button" className="btn-sm" style={{ ...btnSm, marginLeft: 8 }} onClick={() => onChange('relayPrizesByGroup', undefined)}>
                조별 상금 끄기 (기본만)
            </button>
        </div>
    );
};

export const HybridPrelimGroupPrizesEditor = ({ settings, onChange }: { settings: TournamentSettings; onChange: Setter }) => {
    const paidCount = getSwissPaidRankCount(settings);
    const rows = settings.hybridPrelimPrizesByGroup;
    const list: TournamentSwissGroupPrizes[] = rows && rows.length > 0 ? rows : [defaultSwissGroupPrize(settings)];

    const setRows = (next: TournamentSwissGroupPrizes[]) => {
        onChange('hybridPrelimPrizesByGroup', next.length ? next : undefined);
    };

    const replaceRow = (idx: number, row: TournamentSwissGroupPrizes) => {
        const next = list.map((r, i) => (i === idx ? row : r));
        setRows(next);
    };

    return (
        <div className="settings-card" style={{ marginTop: '1rem' }}>
            <h4>조별 상금 (예선 리그)</h4>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-color-secondary)', marginBottom: '0.75rem' }}>
                스위스 탭의 「순위 상금 (몇 등까지)」설정과 동일한 개수의 순위 칸이 적용됩니다.
            </p>
            {list.map((row, idx) => (
                <div
                    key={idx}
                    style={{
                        border: '1px solid var(--border-color)',
                        borderRadius: 8,
                        padding: '0.75rem',
                        marginBottom: '0.5rem',
                        background: 'var(--surface-color-hover)',
                    }}
                >
                    <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>예선 {idx + 1}조</div>
                    <SwissRankPrizeFields paidCount={paidCount} prizes={row} onChange={next => replaceRow(idx, next)} />
                    {list.length > 1 && (
                        <button type="button" className="btn-sm danger" style={btnSm} onClick={() => setRows(list.filter((_, i) => i !== idx))}>
                            이 조 삭제
                        </button>
                    )}
                </div>
            ))}
            <button type="button" className="btn-sm" style={{ ...btnSm, marginTop: 4 }} onClick={() => setRows([...list, { ...list[list.length - 1] }])}>
                조(행) 추가
            </button>
            <button type="button" className="btn-sm" style={{ ...btnSm, marginLeft: 8 }} onClick={() => onChange('hybridPrelimPrizesByGroup', undefined)}>
                조별 상금 끄기 (기본만)
            </button>
        </div>
    );
};

export const HybridBracketGroupPrizesEditor = ({ settings, onChange }: { settings: TournamentSettings; onChange: Setter }) => {
    const rows = settings.hybridBracketPrizesByGroup;
    const list: TournamentBracketGroupPrizes[] = rows && rows.length > 0 ? rows : [getBracketPrizeRow(settings, 'bracket', 0)];

    const setRows = (next: TournamentBracketGroupPrizes[]) => {
        onChange('hybridBracketPrizesByGroup', next.length ? next : undefined);
    };

    const update = (idx: number, patch: Partial<TournamentBracketGroupPrizes>) => {
        const next = list.map((r, i) => (i === idx ? { ...r, ...patch } : r));
        setRows(next);
    };

    return (
        <div className="settings-card" style={{ marginTop: '1rem' }}>
            <h4>조별 상금 (예선+본선 — 본선 토너먼트)</h4>
            {list.map((row, idx) => (
                <div
                    key={idx}
                    style={{
                        border: '1px solid var(--border-color)',
                        borderRadius: 8,
                        padding: '0.75rem',
                        marginBottom: '0.5rem',
                        background: 'var(--surface-color-hover)',
                    }}
                >
                    <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>본선 {idx + 1}조</div>
                    <div className="settings-form-row">
                        <div className="label-group">
                            <label>우승</label>
                        </div>
                        <div className="input-group">
                            <input type="number" value={row.champion} onChange={e => update(idx, { champion: Number(e.target.value) || 0 })} />
                            <span>스톤</span>
                        </div>
                    </div>
                    <div className="settings-form-row">
                        <div className="label-group">
                            <label>준우승</label>
                        </div>
                        <div className="input-group">
                            <input type="number" value={row.runnerUp} onChange={e => update(idx, { runnerUp: Number(e.target.value) || 0 })} />
                            <span>스톤</span>
                        </div>
                    </div>
                    <div className="settings-form-row">
                        <div className="label-group">
                            <label>3-4위</label>
                        </div>
                        <div className="input-group">
                            <input type="number" value={row.semiFinalist} onChange={e => update(idx, { semiFinalist: Number(e.target.value) || 0 })} />
                            <span>스톤</span>
                        </div>
                    </div>
                    <div className="settings-form-row">
                        <div className="label-group">
                            <label>참가상</label>
                        </div>
                        <div className="input-group">
                            <input type="number" value={row.participant} onChange={e => update(idx, { participant: Number(e.target.value) || 0 })} />
                            <span>스톤</span>
                        </div>
                    </div>
                    {list.length > 1 && (
                        <button type="button" className="btn-sm danger" style={btnSm} onClick={() => setRows(list.filter((_, i) => i !== idx))}>
                            이 조 삭제
                        </button>
                    )}
                </div>
            ))}
            <button type="button" className="btn-sm" style={{ ...btnSm, marginTop: 4 }} onClick={() => setRows([...list, { ...list[list.length - 1] }])}>
                조(행) 추가
            </button>
            <button type="button" className="btn-sm" style={{ ...btnSm, marginLeft: 8 }} onClick={() => onChange('hybridBracketPrizesByGroup', undefined)}>
                조별 상금 끄기 (기본만)
            </button>
        </div>
    );
};

export const MissionGroupPrizesEditor = ({ settings, onChange }: { settings: TournamentSettings; onChange: Setter }) => {
    const rows = settings.missionPrizesByGroup;
    const base: TournamentMissionGroupPrizes = getMissionPrizeRow(settings, 0);
    const list: TournamentMissionGroupPrizes[] = rows && rows.length > 0 ? rows : [base];

    const setRows = (next: TournamentMissionGroupPrizes[]) => {
        onChange('missionPrizesByGroup', next.length ? next : undefined);
    };

    const update = (idx: number, patch: Partial<TournamentMissionGroupPrizes>) => {
        const next = list.map((r, i) => (i === idx ? { ...r, ...patch } : r));
        setRows(next);
    };

    return (
        <div className="settings-card" style={{ marginTop: '1rem' }}>
            <h4>조별 상금 (미션 바둑)</h4>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-color-secondary)', marginBottom: '0.75rem' }}>
                선수 카드에서 상금 조를 고르면, 종료 시 고정 보너스·참가상 일괄 지급에 사용됩니다.
            </p>
            {list.map((row, idx) => (
                <div
                    key={idx}
                    style={{
                        border: '1px solid var(--border-color)',
                        borderRadius: 8,
                        padding: '0.75rem',
                        marginBottom: '0.5rem',
                        background: 'var(--surface-color-hover)',
                    }}
                >
                    <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{idx + 1}조</div>
                    <div className="settings-form-row">
                        <div className="label-group">
                            <label>종료 고정 보너스</label>
                        </div>
                        <div className="input-group">
                            <input type="number" value={row.finishFlatBonus} onChange={e => update(idx, { finishFlatBonus: Number(e.target.value) || 0 })} />
                            <span>스톤</span>
                        </div>
                    </div>
                    <div className="settings-form-row">
                        <div className="label-group">
                            <label>참가상 (일괄)</label>
                        </div>
                        <div className="input-group">
                            <input
                                type="number"
                                value={row.participantPrize}
                                onChange={e => update(idx, { participantPrize: Number(e.target.value) || 0 })}
                            />
                            <span>스톤</span>
                        </div>
                    </div>
                    {list.length > 1 && (
                        <button type="button" className="btn-sm danger" style={btnSm} onClick={() => setRows(list.filter((_, i) => i !== idx))}>
                            이 조 삭제
                        </button>
                    )}
                </div>
            ))}
            <button type="button" className="btn-sm" style={{ ...btnSm, marginTop: 4 }} onClick={() => setRows([...list, { ...list[list.length - 1] }])}>
                조(행) 추가
            </button>
            <button type="button" className="btn-sm" style={{ ...btnSm, marginLeft: 8 }} onClick={() => onChange('missionPrizesByGroup', undefined)}>
                조별 상금 끄기 (기본만)
            </button>
        </div>
    );
};
