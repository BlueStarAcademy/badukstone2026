import { useRef, useCallback, type PointerEvent, type MouseEvent } from 'react';

/**
 * Prevents accidental modal close when the user starts a drag/selection
 * inside the dialog and releases the pointer on the backdrop.
 */
export function useModalOverlayDismiss(onClose: () => void) {
    const startedOnOverlay = useRef(false);

    const onPointerDown = useCallback((e: PointerEvent<HTMLElement>) => {
        startedOnOverlay.current = e.target === e.currentTarget;
    }, []);

    const onClick = useCallback(
        (e: MouseEvent<HTMLElement>) => {
            if (e.target === e.currentTarget && startedOnOverlay.current) {
                onClose();
            }
            startedOnOverlay.current = false;
        },
        [onClose]
    );

    return { onPointerDown, onClick };
}
