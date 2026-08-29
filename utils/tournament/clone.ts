/** 대회 상태 불변 갱신용 깊은 복사 (structuredClone 우선) */
export function cloneDeep<T>(value: T): T {
    if (typeof structuredClone === 'function') {
        return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value)) as T;
}
