export const calculateNewElo = (
    whiteRating: number,
    blackRating: number,
    result: 'white' | 'black' | 'draw',
    kFactor: number = 32
): { newWhiteRating: number; newBlackRating: number; ratingDeltaForWhite: number } => {
    const expectedWhite = 1 / (1 + Math.pow(10, (blackRating - whiteRating) / 400));
    
    let actualWhite: number;
    switch (result) {
        case 'white':
            actualWhite = 1;
            break;
        case 'black':
            actualWhite = 0;
            break;
        case 'draw':
        default:
            actualWhite = 0.5;
            break;
    }

    const ratingDeltaForWhite = Math.round(kFactor * (actualWhite - expectedWhite));
    
    const newWhiteRating = whiteRating + ratingDeltaForWhite;
    const newBlackRating = blackRating - ratingDeltaForWhite;

    return { newWhiteRating, newBlackRating, ratingDeltaForWhite };
};