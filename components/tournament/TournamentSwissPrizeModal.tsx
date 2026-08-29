import React, { useState, useEffect, useMemo } from 'react';
import type { TournamentSettings, SwissData, TournamentSwissGroupPrizes } from '../../types';
import { sortSwissPlayers } from '../../utils';
import { getSwissPrizeRow, getSwissPaidRankCount } from '../../utils/tournamentPrizes';
import { SwissRankPrizeFields } from '../modals/TournamentGroupPrizeEditors';
import { ModalShell } from '../ui/ModalShell';

export type SwissPrizeAwardEntry = { groupIndex: number; prizes: TournamentSwissGroupPrizes };

interface TournamentSwissPrizeModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: TournamentSettings;
    swissData?: SwissData;
    onAwardPrizes: (entries: SwissPrizeAwardEntry[]) => void;
}

export const TournamentSwissPrizeModal = ({ isOpen, onClose, settings, swissData, onAwardPrizes }: TournamentSwissPrizeModalProps) => {
    const [prizeByGroup, setPrizeByGroup] = useState<TournamentSwissGroupPrizes[]>([]);

    const finalRankSections = useMemo(() => {
        if (!swissData) return [] as { groupLabel: string; groupIndex: number; ranks: { name: string; rank: number; score: number; sos: number; sosos: number }[] }[];

        const buildRanksFor = (sortedPlayers: ReturnType<typeof sortSwissPlayers>) => {
            const ranks: { name: string; rank: number; score: number; sos: number; sosos: number }[] = [];
            let currentRank = 1;
            for (let i = 0; i < sortedPlayers.length; i++) {
                if (i > 0) {
                    const prev = sortedPlayers[i - 1];
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
                    sosos: sortedPlayers[i].sosos,
                });
            }
            return ranks;
        };

        if (swissData.groups?.length) {
            return swissData.groups.map((g, groupIndex) => ({
                groupLabel: g.label,
                groupIndex,
                ranks: buildRanksFor(sortSwissPlayers(g.players, g.rounds)),
            }));
        }

        const sortedPlayers = sortSwissPlayers(swissData.players, swissData.rounds);
        if (sortedPlayers.length === 0) return [];
        return [{ groupLabel: '전체', groupIndex: 0, ranks: buildRanksFor(sortedPlayers) }];
    }, [swissData]);

    useEffect(() => {
        if (!isOpen || !swissData) return;
        const n = finalRankSections.length || 1;
        setPrizeByGroup(Array.from({ length: n }, (_, i) => getSwissPrizeRow(settings, i)));
    }, [isOpen, swissData, settings, finalRankSections.length]);

    if (!isOpen) return null;

    const paidCount = getSwissPaidRankCount(settings);

    const replacePrizeRow = (idx: number, row: TournamentSwissGroupPrizes) => {
        setPrizeByGroup(prev => prev.map((r, i) => (i === idx ? row : r)));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const entries: SwissPrizeAwardEntry[] = finalRankSections.map((s, i) => ({
            groupIndex: s.groupIndex,
            prizes: prizeByGroup[i] || getSwissPrizeRow(settings, s.groupIndex),
        }));
        onAwardPrizes(entries);
    };

    return (
        <ModalShell
            title="스위스 리그 결과 시상"
            size="xl"
            onClose={onClose}
            footer={
                <>
                    <button type="button" className="btn" onClick={onClose}>
                        취소
                    </button>
                    <button type="submit" form="tournament-swiss-prize-form" className="btn primary">
                        스톤 지급
                    </button>
                </>
            }
        >
                <form id="tournament-swiss-prize-form" onSubmit={handleSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                        <div>
                            <h4>최종 순위</h4>
                            <div style={{ maxHeight: '360px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '0.5rem' }}>
                                {finalRankSections.map((section, si) => (
                                    <div key={si} style={{ marginBottom: si < finalRankSections.length - 1 ? '1rem' : 0 }}>
                                        {finalRankSections.length > 1 && (
                                            <h5 style={{ margin: '0 0 0.35rem 0', fontSize: '0.95rem' }}>{section.groupLabel}</h5>
                                        )}
                                        <table className="swiss-standings-table">
                                            <thead>
                                                <tr>
                                                    <th>순위</th>
                                                    <th>이름</th>
                                                    <th>승점</th>
                                                    <th>SOS</th>
                                                    <th>SOSOS</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {section.ranks.map((p, i) => (
                                                    <tr key={`${si}-${i}`}>
                                                        <td>{p.rank}</td>
                                                        <td>{p.name}</td>
                                                        <td>{p.score}</td>
                                                        <td>{p.sos}</td>
                                                        <td>{p.sosos}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="settings-form-section" style={{ marginTop: 0, maxHeight: '360px', overflowY: 'auto' }}>
                            <h4>보상 설정 (스톤)</h4>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-color-secondary)', marginBottom: '0.75rem' }}>
                                조별로 금액이 다르면 아래에서 조마다 수정한 뒤 한 번에 지급합니다.
                            </p>
                            {finalRankSections.map((section, si) => {
                                const pz = prizeByGroup[si] || getSwissPrizeRow(settings, section.groupIndex);
                                return (
                                    <div
                                        key={si}
                                        style={{
                                            border: '1px solid var(--border-color)',
                                            borderRadius: 8,
                                            padding: '0.65rem',
                                            marginBottom: '0.65rem',
                                            background: 'var(--surface-color-hover)',
                                        }}
                                    >
                                        <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem' }}>{section.groupLabel}</h5>
                                        <SwissRankPrizeFields
                                            paidCount={paidCount}
                                            prizes={pz}
                                            onChange={row => replacePrizeRow(si, row)}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </form>
        </ModalShell>
    );
};
