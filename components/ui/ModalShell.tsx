import React from 'react';
import { useModalOverlayDismiss } from '../modals/useModalOverlayDismiss';

export type ModalShellSize = 'sm' | 'md' | 'lg' | 'xl';

interface ModalShellProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  size?: ModalShellSize;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  /** When false, overlay click does not dismiss (default true). */
  dismissible?: boolean;
}

const sizeClass: Record<ModalShellSize, string> = {
  sm: 'ui-modal--sm',
  md: 'ui-modal--md',
  lg: 'ui-modal--lg',
  xl: 'ui-modal--xl',
};

export const ModalShell: React.FC<ModalShellProps> = ({
  title,
  description,
  icon,
  size = 'md',
  onClose,
  footer,
  children,
  className = '',
  bodyClassName = '',
  dismissible = true,
}) => {
  const { onPointerDown, onClick } = useModalOverlayDismiss(onClose);

  return (
    <div
      className="modal-overlay"
      onPointerDown={dismissible ? onPointerDown : undefined}
      onClick={dismissible ? onClick : undefined}
      role="presentation"
    >
      <div
        className={`modal-content ui-modal ${sizeClass[size]} ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ui-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={`ui-modal-header${icon ? '' : ' ui-modal-header--no-icon'}`}>
          {icon ? (
            <div className="ui-modal-icon" aria-hidden>
              {icon}
            </div>
          ) : null}
          <div className="ui-modal-heading">
            <h2 id="ui-modal-title">{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <button type="button" className="ui-modal-close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </header>
        <div className={`ui-modal-body ${bodyClassName}`.trim()}>{children}</div>
        {footer ? <div className="modal-actions ui-modal-actions">{footer}</div> : null}
      </div>
    </div>
  );
};

export default ModalShell;
