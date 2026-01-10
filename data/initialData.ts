
// FIX: Corrected import path for type definitions.
import type { Student, Mission, ShopItem, GroupSettings, GeneralSettings, EventSettings, TournamentData, TournamentSettings, GachaState, SpecialMission } from '../types';

export const INITIAL_GROUP_SETTINGS: GroupSettings = {
    '유단자': { name: '유단자', maxStones: 100 },
    '고급': { name: '고급', maxStones: 80 },
    '중급': { name: '중급', maxStones: 60 },
    '초급2': { name: '초급2', maxStones: 50 },
    '초급1': { name: '초급1', maxStones: 40 },
};

export const INITIAL_STUDENTS: Student[] = [
    { id: '1', name: '김바둑', rank: '18급', group: '중급', stones: 10, maxStones: 60, status: '재원', birthday: '03-15', takesChess: true, chessRating: 1050, chessGamesPlayed: 0, josekiProgress: 3 },
    { id: '2', name: '이초급', rank: '10급', group: '중급', stones: 25, maxStones: 60, status: '재원', birthday: '07-22', takesChess: false, josekiProgress: 1 },
    { id: '3', name: '박중급', rank: '5급', group: '고급', stones: 50, maxStones: 80, status: '재원', birthday: '11-01', takesChess: true, chessRating: 1100, chessGamesPlayed: 0 },
    { id: '4', name: '최고급', rank: '1단', group: '유단자', stones: 80, maxStones: 100, status: '재원', birthday: '01-30', takesChess: false },
    { id: '5', name: '정휴원', rank: '15급', group: '중급', stones: 5, maxStones: 60, status: '휴원', birthday: '05-10', takesChess: false },
    { id: '6', name: '강입문', rank: '입문', group: '초급1', stones: 2, maxStones: 40, status: '재원', birthday: '02-18', takesChess: true, chessRating: 950, chessGamesPlayed: 0 },
    { id: '7', name: '한이십', rank: '22급', group: '초급2', stones: 15, maxStones: 50, status: '재원', birthday: '09-09', takesChess: false },
];

export const INITIAL_MISSIONS: Mission[] = [
    { id: 'm1', description: '사활 풀기 10문제', stones: 5, group: '초급1' },
    { id: 'm2', description: '대국 1판 이기기', stones: 10, group: '초급1' },
    { id: 'm3', description: '행마 문제 풀기 5문제', stones: 8, group: '초급2' },
    { id: 'm4', description: '맥 문제 풀기 5문제', stones: 7, group: '중급' },
    { id: 'm5', description: '기보 복기하기', stones: 15, group: '고급' },
    { id: 'm6', description: '지도 대국 두기', stones: 20, group: '유단자' },
];

export const INITIAL_CHESS_MISSIONS: Mission[] = [
    { id: 'cm1', description: '체스 문제 3개 풀기', stones: 5 },
    { id: 'cm2', description: '체스 대국 1승', stones: 10 },
];

export const INITIAL_SPECIAL_MISSIONS: SpecialMission[] = [];

export const INITIAL_SHOP_CATEGORIES: string[] = ['간식', '용품', '완구', '기타', '할인상품'];

export const INITIAL_SHOP_ITEMS: ShopItem[] = [
    { id: 's1', name: '작은 간식', price: 50, category: '간식' },
    { id: 's2', name: '음료수', price: 80, category: '간식' },
    { id: 's3', name: '학용품 세트', price: 150, category: '용품' },
    { id: 's4', name: '바둑 용품', price: 300, category: '용품' },
    { id: 's5', name: '미니 장난감', price: 120, category: '완구' },
];

export const INITIAL_GENERAL_SETTINGS: GeneralSettings = {
    academyName: '바둑학원 스톤 관리',
    attendanceStoneValue: 10,
    josekiMissionValue: 15,
    eloKFactor: 32,
    chessAttendanceValue: 5,
    groupOrder: ['유단자', '고급', '중급', '초급2', '초급1'],
    nonChessPlayerRating: 1000,
    birthdayCouponValue: 300,
};

export const INITIAL_EVENT_SETTINGS: EventSettings = {
    minMissionsToSpin: 10,
    maxPenalties: 3, // Default penalty limit
    rouletteSegments: [
        { id: 'r1', stones: 10, weight: 25 },
        { id: 'r2', stones: 20, weight: 20 },
        { id: 'r3', stones: 50, weight: 15 },
        { id: 'r4', stones: 100, weight: 5 },
        { id: 'r5', stones: 15, weight: 20 },
        { id: 'r6', stones: 30, weight: 15 },
    ],
    gachaPrizes: {
        first: 500,
        second: 200,
        third: 100,
        fourth: 50,
        fifth: 20,
    },
    gachaPrizeCounts: {
        first: 1,
        second: 3,
        third: 6,
        fourth: 15,
        fifth: 75,
    },
};

export const INITIAL_GACHA_STATES: GachaState = {};

const createWearable = (id: string, text: string, stars: number = 1) => ({ id, text, stars });

export const INITIAL_TOURNAMENT_SETTINGS: TournamentSettings = {
    games: ['game1', 'game2', 'game3'],
    game1SameRankHandicap: 6.5,
    game1RankDiffHandicap: 5,
    game2StoneValue: 2,
    game2LastStoneBonus: 15,
    game3StoneValue: 25,
    relayMannerPenalty: 10,
    championPrize: 100,
    runnerUpPrize: 50,
    semiFinalistPrize: 25,
    participantPrize: 10,
    swissRounds: 4,
    swiss1stPrize: 50,
    swiss2ndPrize: 30,
    swiss3rdPrize: 20,
    missionBaduk: {
        timeLimit: 50,
        scoreToStoneRatio: 1,
        matchMissionLabel: '미션1',
        wearableMissionLabel: '미션2',
        matchMissions: [
            { id: 'mm1', template: '[따낸돌] {n}개 이상', min: 10, max: 25, defaultStars: 3 },
            { id: 'mm2', template: '[집차이] {n}집 이상', min: 10, max: 30, defaultStars: 3 },
            { id: 'mm3', template: '[집차이] {n}집 이하', min: 5, max: 15, defaultStars: 2 },
            { id: 'mm4', template: '[사석] {n}개 이상', min: 5, max: 15, defaultStars: 3 },
            { id: 'mm5', template: '[상대방] {n}레벨 이상', min: 1, max: 9, defaultStars: 4 },
            { id: 'mm6', template: '[배틀대국] {n}문제 이상', min: 3, max: 10, defaultStars: 3 },
            { id: 'mm7', template: '[첫수] 천원에 두기', min: 0, max: 0, defaultStars: 2 },
            { id: 'mm8', template: '[호구] {n}개 이상', min: 3, max: 10, defaultStars: 2 },
            { id: 'mm9', template: '[좋은선] {n}개 이상', min: 5, max: 20, defaultStars: 3 },
            { id: 'mm10', template: '[무조건] 승리하기', min: 0, max: 0, defaultStars: 5 },
            { id: 'mm11', template: '[옥집] {n}번 만들기', min: 1, max: 5, defaultStars: 3 },
            { id: 'mm12', template: '[행운] 미션점수 2점', min: 0, max: 0, defaultStars: 1 },
            { id: 'mm13', template: '[행운] 승점 2점', min: 0, max: 0, defaultStars: 1 },
            { id: 'mm14', template: '[자동차경주] {n}퍼펙트', min: 20, max: 50, defaultStars: 4 },
            { id: 'mm15', template: '[바다] {n}퍼펙트', min: 30, max: 60, defaultStars: 4 },
            { id: 'mm16', template: '[밀림지대] {n}퍼펙트', min: 20, max: 50, defaultStars: 4 },
            { id: 'mm17', template: '[사막지대] {n}퍼펙트', min: 60, max: 100, defaultStars: 5 },
            { id: 'mm18', template: '[첫수] 화점에 두기', min: 0, max: 0, defaultStars: 1 },
            { id: 'mm19', template: '[첫수] 소목에 두기', min: 0, max: 0, defaultStars: 1 },
            { id: 'mm20', template: '[첫수] 삼삼에 두기', min: 0, max: 0, defaultStars: 1 },
            { id: 'mm21', template: '[첫수] 고목에 두기', min: 0, max: 0, defaultStars: 1 },
            { id: 'mm22', template: '[첫수] 외목에 두기', min: 0, max: 0, defaultStars: 1 },
            { id: 'mm23', template: '[귀 점령] {n}개', min: 1, max: 4, defaultStars: 3 },
        ],
        wearableMissions: [
            createWearable('wm1', '[용인형]세트 착용', 3), createWearable('wm2', '[흑기사]세트 착용', 3), createWearable('wm3', '[장군]세트 착용', 3),
            createWearable('wm4', '[전투슈트]세트 착용', 4), createWearable('wm5', '[좀비]세트 착용', 2), createWearable('wm6', '[가죽]세트 착용', 2),
            createWearable('wm7', '[마법사]세트 착용', 3), createWearable('wm8', '[철갑]세트 착용', 3), createWearable('wm9', '[황금갑옷]세트 착용', 5),
            createWearable('wm10', '[막대사탕]무기 착용', 1), createWearable('wm11', '[장검]무기 착용', 2), createWearable('wm12', '[마법장검]무기 착용', 3),
            createWearable('wm13', '[광선검]무기 착용', 3), createWearable('wm14', '[단검]무기 착용', 1), createWearable('wm15', '[비눗방울]무기 착용', 1),
            createWearable('wm16', '[철퇴]무기 착용', 2), createWearable('wm17', '[나무창]무기 착용', 1), createWearable('wm18', '[삼지창]무기 착용', 2),
            createWearable('wm19', '[쇠곤봉]무기 착용', 2), createWearable('wm20', '[레이저건]무기 착용', 4), createWearable('wm21', '[환두대도]무기 착용', 3),
            createWearable('wm22', '[흑색장검]무기 착용', 3), createWearable('wm23', '[뼈다귀]무기 착용', 1), createWearable('wm24', '[양날도끼]무기 착용', 3),
            createWearable('wm25', '[소화기]무기 착용', 2), createWearable('wm26', '[마법봉]무기 착용', 2), createWearable('wm27', '[부채]무기 착용', 1),
            createWearable('wm28', '[미사일]무기 착용', 4), createWearable('wm29', '[바이올린]무기 착용', 2), createWearable('wm30', '[햄머]무기 착용', 2),
            createWearable('wm31', '[물고기창]무기 착용', 1), createWearable('wm32', '[엑스칼리버]무기 착용', 5), createWearable('wm33', '[모든장비]해제', 5)
        ],
        points: {
            win19: 3,
            win13: 2,
            win9: 1,
            matchMissionSuccess: 2,
            wearableMissionSuccess: 1,
            penaltyDeduction: 1,
            star1: 1,
            star2: 2,
            star3: 3,
            star4: 4,
            star5: 5,
        },
        bonusTiers: [
            { id: 'epic', label: '에픽', rate: 5, reward: 50 },
            { id: 'legend', label: '전설', rate: 10, reward: 40 },
            { id: 'rare', label: '희귀', rate: 15, reward: 30 },
            { id: 'advanced', label: '고급', rate: 30, reward: 20 },
            { id: 'common', label: '일반', rate: 40, reward: 5 },
        ]
    }
};

export const INITIAL_TOURNAMENT_DATA: TournamentData = {
    participantIds: [],
    relayParticipantIds: [],
    bracketParticipantIds: [],
    swissParticipantIds: [],
    hybridParticipantIds: [],
    missionParticipantIds: [],
    teams: [
        { name: 'A', players: [], mannerPenalties: 0 },
        { name: 'B', players: [], mannerPenalties: 0 },
    ],
    bracket: null,
    relay: null,
};
