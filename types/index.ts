
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
    group: string;
    stars: number;
    stones: number;
    answer?: string;
    isExclusive?: boolean; // 해당 급수에서만 나오도록 제한 (상위 그룹 노출 방지)
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
    type: 'mission' | 'attendance' | 'purchase' | 'adjustment' | 'gacha' | 'roulette' | 'chess_attendance' | 'penalty' | 'joseki_mission' | 'transfer' | 'special_mission';
    description: string;
    amount: number;
    timestamp: string;
    status: 'active' | 'cancelled';
    stoneBalanceBefore: number;
    stoneBalanceAfter: number;
    eventMonth?: string;
    couponsUsed?: UsedCouponInfo[];
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
}

export interface RouletteSegment {
    id: string;
    stones: number;
    weight: number;
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

export interface SwissData {
    status: 'not_started' | 'in_progress' | 'finished';
    players: SwissPlayer[];
    rounds: SwissMatch[][];
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
    score: number;
    startTime?: string;
    timeAdded?: number;
    currentMission?: MissionBadukActiveMission;
    matches: any[];
}

export interface MissionBadukData {
    players: MissionBadukPlayer[];
}

export interface TournamentData {
    participantIds: string[];
    relayParticipantIds: string[];
    bracketParticipantIds: string[];
    swissParticipantIds: string[];
    hybridParticipantIds: string[];
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
}

export type GameKey = 'game1' | 'game2' | 'game3';
export type GameSelection = GameKey | 'none';

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
export type SidebarTab = 'missions' | 'shop' | 'coupons' | 'send' | 'history';
export type SortKey = 'rank' | 'stones' | 'name';
export type ShopSortKey = 'name' | 'price';
