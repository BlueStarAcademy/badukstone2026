import React, { useEffect, useMemo } from 'react';
import {
    describeElimBracketPlan,
    formatStartRoundLabel,
    listValidStartRoundSizes,
    planCompactElimBracket,
} from '../../utils/elimBracket';

interface StartRoundSelectProps {
    playerCount: number;
    value: number | null;
    onChange: (size: number | null) => void;
    id?: string;
    disabled?: boolean;
    className?: string;
    showHint?: boolean;
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
}) => {
    const options = useMemo(() => listValidStartRoundSizes(playerCount), [playerCount]);
    const autoStartRound = useMemo(() => {
        if (playerCount < 2) return null;
        return planCompactElimBracket(playerCount).mainDrawSize;
    }, [playerCount]);

    useEffect(() => {
        if (value == null) return;
        if (!options.includes(value)) onChange(null);
    }, [value, options, onChange]);

    const hint = useMemo(() => {
        if (!showHint || playerCount < 2) return null;
        return describeElimBracketPlan(playerCount, value);
    }, [showHint, playerCount, value]);

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
