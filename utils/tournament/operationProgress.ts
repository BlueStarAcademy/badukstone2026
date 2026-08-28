export interface OperationProgress {
    completed: number;
    total: number;
    remaining: number;
    ratio: number;
    isComplete: boolean;
}

export function getOperationProgress<T>(items: T[], isCompleted: (item: T) => boolean): OperationProgress {
    const completed = items.filter(isCompleted).length;
    const total = items.length;
    return {
        completed,
        total,
        remaining: total - completed,
        ratio: total === 0 ? 0 : completed / total,
        isComplete: total > 0 && completed === total,
    };
}
