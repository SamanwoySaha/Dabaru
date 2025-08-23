export const ratingCalculator = (
    winnerRating: number,
    loserRating: number,
    kFactor = 32
) => {
    const expectedScore = (rating: number, opponentRating: number) => 1 / (1 + 10 ** ((opponentRating - rating) / 400));

    const winnerExpected = expectedScore(winnerRating, loserRating);
    const loserExpected = expectedScore(loserRating, winnerRating);

    return {
        newWinnerRating: Math.round(
            winnerRating + kFactor * (1 - winnerExpected)
        ),
        newLoserRating: Math.round(loserRating + kFactor * (0 - loserExpected)),
    };
};
