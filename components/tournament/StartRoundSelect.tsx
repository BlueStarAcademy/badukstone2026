import React, { useEffect, useMemo } from 'react';
import {
    describeDoubleElimBracketPlan,
    describeElimBracketPlan,
    formatStartRoundLabel,
    listValidDoubleElimStartRoundSizes,
    listValidStartRoundSizes,
    planCompactElimBracket,
    planDoubleElimBracket,
} from '../../utils/elimBracket';

interface StartRoundSelectProps {
    playerCount: number;
    value: number | null;
    onChange: (size: number | null) => void;
    id?: string;
    disabled?: boolean;
    className?: string;
    showHint?: boolean;
    /** 단판(예선 허용) vs 더블엘리미(자동은 부전승 패딩) */
    variant?: 'single' | 'double';
}

/** 몇강전부터 시작할지 선택 (null = 자동) */
export const StartRoundSelect: React.FC<StartRoundSelectProps> = ({
    playerCount,
    value,
    onChange,
    id = 'start-round-size',
    disabled = false,
    className = 'tournament-player-mgmt-assign',
    showHint = true,
    variant = 'single',
}) => {
    const options = useMemo(
        () =>
            variant === 'double'
                ? listValidDoubleElimStartRoundSizes(playerCount)
                : listValidStartRoundSizes(playerCount),
        [playerCount, variant]
    );
    const autoStartRound = useMemo(() => {
        if (playerCount < 2) return null;
        return variant === 'double'
            ? planDoubleElimBracket(playerCount).mainDrawSize
            : planCompactElimBracket(playerCount).mainDrawSize;
    }, [playerCount, variant]);

    useEffect(() => {
        if (value == null) return;
        if (!options.includes(value)) onChange(null);
    }, [value, options, onChange]);

    const hint = useMemo(() => {
        if (!showHint || playerCount < 2) return null;
        return variant === 'double'
            ? describeDoubleElimBracketPlan(playerCount, value)
            : describeElimBracketPlan(playerCount, value);
    }, [showHint, playerCount, value, variant]);

    return (
        <div className={className}>
            <label htmlFor={id}>몇강전부터</label>
            <select
                id={id}
                value={value ?? 'auto'}
                onChange={e => {
                    const next = e.target.value;
                    onChange(next === 'auto' ? null : Number(next));
                }}
                disabled={disabled || playerCount < 2}
            >
                <option value="auto">
                    자동{autoStartRound ? ` (${formatStartRoundLabel(autoStartRound)})` : ''}
                </option>
                {options.map(size => (
                    <option key={size} value={size}>
                        {formatStartRoundLabel(size)}
                    </option>
                ))}
            </select>
            {hint ? <p className="tournament-start-round-hint">{hint}</p> : null}
        </div>
    );
};
