
export type View = 'student' | 'chess' | 'tournament' | 'event' | 'admin' | 'master';

export interface Student {
    id: string;
    name: string;
    rank: string;
    group: string;
    stones: number;
    maxStones: number;
    status: '재원' | '휴원';
    birthday: string;
    takesChess?: boolean;
    chessRating?: number;
    chessGamesPlayed?: number;
    josekiProgress?: number;
    continuousMissionName?: string; // 개인 연속 미션 내용 (예: 정석 외우기)
    dailySpecialMissionId?: string;
    specialMissionDate?: string;
}

export interface Mission {
    id: string;
    description: string;
    stones: number;
    group?: string;
    type?: 'attendance';
}

export interface SpecialMission {
    id: string;
    content: string;
    /** 레거시 호환(visibleGroups 없을 때 뽑기 규칙에 사용) */
    group?: string;
    /** 노출 반 키 배열. '__all__' 포함 시 전체 반 */
    visibleGroups?: string[];
    stars: number;
    stones: number;
    answer?: string;
    /** 레거시: visibleGroups 도입 이전 데이터용 */
    isExclusive?: boolean;
    isAtLeast?: boolean;
}

export type PersonalMissionType = 'continuous' | 'weekly' | 'monthly' | 'achievement';

export interface PersonalMission {
    id: string;
    ownerStudentId: string;
    /** 그룹 기본 개인 미션 템플릿에서 생성된 카드이면 템플릿 id */
    templateId?: string;
    title: string;
    stones: number;
    no: number;
    /**
     * 연속 미션 | 주간 미션(월요일 초기화) | 월간 미션(매월 1일 초기화) | 업적 미션(1회성)
     * missionType이 없으면 continuous
     */
    missionType?: PersonalMissionType;
    /**
     * 미션 완료 시각(ISO).
     * - 업적: 있으면 영구 완료 처리
     * - 주간/월간: 완료 시각 기준으로 현재 기간(주/월) 중복 완료를 막음
     */
    completedAt?: string;
    /** 노출 반. 없으면 전체. '__all__' 포함 시 전체 반 */
    targetGroups?: string[];
}

export interface PersonalMissionsByStudent {
    [studentId: string]: PersonalMission[];
}

/** 반별로 자동 부여되는 개인 미션 정의(학생 카드에는 templateId로 연결된 인스턴스가 붙음) */
export interface PersonalMissionTemplate {
    id: string;
    title: string;
    stones: number;
    no: number;
    missionType?: PersonalMissionType;
    /** 노출 반. 없으면 전체. '__all__' 포함 시 전체 반 */
    targetGroups?: string[];
}

export interface UsedCouponInfo {
    id: string;
    description: string;
    valueUsed: number;
    originalExpiresAt: string;
}

export interface Transaction {
    id: string;
    studentId: string;
    type: 'mission' | 'attendance' | 'purchase' | 'adjustment' | 'gacha' | 'roulette' | 'chess_attendance' | 'penalty' | 'joseki_mission' | 'transfer' | 'special_mission' | 'mission_adjustment';
    description: string;
    amount: number;
    timestamp: string;
    status: 'active' | 'cancelled';
    stoneBalanceBefore: number;
    stoneBalanceAfter: number;
    eventMonth?: string;
    couponsUsed?: UsedCouponInfo[];
    missionCountDelta?: number; // 미션 횟수 보정값 (+1, -1 등)
    // 연속 개인 미션(continuous) 완료/취소 되돌림용 메타데이터
    personalMissionId?: string;
    personalMissionNoBefore?: number;
    personalMissionNoAfter?: number;
}

export interface Coupon {
    id: string;
    studentId: string;
    description: string;
    value: number;
    expiresAt: string;
}

export interface GroupSetting {
    name: string;
    maxStones: number;
}

export interface GroupSettings {
    [key: string]: GroupSetting;
}

export interface GeneralSettings {
    academyName: string;
    attendanceStoneValue: number;
    josekiMissionValue: number;
    eloKFactor: number;
    chessAttendanceValue: number;
    groupOrder: string[];
    nonChessPlayerRating: number;
    birthdayCouponValue: number;
    specialMissionWeights?: {
        [group: string]: {
            [stars: number]: number; // 1 to 5 stars, value is percentage (0-100)
        }
    };
}

export interface RouletteSegment {
    id: string;
    stones: number;
    weight: number;
}

/** 이벤트 참여 조건(미션/감점 횟수) 및 참여 여부를 트랜잭션 삭제(압축)와 무관하게 유지하기 위한 월별 집계 */
export interface EventMonthlyStats {
    /** monthKey (예: "2025-2") -> studentId -> { missions, penalties, participated? } */
    [monthKey: string]: {
        [studentId: string]: { missions: number; penalties: number; participated?: boolean };
    };
}

export interface EventSettings {
    minMissionsToSpin: number;
    maxPenalties: number;
    rouletteSegments: RouletteSegment[];
    gachaPrizes: {
        first: number;
        second: number;
        third: number;
        fourth: number;
        fifth: number;
    };
    gachaPrizeCounts: {
        first: number;
        second: number;
        third: number;
        fourth: number;
        fifth: number;
    };
}

export interface GachaData {
    prizeMap: number[];
    pickedNumbers: { [studentId: string]: number };
}

export interface GachaState {
    [monthIdentifier: string]: GachaData;
}

export interface TournamentPlayer {
    studentId: string;
    name: string;
    rank: string;
    game1Handicap: number;
    game1Color: 'black' | 'white';
    game1Result: number | null;
    game2Score: number | null;
    game2LastStone: boolean;
    game3Score: number | null;
}

export interface Team {
    name: string;
    players: TournamentPlayer[];
    mannerPenalties?: number;
    bonusScore?: number;
}

export interface TournamentMatch {
    id: string;
    players: (TournamentPlayer | 'BYE' | null)[];
    winnerId: string | null;
}

export interface TournamentBracket {
    rounds: {
        title: string;
        matches: TournamentMatch[];
    }[];
    players: TournamentPlayer[];
}

export interface SwissPlayer {
    studentId: string;
    name: string;
    score: number;
    opponents: string[];
    sos: number;
    sosos: number;
}

export interface SwissMatch {
    id: string;
    players: (string | 'BYE')[];
    winnerId: string | null;
}

/** 조별 스위스: 각 조가 독립된 대진·순위를 가짐 */
export interface SwissGroupData {
    id: string;
    label: string;
    players: SwissPlayer[];
    rounds: SwissMatch[][];
}

export interface SwissData {
    status: 'not_started' | 'in_progress' | 'finished';
    players: SwissPlayer[];
    /** 단일 리그. `groups`가 있으면 비워 둠 */
    rounds: SwissMatch[][];
    groups?: SwissGroupData[];
}

export interface MissionBadukMatchMissionDef {
    id: string;
    template: string;
    min: number;
    max: number;
    defaultStars?: number;
}

export interface MissionBadukWearableMissionDef {
    id: string;
    text: string;
    stars: number;
}

export interface MissionBadukActiveMission {
    matchMission: string;
    wearableMission: string;
    matchMissionStars?: number;
    wearableMissionStars?: number;
    matchMissionPoints?: number;
    matchMissionDefId?: string;
}

export interface MissionBadukPlayer {
    studentId: string;
    name: string;
    status: 'waiting' | 'active' | 'finished';
    /** missionPrizesByGroup 행 인덱스 (기본 0) */
    prizeGroupIndex?: number;
    score: number;
    startTime?: string;
    timeAdded?: number;
    currentMission?: MissionBadukActiveMission;
    matches: any[];
}

export interface MissionBadukData {
    players: MissionBadukPlayer[];
}

/** 풀리그(전체 라운드로빈): 1회전 당 1경기, 매치 리스트 + 순위 */
export interface FullLeagueMatch {
    id: string;
    player1Id: string;
    player2Id: string;
    winnerId: string | null;
}
export interface FullLeagueData {
    players: { studentId: string; name: string; wins: number; losses: number }[];
    matches: FullLeagueMatch[];
}

/** 더블엘리미네이션: 승자조 + 패자조 + 그랜드파이널 */
export interface DoubleElimMatch {
    id: string;
    players: (string | 'BYE' | null)[];
    winnerId: string | null;
}
export interface DoubleElimData {
    winnersRounds: { title: string; matches: DoubleElimMatch[] }[];
    losersRounds: { title: string; matches: DoubleElimMatch[] }[];
    grandFinal: DoubleElimMatch | null;
    playerIds: string[];
}

export interface TournamentData {
    participantIds: string[];
    relayParticipantIds: string[];
    bracketParticipantIds: string[];
    swissParticipantIds: string[];
    hybridParticipantIds: string[];
    fullLeagueParticipantIds: string[];
    doubleElimParticipantIds: string[];
    missionParticipantIds: string[];
    teams: Team[];
    bracket: TournamentBracket | null;
    relay: any;
    swiss?: SwissData;
    missionBaduk?: MissionBadukData;
    hybrid?: {
        players: SwissPlayer[];
        preliminaryGroups: SwissMatch[][];
        bracket: TournamentBracket | null;
    };
    fullLeague?: FullLeagueData;
    doubleElim?: DoubleElimData;
}

export type GameKey = 'game1' | 'game2' | 'game3';
export type GameSelection = GameKey | 'none';

/** 토너먼트·풀리그·더블엘리·예선+본선(본선) 시상 (조별 행) */
export interface TournamentBracketGroupPrizes {
    champion: number;
    runnerUp: number;
    semiFinalist: number;
    participant: number;
}

/** 스위스·예선+본선(예선) 시상 (조별 행) */
export interface TournamentSwissGroupPrizes {
    first: number;
    second: number;
    third: number;
    participant: number;
    /** 4위 이상 상금. 길이 = (설정의 순위 상금 개수 − 3) 이상이면 됨 */
    extraRanks?: number[];
}

/** 팀 대항전: 팀별(1조=A, 2조=B) 시상 기본액 */
export interface TournamentRelayGroupPrizes {
    winPrize: number;
    losePrize: number;
    participantPrize: number;
}

/** 미션 바둑 조별 (선수에 prizeGroupIndex 부여) */
export interface TournamentMissionGroupPrizes {
    participantPrize: number;
    finishFlatBonus: number;
}

/**
 * 부전승·홀수 대진 시 우선순위 (대회 설정에서 선택).
 * - min_byes: 2^n 껍데기에서 부전승 개수는 최소로 두고, 부전승 대상을 순위에 고르게 분산.
 * - min_matches: 강한 시드가 부전승을 우선 → 상위 선수의 실제 대국 수 감소.
 * - max_matches: 약한 시드가 부전승을 우선 → 상위끼리 대국이 많아짐.
 */
export type TournamentByePriority = 'min_byes' | 'min_matches' | 'max_matches';

export interface TournamentSettings {
    games: GameSelection[];
    game1SameRankHandicap: number;
    game1RankDiffHandicap: number;
    game2StoneValue: number;
    game2LastStoneBonus: number;
    game3StoneValue: number;
    relayMannerPenalty: number;
    championPrize: number;
    runnerUpPrize: number;
    semiFinalistPrize: number;
    participantPrize: number;
    swissRounds: number;
    swiss1stPrize: number;
    swiss2ndPrize: number;
    swiss3rdPrize: number;
    /** 1위부터 몇 등까지 순위 상금 칸을 둘지 (기본 3). 참가상은 별도 */
    swissPaidRankCount?: number;
    /** true면 스위스 시작 시 조별로 나눔 (인원은 swissGroupSizes 합과 일치해야 함) */
    swissUseGroups: boolean;
    /** 쉼표로 구분, 예: "4,4,8" — 급수 순/무작위 시드 후 앞에서부터 조에 배정 */
    swissGroupSizes: string;
    missionBaduk?: {
        timeLimit: number;
        scoreToStoneRatio: number;
        matchMissionLabel: string;
        wearableMissionLabel: string;
        matchMissions: MissionBadukMatchMissionDef[];
        wearableMissions: MissionBadukWearableMissionDef[];
        points: {
            win19: number;
            win13: number;
            win9: number;
            matchMissionSuccess: number;
            wearableMissionSuccess: number;
            penaltyDeduction: number;
            star1: number;
            star2: number;
            star3: number;
            star4: number;
            star5: number;
        };
        bonusTiers: {
            id: string;
            label: string;
            rate: number;
            reward: number;
        }[];
    };
    hybridAdvanceCount?: number;
    hybridGroupCount?: number;
    hybridMode?: 'rank' | 'random';
    /** 비어 있으면 championPrize 등 단일 필드 사용 */
    bracketPrizesByGroup?: TournamentBracketGroupPrizes[];
    swissPrizesByGroup?: TournamentSwissGroupPrizes[];
    relayPrizesByGroup?: TournamentRelayGroupPrizes[];
    hybridPrelimPrizesByGroup?: TournamentSwissGroupPrizes[];
    hybridBracketPrizesByGroup?: TournamentBracketGroupPrizes[];
    missionPrizesByGroup?: TournamentMissionGroupPrizes[];
    /** 토너먼트·스위스·예선+본선·더블엘리 1라운드 등 부전승 배정 */
    byePriority?: TournamentByePriority;
}

export interface IndividualMissionStep {
    id: string;
    description: string;
    stones: number;
}

export interface IndividualMissionSeries {
    id: string;
    name: string;
    steps: IndividualMissionStep[];
}

export interface StudentMissionProgress {
    [studentId: string]: {
        missionSeriesId: string;
        currentStepIndex: number;
    };
}

export interface ShopSettings {
    bulkPurchaseDiscountRate: number;
}

export type ShopCategory = string;

export interface ShopItem {
    id: string;
    name: string;
    price: number;
    category: ShopCategory;
}

export interface AppData {
    groupSettings: GroupSettings;
    generalSettings: GeneralSettings;
    eventSettings: EventSettings;
    tournamentSettings: TournamentSettings;
    shopSettings: ShopSettings;
    students: Student[];
    missions: Mission[];
    chessMissions: Mission[];
    specialMissions: SpecialMission[];
    shopItems: ShopItem[];
    transactions: Transaction[];
    coupons: Coupon[];
    shopCategories: ShopCategory[];
    chessMatches: ChessMatch[];
    gachaState: GachaState;
    tournamentData: TournamentData;
    lastBirthdayCouponMonth: number | null;
    individualMissionSeries: IndividualMissionSeries[];
    studentMissionProgress: StudentMissionProgress;
    /** 이벤트 참여 가능 횟수(미션/감점) 월별 저장 - 트랜잭션 압축 시에도 유지 */
    eventMonthlyStats?: EventMonthlyStats;
    /** 학생별 개인 미션 카드 (개인 연속 미션에서 생성되는 템플릿) */
    personalMissions?: PersonalMissionsByStudent;
    /** 그룹(반) 기본 개인 미션 — 해당 반 학생에게 자동으로 카드 부여 */
    personalMissionTemplates?: PersonalMissionTemplate[];
    /** 학생이 그룹 기본 미션 카드를 삭제한 템플릿 id — 다시 자동 부여하지 않음 */
    personalMissionTemplateDismissals?: { [studentId: string]: string[] };
}

export interface ChessMatch {
    id: string;
    timestamp: string;
    whitePlayerId: string;
    blackPlayerId: string;
    result: 'white' | 'black' | 'draw';
    whitePlayerNewRating: number;
    blackPlayerNewRating: number;
    ratingDeltaForWhite: number;
    status: 'active' | 'cancelled';
}

export interface User {
    uid: string;
    email: string | null;
    role?: 'master' | 'admin';
}

export interface ManagedUser {
    uid: string;
    email: string;
    status: 'active' | 'disabled';
}

export interface MasterData {
    managedUsers: ManagedUser[];
}

export type AdminTab = 'students' | 'missions' | 'shop';
export type SidebarTab = 'missions' | 'personal_missions' | 'shop' | 'coupons' | 'send' | 'history';
export type SortKey = 'rank' | 'stones' | 'name';
export type ShopSortKey = 'name' | 'price';
