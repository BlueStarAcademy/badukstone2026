import React, { useState, useEffect } from 'react';
import type { SwissGroupData } from '../../types';
import { ModalShell } from '../ui/ModalShell';

interface SwissGroupPlayerSwapModalProps {
    isOpen: boolean;
    onClose: () => void;
    groups: SwissGroupData[];
    onSwap: (groupIndexA: number, studentIdA: string, groupIndexB: number, studentIdB: string) => void;
}

export const SwissGroupPlayerSwapModal = ({ isOpen, onClose, groups, onSwap }: SwissGroupPlayerSwapModalProps) => {
    const [idxA, setIdxA] = useState(0);
    const [idxB, setIdxB] = useState(1);
    const [idA, setIdA] = useState('');
    const [idB, setIdB] = useState('');
    const playersA = groups[idxA]?.players ?? [];
    const playersB = groups[idxB]?.players ?? [];
    const listA = groups[idxA]?.players;
    const listB = groups[idxB]?.players;

    useEffect(() => {
        if (!isOpen) return;
        if (groups.length < 2) return;
        setIdxA(0);
        setIdxB(Math.min(1, groups.length - 1));
    }, [isOpen, groups.length]);

    useEffect(() => {
        if (!isOpen) return;
        const first = listA?.[0]?.studentId;
        setIdA(first ?? '');
    }, [idxA, isOpen, listA]);

    useEffect(() => {
        if (!isOpen) return;
        const first = listB?.[0]?.studentId;
        setIdB(first ?? '');
    }, [idxB, isOpen, listB]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (groups.length < 2) return;
        if (idxA === idxB) {
            alert('서로 다른 조를 선택해 주세요.');
            return;
        }
        if (!idA || !idB) {
            alert('양쪽 조에서 선수를 선택해 주세요.');
            return;
        }
        if (idA === idB) {
            alert('서로 다른 선수를 선택해 주세요.');
            return;
        }
        onSwap(idxA, idA, idxB, idB);
        onClose();
    };

    return (
        <ModalShell
            title="조 간 선수 교체"
            size="sm"
            onClose={onClose}
            footer={
                <>
                    <button type="button" className="btn" onClick={onClose}>
                        취소
                    </button>
                    <button type="submit" form="swiss-group-player-swap-form" className="btn primary">
                        교체
                    </button>
                </>
            }
        >
                <form id="swiss-group-player-swap-form" onSubmit={handleSubmit}>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-color-secondary)', marginBottom: '1rem' }}>
                            한 조의 선수와 다른 조의 선수를 맞바꿉니다. 두 조의 기존 대진·승점은 각 조 안에서 그대로 이어지며, 선수 소속만 바뀝니다.
                        </p>
                        <div className="settings-form-section" style={{ marginTop: 0 }}>
                            <h4 style={{ margin: '0 0 0.5rem 0' }}>선수 1</h4>
                            <div className="settings-form-row">
                                <div className="label-group">
                                    <label htmlFor="swap-g-a">조</label>
                                </div>
                                <select id="swap-g-a" value={String(idxA)} onChange={e => setIdxA(Number(e.target.value))}>
                                    {groups.map((g, i) => (
                                        <option key={g.id} value={String(i)}>
                                            {g.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="settings-form-row">
                                <div className="label-group">
                                    <label htmlFor="swap-p-a">선수</label>
                                </div>
                                <select id="swap-p-a" value={idA} onChange={e => setIdA(e.target.value)}>
                                    {playersA.map(p => (
                                        <option key={p.studentId} value={p.studentId}>
                                            {p.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="settings-form-section" style={{ marginTop: '1rem' }}>
                            <h4 style={{ margin: '0 0 0.5rem 0' }}>선수 2</h4>
                            <div className="settings-form-row">
                                <div className="label-group">
                                    <label htmlFor="swap-g-b">조</label>
                                </div>
                                <select id="swap-g-b" value={String(idxB)} onChange={e => setIdxB(Number(e.target.value))}>
                                    {groups.map((g, i) => (
                                        <option key={g.id} value={String(i)}>
                                            {g.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="settings-form-row">
                                <div className="label-group">
                                    <label htmlFor="swap-p-b">선수</label>
                                </div>
                                <select id="swap-p-b" value={idB} onChange={e => setIdB(e.target.value)}>
                                    {playersB.map(p => (
                                        <option key={p.studentId} value={p.studentId}>
                                            {p.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                </form>
        </ModalShell>
    );
};
