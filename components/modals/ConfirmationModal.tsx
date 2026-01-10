import React from 'react';

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
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content confirmation-modal-content" onClick={(e) => e.stopPropagation()}>
                <p style={{ whiteSpace: 'pre-wrap' }}>{message}</p>
                <div className="modal-actions">
                    {actions.map((action, index) => (
                        <button key={index} type="button" className={`btn ${action.className || ''}`} onClick={action.onClick}>
                            {action.text}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};