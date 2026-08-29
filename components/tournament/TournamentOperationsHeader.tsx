import React from 'react';
import type { TournamentOperationStage, TournamentOperationStatus } from '../../utils/tournament/operationProgress';

const STAGES: TournamentOperationStage[] = ['설정', '참가자', '대진', '경기', '순위', '시상'];

interface TournamentOperationsHeaderProps {
    id?: string;
    modeName: string;
    status: TournamentOperationStatus;
}

export const TournamentOperationsHeader = ({ id, modeName, status }: TournamentOperationsHeaderProps) => {
    const activeIndex = STAGES.indexOf(status.stage);
    const percent = Math.round(status.ratio * 100);

    return (
        <section id={id} className="tournament-operations" aria-label={`${modeName} 운영 진행`}>
            <div className="tournament-operation-heading">
                <div>
                    <span className="operation-eyebrow">LIVE TOURNAMENT CONTROL</span>
                    <h3>{modeName} 운영 현황</h3>
                </div>
                <div className="operation-current-stage">
                    <span>현재 단계</span>
                    <strong>{status.stage}</strong>
                </div>
            </div>
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
                <div className="operation-next-action">
                    <span>다음 운영 작업</span>
                    <p>{status.nextAction}</p>
                </div>
                <div className="tournament-operation-counts" aria-live="polite">
                    <span><small>완료 경기</small><strong>{status.completed}<em>/ {status.total}</em></strong></span>
                    <span><small>남은 경기</small><strong>{status.remaining}</strong></span>
                    <span className={status.awardsRequired === 0 ? 'is-muted' : ''}>
                        <small>시상 완료</small>
                        <strong>{status.awardsCompleted}<em>/ {status.awardsRequired}</em></strong>
                    </span>
                </div>
            </div>
            <div className="tournament-operation-progress">
                <div>
                    <span>전체 경기 진행률</span>
                    <strong>{percent}%</strong>
                </div>
                <progress value={percent} max={100} aria-label={`${modeName} 경기 진행률 ${percent}%`}>
                    {percent}%
                </progress>
            </div>
        </section>
    );
};
