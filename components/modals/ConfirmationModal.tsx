import React from 'react';
import { ModalShell } from '../ui/ModalShell';

export interface ActionButton {
    text: string;
    onClick: () => void;
    className?: string; // e.g. 'primary', 'danger'
}

interface ConfirmationModalProps {
    message: React.ReactNode;
    actions: ActionButton[];
    onClose: () => void;
}

export const ConfirmationModal = ({ message, actions, onClose }: ConfirmationModalProps) => {
    return (
        <ModalShell
            title="확인"
            size="sm"
            onClose={onClose}
            footer={actions.map((action, index) => (
                <button key={index} type="button" className={`btn ${action.className || ''}`} onClick={action.onClick}>
                    {action.text}
                </button>
            ))}
        >
            <p style={{ whiteSpace: 'pre-wrap' }}>{message}</p>
        </ModalShell>
    );
};