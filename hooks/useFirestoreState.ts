
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db, isDemoMode } from '../firebase';
import type { AppData } from '../types';

type SetState<T> = React.Dispatch<React.SetStateAction<T | 'error' | null>>;

export function useFirestoreState<T extends AppData>(
    userId: string | null,
    getInitialData: () => T
): [T | 'error' | null, SetState<T>] {
    const [state, setState] = useState<T | 'error' | null>(null);
    const isWriting = useRef(false);
    const writeTimeout = useRef<number | null>(null);

    useEffect(() => {
        if (!userId) {
            setState(null);
            return;
        }

        // Demo Mode / Offline Fallback
        if (isDemoMode || !db) {
            console.log("Running in Demo Mode (Local State)");
            const initialData = getInitialData();
            // Load from localStorage if available to persist across reloads in demo mode
            const saved = localStorage.getItem(`demo_data_${userId}`);
            if (saved) {
                try {
                    setState(JSON.parse(saved));
                } catch (e) {
                    setState(initialData);
                }
            } else {
                setState(initialData);
            }
            return;
        }

        const docRef = doc(db, 'users', userId);

        const unsubscribe = onSnapshot(docRef, async (docSnap) => {
            if (isWriting.current) return;

            if (docSnap.exists()) {
                const cloudData = docSnap.data() as Partial<T>;
                const initialState = getInitialData();
                const mergedData = {
                    ...initialState,
                    ...cloudData,
                    generalSettings: { ...initialState.generalSettings, ...(cloudData.generalSettings || {}) },
                    groupSettings: { ...initialState.groupSettings, ...(cloudData.groupSettings || {}) },
                    eventSettings: { ...initialState.eventSettings, ...(cloudData.eventSettings || {}) },
                    shopSettings: { ...initialState.shopSettings, ...(cloudData.shopSettings || {}) },
                    tournamentSettings: { ...initialState.tournamentSettings, ...(cloudData.tournamentSettings || {}) },
                };
                setState(mergedData as T);
            } else {
                const initialData = getInitialData();
                await setDoc(docRef, initialData);
                setState(initialData);
            }
        }, (error) => {
            console.error("Firestore snapshot error:", error);
            // Don't error out completely, fallback to local
            setState(getInitialData()); 
        });

        return () => unsubscribe();
    }, [userId, getInitialData]);

    const setDebouncedState: SetState<T> = useCallback((newStateOrFn) => {
        setState(prevState => {
            const newState = typeof newStateOrFn === 'function'
                ? newStateOrFn(prevState)
                : newStateOrFn;

            if (newState && newState !== 'error' && userId) {
                // If Demo Mode, save to localStorage
                if (isDemoMode || !db) {
                    localStorage.setItem(`demo_data_${userId}`, JSON.stringify(newState));
                    return newState;
                }

                // If Firebase Mode, write to DB with debounce
                if (writeTimeout.current) {
                    clearTimeout(writeTimeout.current);
                }
                isWriting.current = true;
                
                writeTimeout.current = window.setTimeout(async () => {
                    try {
                        const docRef = doc(db, 'users', userId);
                        await setDoc(docRef, newState, { merge: true });
                    } catch (error) {
                        console.error("Failed to save data to Firestore:", error);
                    } finally {
                        isWriting.current = false;
                        writeTimeout.current = null;
                    }
                }, 1000);
            }
            return newState;
        });
    }, [userId]);

    return [state, setDebouncedState];
}
