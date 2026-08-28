import React from 'react';
import type { TournamentOperationStage, TournamentOperationStatus } from '../../utils/tournament/operationProgress';

const STAGES: TournamentOperationStage[] = ['설정', '참가자', '대진', '경기', '순위', '시상'];

interface TournamentOperationsHeaderProps {
    modeName: string;
    status: TournamentOperationStatus;
}

export const TournamentOperationsHeader = ({ modeName, status }: TournamentOperationsHeaderProps) => {
    const activeIndex = STAGES.indexOf(status.stage);
    const percent = Math.round(status.ratio * 100);

    return (
        <section className="tournament-operations" aria-label={`${modeName} 운영 진행`}>
            <div className="tournament-operation-stages" role="list" aria-label="대회 운영 단계">
                {STAGES.map((stage, index) => (
                    <div
                        key={stage}
                        role="listitem"
                        className={`tournament-operation-stage ${index < activeIndex ? 'complete' : ''} ${index === activeIndex ? 'active' : ''}`}
                        aria-current={index === activeIndex ? 'step' : undefined}
                    >
                        <span className="operation-stage-number">{index < activeIndex ? '✓' : index + 1}</span>
                        <span>{stage}</span>
                    </div>
                ))}
            </div>
            <div className="tournament-operation-summary">
                <div>
                    <strong>{modeName} · 현재 단계: {status.stage}</strong>
                    <p>{status.nextAction}</p>
                </div>
                <div className="tournament-operation-counts" aria-live="polite">
                    <span>완료 <strong>{status.completed}/{status.total}</strong>경기</span>
                    <span>남은 경기 <strong>{status.remaining}</strong></span>
                    {status.awardsRequired > 0 && <span>시상 <strong>{status.awardsCompleted}/{status.awardsRequired}</strong></span>}
                </div>
            </div>
            <div className="tournament-operation-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
                <span style={{ width: `${percent}%` }} />
            </div>
        </section>
    );
};
