
import { useState, useEffect } from 'react';

/** 오늘 날짜 문자열 (YYYY-MM-DD). 날짜가 바뀌면 값이 변경되어 의존 컴포넌트가 갱신됨 */
export function useDateKey(): string {
    const [dateKey, setDateKey] = useState(() => 
        new Date().toISOString().slice(0, 10)
    );

    useEffect(() => {
        const updateIfNeeded = () => {
            const today = new Date().toISOString().slice(0, 10);
            setDateKey(prev => (prev !== today ? today : prev));
        };

        // 탭 포커스 시 (날짜 변경 감지)
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') updateIfNeeded();
        };
        document.addEventListener('visibilitychange', onVisibilityChange);

        // 1분마다 체크 (자정 넘김 감지)
        const interval = setInterval(updateIfNeeded, 60_000);

        return () => {
            document.removeEventListener('visibilitychange', onVisibilityChange);
            clearInterval(interval);
        };
    }, []);

    return dateKey;
}
