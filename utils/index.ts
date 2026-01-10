export const parseRank = (rankStr: string): number => {
    const cleanRank = rankStr.trim();
    
    if (cleanRank.includes('단')) {
        return 100 + parseInt(cleanRank.replace('단', ''), 10);
    }
    if (cleanRank.includes('급')) {
        return 100 - parseInt(cleanRank.replace('급', ''), 10);
    }
    if (cleanRank === '입문') {
        return 69; // 30급이 70이므로 그보다 낮게 설정 (effectively 31급)
    }
    return 0;
};

export const getGroupForRank = (rankStr: string): { group: string } => {
    const rankNum = parseRank(rankStr);
    if (rankNum >= 101) return { group: '유단자' }; // 1단 이상
    if (rankNum >= 91) return { group: '고급' };   // 9급(91) ~ 1급(99)
    if (rankNum >= 82) return { group: '중급' };   // 18급(82) ~ 10급(90)
    if (rankNum >= 75) return { group: '초급2' };  // 25급(75) ~ 19급(81)
    return { group: '초급1' };                 // 입문(69), 30급(70) ~ 26급(74)
};

export const generateId = () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const formatRelativeTime = (isoString: string): string => {
    const date = new Date(isoString);
    const now = new Date();
    const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);

    if (seconds < 60) return `${seconds}초 전`;
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    return `${days}일 전`;
};