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
    getBracketPaidRankCount,
    getBracketRankAmounts,
    swissRowFromRankAmounts,
    bracketRowFromRankAmounts,
    parseSwissGroupSizes,
    syncSwissPrizeRowsToGroupCount,
} from '../../utils/tournamentPrizes';

type Setter = (field: keyof TournamentSettings, value: unknown) => void;

/** 순위 상금 그리드 (스위스·예선) */
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
        <div className="tsm-prize-grid">
            {amounts.map((amt, i) => (
                <label key={i} className="tsm-prize-cell">
                    <span className="tsm-prize-rank">{i + 1}위</span>
                    <span className="tsm-prize-input-wrap">
                        <input type="number" value={amt} onChange={e => setAmount(i, Number(e.target.value) || 0)} />
                        <span className="tsm-prize-unit">스톤</span>
                    </span>
                </label>
            ))}
            <label className="tsm-prize-cell tsm-prize-cell--participant">
                <span className="tsm-prize-rank">참가상</span>
                <span className="tsm-prize-input-wrap">
                    <input
                        type="number"
                        value={prizes.participant}
                        onChange={e =>
                            onChange(swissRowFromRankAmounts(getSwissRankAmounts(prizes, paidCount), Number(e.target.value) || 0))
                        }
                    />
                    <span className="tsm-prize-unit">스톤</span>
                </span>
            </label>
        </div>
    );
};

/** 순위 상금 그리드 (토너먼트·풀리그·더블엘리) */
export const BracketRankPrizeFields = ({
    paidCount,
    prizes,
    onChange,
}: {
    paidCount: number;
    prizes: TournamentBracketGroupPrizes;
    onChange: (next: TournamentBracketGroupPrizes) => void;
}) => {
    const amounts = getBracketRankAmounts(prizes, paidCount);
    const setAmount = (i: number, v: number) => {
        const next = [...amounts];
        next[i] = v;
        onChange(bracketRowFromRankAmounts(next, prizes.participant));
    };
    const rankLabel = (i: number) => {
        if (i === 0) return '우승';
        if (i === 1) return '준우승';
        return `${i + 1}위`;
    };
    return (
        <div className="tsm-prize-grid">
            {amounts.map((amt, i) => (
                <label key={i} className={`tsm-prize-cell${i < 4 ? ` tsm-prize-cell--r${i + 1}` : ''}`}>
                    <span className="tsm-prize-rank">{rankLabel(i)}</span>
                    <span className="tsm-prize-input-wrap">
                        <input type="number" value={amt} onChange={e => setAmount(i, Number(e.target.value) || 0)} />
                        <span className="tsm-prize-unit">스톤</span>
                    </span>
                </label>
            ))}
            <label className="tsm-prize-cell tsm-prize-cell--participant">
                <span className="tsm-prize-rank">참가상</span>
                <span className="tsm-prize-input-wrap">
                    <input
                        type="number"
                        value={prizes.participant}
                        onChange={e =>
                            onChange(bracketRowFromRankAmounts(getBracketRankAmounts(prizes, paidCount), Number(e.target.value) || 0))
                        }
                    />
                    <span className="tsm-prize-unit">스톤</span>
                </span>
            </label>
        </div>
    );
};

export const BracketGroupPrizesEditor = ({
    settings,
    onChange,
}: {
    settings: TournamentSettings;
    onChange: Setter;
}) => {
    const paidCount = getBracketPaidRankCount(settings);
    const rows = settings.bracketPrizesByGroup;
    const list: TournamentBracketGroupPrizes[] =
        rows && rows.length > 0 ? rows : [defaultBracketGroupPrize(settings)];

    const setRows = (next: TournamentBracketGroupPrizes[]) => {
        onChange('bracketPrizesByGroup', next.length ? next : undefined);
    };

    return (
        <div className="tsm-card">
            <div className="tsm-card-head">
                <h4>조별 상금</h4>
                <p>행을 여러 개 두면 시상 시 조를 골라 해당 금액으로 지급합니다.</p>
            </div>
            {list.map((row, idx) => (
                <div key={idx} className="tsm-group-block">
                    <div className="tsm-group-block-head">
                        <strong>{idx + 1}조</strong>
                        {list.length > 1 && (
                            <button type="button" className="btn-sm danger" onClick={() => setRows(list.filter((_, i) => i !== idx))}>
                                삭제
                            </button>
                        )}
                    </div>
                    <BracketRankPrizeFields paidCount={paidCount} prizes={row} onChange={next => setRows(list.map((r, i) => (i === idx ? next : r)))} />
                </div>
            ))}
            <div className="tsm-card-actions">
                <button type="button" className="btn-sm" onClick={() => setRows([...list, { ...list[list.length - 1] }])}>
                    조 추가
                </button>
                <button type="button" className="btn-sm" onClick={() => onChange('bracketPrizesByGroup', undefined)}>
                    조별 상금 끄기
                </button>
            </div>
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
            <div className="tsm-card">
                <div className="tsm-card-head">
                    <h4>조별 상금·인원</h4>
                    <p className="tsm-warn">위에서 조 인원을 먼저 입력해 주세요. (예: 4,4,8)</p>
                </div>
            </div>
        );
    }

    if (settings.swissUseGroups) {
        const idx = Math.min(activeTab, groupedList.length - 1);
        const row = groupedList[idx] ?? defaultSwissGroupPrize(settings);
        const sizeVal = groupSizes[idx] ?? 0;

        return (
            <div className="tsm-card">
                <div className="tsm-card-head">
                    <h4>조별 상금·인원</h4>
                    <p>탭마다 해당 조 인원과 상금을 설정합니다.</p>
                </div>
                <div className="tsm-tabs">
                    {groupSizes.map((sz, i) => (
                        <button
                            key={i}
                            type="button"
                            className={`tsm-tab${i === idx ? ' is-active' : ''}`}
                            onClick={() => setActiveTab(i)}
                        >
                            {i + 1}조 · {sz}명
                        </button>
                    ))}
                </div>
                <div className="tsm-group-block">
                    <div className="tsm-field-inline">
                        <label htmlFor={`swiss-grp-${idx}-size`}>이 조 인원</label>
                        <span className="tsm-prize-input-wrap">
                            <input
                                id={`swiss-grp-${idx}-size`}
                                type="number"
                                min={1}
                                value={sizeVal}
                                onChange={e => setGroupSizeAt(idx, Number(e.target.value))}
                            />
                            <span className="tsm-prize-unit">명</span>
                        </span>
                    </div>
                    <SwissRankPrizeFields paidCount={paidCount} prizes={row} onChange={r => updateRow(idx, r)} />
                </div>
                <div className="tsm-card-actions">
                    <button type="button" className="btn-sm" onClick={() => onChange('swissPrizesByGroup', undefined)}>
                        조별 상금 끄기
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="tsm-card">
            <div className="tsm-card-head">
                <h4>시상 기본값 (전체)</h4>
                <p>조별 스위스를 끈 상태의 시상 기본값입니다.</p>
            </div>
            <div className="tsm-group-block">
                <SwissRankPrizeFields paidCount={paidCount} prizes={list[0]} onChange={r => setRows([r])} />
            </div>
            <div className="tsm-card-actions">
                <button type="button" className="btn-sm" onClick={() => onChange('swissPrizesByGroup', undefined)}>
                    조별 상금 끄기
                </button>
            </div>
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
        <div className="tsm-card">
            <div className="tsm-card-head">
                <h4>팀별 상금</h4>
                <p>1조 = A팀, 2조 = B팀 기준으로 승리·패배 시 지급액을 다르게 둘 수 있습니다.</p>
            </div>
            <div className="tsm-relay-grid">
                {list.map((row, idx) => (
                    <div key={idx} className="tsm-group-block">
                        <div className="tsm-group-block-head">
                            <strong>
                                {idx + 1}조 ({idx === 0 ? 'A팀' : idx === 1 ? 'B팀' : `팀 ${idx + 1}`})
                            </strong>
                            {list.length > 2 && (
                                <button type="button" className="btn-sm danger" onClick={() => setRows(list.filter((_, i) => i !== idx))}>
                                    삭제
                                </button>
                            )}
                        </div>
                        <div className="tsm-prize-grid tsm-prize-grid--3">
                            <label className="tsm-prize-cell">
                                <span className="tsm-prize-rank">승리 시</span>
                                <span className="tsm-prize-input-wrap">
                                    <input type="number" value={row.winPrize} onChange={e => update(idx, { winPrize: Number(e.target.value) || 0 })} />
                                    <span className="tsm-prize-unit">스톤</span>
                                </span>
                            </label>
                            <label className="tsm-prize-cell">
                                <span className="tsm-prize-rank">패배 시</span>
                                <span className="tsm-prize-input-wrap">
                                    <input type="number" value={row.losePrize} onChange={e => update(idx, { losePrize: Number(e.target.value) || 0 })} />
                                    <span className="tsm-prize-unit">스톤</span>
                                </span>
                            </label>
                            <label className="tsm-prize-cell">
                                <span className="tsm-prize-rank">참가</span>
                                <span className="tsm-prize-input-wrap">
                                    <input
                                        type="number"
                                        value={row.participantPrize}
                                        onChange={e => update(idx, { participantPrize: Number(e.target.value) || 0 })}
                                    />
                                    <span className="tsm-prize-unit">스톤</span>
                                </span>
                            </label>
                        </div>
                    </div>
                ))}
            </div>
            <div className="tsm-card-actions">
                <button type="button" className="btn-sm" onClick={() => setRows([...list, { ...list[list.length - 1] }])}>
                    조 추가
                </button>
                <button type="button" className="btn-sm" onClick={() => onChange('relayPrizesByGroup', undefined)}>
                    조별 상금 끄기
                </button>
            </div>
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

    return (
        <div className="tsm-card">
            <div className="tsm-card-head">
                <h4>예선 조별 상금</h4>
                <p>「순위 상금 (몇 등까지)」설정과 동일한 칸 수가 적용됩니다.</p>
            </div>
            {list.map((row, idx) => (
                <div key={idx} className="tsm-group-block">
                    <div className="tsm-group-block-head">
                        <strong>예선 {idx + 1}조</strong>
                        {list.length > 1 && (
                            <button type="button" className="btn-sm danger" onClick={() => setRows(list.filter((_, i) => i !== idx))}>
                                삭제
                            </button>
                        )}
                    </div>
                    <SwissRankPrizeFields paidCount={paidCount} prizes={row} onChange={next => setRows(list.map((r, i) => (i === idx ? next : r)))} />
                </div>
            ))}
            <div className="tsm-card-actions">
                <button type="button" className="btn-sm" onClick={() => setRows([...list, { ...list[list.length - 1] }])}>
                    조 추가
                </button>
                <button type="button" className="btn-sm" onClick={() => onChange('hybridPrelimPrizesByGroup', undefined)}>
                    조별 상금 끄기
                </button>
            </div>
        </div>
    );
};

export const HybridBracketGroupPrizesEditor = ({ settings, onChange }: { settings: TournamentSettings; onChange: Setter }) => {
    const paidCount = getBracketPaidRankCount(settings);
    const rows = settings.hybridBracketPrizesByGroup;
    const list: TournamentBracketGroupPrizes[] = rows && rows.length > 0 ? rows : [getBracketPrizeRow(settings, 'bracket', 0)];

    const setRows = (next: TournamentBracketGroupPrizes[]) => {
        onChange('hybridBracketPrizesByGroup', next.length ? next : undefined);
    };

    return (
        <div className="tsm-card">
            <div className="tsm-card-head">
                <h4>본선 토너먼트 상금</h4>
                <p>본선 시상 시 사용하는 순위별 금액입니다. 3·4위와 5위 이하를 따로 둘 수 있습니다.</p>
            </div>
            {list.map((row, idx) => (
                <div key={idx} className="tsm-group-block">
                    <div className="tsm-group-block-head">
                        <strong>본선 {idx + 1}조</strong>
                        {list.length > 1 && (
                            <button type="button" className="btn-sm danger" onClick={() => setRows(list.filter((_, i) => i !== idx))}>
                                삭제
                            </button>
                        )}
                    </div>
                    <BracketRankPrizeFields paidCount={paidCount} prizes={row} onChange={next => setRows(list.map((r, i) => (i === idx ? next : r)))} />
                </div>
            ))}
            <div className="tsm-card-actions">
                <button type="button" className="btn-sm" onClick={() => setRows([...list, { ...list[list.length - 1] }])}>
                    조 추가
                </button>
                <button type="button" className="btn-sm" onClick={() => onChange('hybridBracketPrizesByGroup', undefined)}>
                    조별 상금 끄기
                </button>
            </div>
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
        <div className="tsm-card">
            <div className="tsm-card-head">
                <h4>조별 상금 (미션 바둑)</h4>
                <p>선수 카드에서 상금 조를 고르면 종료 시 고정 보너스·참가상에 사용됩니다.</p>
            </div>
            <div className="tsm-relay-grid">
                {list.map((row, idx) => (
                    <div key={idx} className="tsm-group-block">
                        <div className="tsm-group-block-head">
                            <strong>{idx + 1}조</strong>
                            {list.length > 1 && (
                                <button type="button" className="btn-sm danger" onClick={() => setRows(list.filter((_, i) => i !== idx))}>
                                    삭제
                                </button>
                            )}
                        </div>
                        <div className="tsm-prize-grid tsm-prize-grid--2">
                            <label className="tsm-prize-cell">
                                <span className="tsm-prize-rank">종료 보너스</span>
                                <span className="tsm-prize-input-wrap">
                                    <input type="number" value={row.finishFlatBonus} onChange={e => update(idx, { finishFlatBonus: Number(e.target.value) || 0 })} />
                                    <span className="tsm-prize-unit">스톤</span>
                                </span>
                            </label>
                            <label className="tsm-prize-cell">
                                <span className="tsm-prize-rank">참가상</span>
                                <span className="tsm-prize-input-wrap">
                                    <input
                                        type="number"
                                        value={row.participantPrize}
                                        onChange={e => update(idx, { participantPrize: Number(e.target.value) || 0 })}
                                    />
                                    <span className="tsm-prize-unit">스톤</span>
                                </span>
                            </label>
                        </div>
                    </div>
                ))}
            </div>
            <div className="tsm-card-actions">
                <button type="button" className="btn-sm" onClick={() => setRows([...list, { ...list[list.length - 1] }])}>
                    조 추가
                </button>
                <button type="button" className="btn-sm" onClick={() => onChange('missionPrizesByGroup', undefined)}>
                    조별 상금 끄기
                </button>
            </div>
        </div>
    );
};
