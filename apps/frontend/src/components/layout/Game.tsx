import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { useSocket } from "@/hooks/useSocket";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { ratingCalculator } from "@/utils/ratingCalculator";
import {
    GAME_OVER,
    GAME_START,
    INIT_GAME,
    MOVE,
    PLAYER_COUNT,
} from "@/utils/messages";
import { timeConfig, TimeControlConfig } from "@/utils/timeConfig";

type Move = {
    from: string;
    to: string;
    promotion?: string;
}

type GameMessage = {
    type: string;
    payload?: any;
}

const Game = () => {
    const socket = useSocket();
    const [chess, setChess] = useState<Chess>(new Chess());
    const [fen, setFen] = useState<string>(chess.fen());
    const [gameState, setGameState] = useState<string>("Waiting for opponent...");
    const [playerColor, setplayerColor] = useState<"white" | "black" | "">("");
    const [isMyTurn, setIsMyTurn] = useState<boolean>(false);
    const [timeControl, setTimeControl] = useState<TimeControlConfig>(timeConfig.RAPID1);
    const [whiteTime, setWhiteTime] = useState<number>(timeControl.baseTime);
    const [blackTime, setBlackTime] = useState<number>(timeControl.baseTime);
    const [timerActive, setTimerActive] = useState<boolean>(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const [moveHistory, setMoveHistory] = useState<string[]>([]);
    const [yourRating, setYourRating] = useState<number>(1200);
    const [opponentRating, setOpponentRating] = useState<number>(1200);
    const [playerCount, setPlayerCount] = useState<number>(0);
    const [gameId, setGameId] = useState<string>("");

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
    };

    useEffect(() => {
        if (!socket) return;

        socket.onmessage = (event) => {
            const message: GameMessage = JSON.parse(event.data);

            switch (message.type) {
                case PLAYER_COUNT: {
                    if (playerCount != message.payload.count) {
                        setPlayerCount(message.payload.count);
                    }
                    break;
                }
                case GAME_START: {
                    const { color, opponentRating, timeControl, gameId } = message.payload;
                    const newChess = new Chess();
                    setChess(newChess);
                    setFen(newChess.fen());
                    setplayerColor(color);
                    setIsMyTurn(color === "white");
                    setGameState(
                        color === "white"
                            ? "Your turn!"
                            : "Waiting for opponent..."
                    );
                    setOpponentRating(opponentRating);
                    setTimeControl(timeConfig[timeControl as keyof typeof timeConfig]);
                    setTimerActive(true);
                    setMoveHistory([]);
                    setWhiteTime(timeConfig[timeControl as keyof typeof timeConfig].baseTime);
                    setBlackTime(timeConfig[timeControl as keyof typeof timeConfig].baseTime);
                    setGameId(gameId);
                    break;
                }
                case MOVE: {
                    const move = message.payload;
                    makeAMove(move, true);
                    setGameState("Your turn!");
                    setIsMyTurn(true);
                    break;
                }
                case GAME_OVER: {
                    const winner: string = message.payload.winner;
                    setTimerActive(false);
                    if (gameState != "Draw") {
                        const { newWinnerRating, newLoserRating } =
                            ratingCalculator(
                                winner == playerColor
                                    ? yourRating
                                    : opponentRating,
                                winner == playerColor
                                    ? opponentRating
                                    : yourRating
                            );

                        setYourRating(
                            winner == playerColor
                                ? newWinnerRating
                                : newLoserRating
                        );
                    }
                    setGameState(`${winner} wins`);
                    break;
                }
            }
        };

        socket.onclose = () => {
            setGameState("Connection lost - reconnecting...")
        }
    }, [socket, chess]);

    const makeAMove = useCallback(
        (move: Move, isRemoteMove = false) => {
            try {
                const newChess = new Chess(chess.fen());
                const result = newChess.move(move);

                if (!result) {
                    setGameState("Illegal move");
                    return null;
                }

                if (newChess.turn() === "b") {
                    setWhiteTime((prev) => prev + timeControl.increment);
                } else {
                    setBlackTime((prev) => prev + timeControl.increment);
                }

                setChess(newChess);
                setFen(newChess.fen());
                setMoveHistory((prev) => [
                    ...prev,
                    newChess.history().slice(-1)[0],
                ]);

                if (!isRemoteMove) {
                    socket?.send(
                        JSON.stringify({
                            type: MOVE,
                            payload: {
                                move: move,
                            },
                        })
                    );
                    setIsMyTurn(false);
                    setGameState("Waiting for opponent...");
                } else {
                    setIsMyTurn(newChess.turn() === playerColor[0]);
                    if (isMyTurn) {
                        setGameState("Your turn!");
                    }
                }

                if (newChess.isGameOver()) {
                    setTimerActive(false);
                    let resultMessage = "";
                    if (newChess.isCheckmate()) {
                        resultMessage = `Checkmate ${newChess.turn() === "w" ? "black" : "white"} wins`;
                    } else if (newChess.isDraw()) {
                        resultMessage = "Draw";
                    } else {
                        resultMessage = "Stalemate";
                    }
                    setGameState(resultMessage);

                    socket?.send(
                        JSON.stringify({
                            type: GAME_OVER,
                            payload: {
                                winner: newChess.turn() === "w" ? "black" : "white",
                                gameId
                            }
                        })
                    );
                }
                return result;
            } catch (e) {
                console.error("Error making move:", e);
                setGameState("Error making move");
                return null;
            }
        },
        [chess, socket, playerColor, isMyTurn, timeControl.increment, gameId]
    );

    function onDrop(sourceSquare: string, targetSquare: string) {
        if (!isMyTurn) {
            setGameState("Not your turn");
            return false;
        }
        const moveData: Move = {
            from: sourceSquare,
            to: targetSquare,
        };

        const move = makeAMove(moveData, false);
        setGameState("Waiting for opponent...");

        return move !== null;
    }

    // timer effect
    useEffect(() => {
        if (!timerActive) return;

        timerRef.current = setInterval(() => {
            if (chess.turn() === "w") {
                setWhiteTime((prev) => Math.max(0, prev - 1));
            } else {
                setBlackTime((prev) => Math.max(0, prev - 1));
            }
        }, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
        };
    }, [timerActive, chess.turn()]);

    // Start timer when game begins
    useEffect(() => {
        if (playerColor && !timerActive) {
            setTimerActive(true);
        }
    }, [playerColor]);

    // Check for timeout
    useEffect(() => {
        if (whiteTime === 0 || blackTime === 0) {
            setTimerActive(false);
            setGameState(
                `Time out! ${whiteTime === 0 ? "Black" : "White"} wins!`
            );
            socket?.send(JSON.stringify({ 
                type: GAME_OVER,
                payload: {
                    winner: whiteTime == 0 ? "black" : "white",
                    gameId
                }
            }));
        }
    }, [whiteTime, blackTime, socket, gameId]);

    if (!socket) return <div>Connecting...</div>;

    return (
        <div>
            <div>{gameState}</div>
            <div>Your color: {playerColor}</div>
            <div>
                {Object.values(timeConfig).map((control) => (
                    <Button
                        key={control.label}
                        className={`time-control ${
                            control.label === control.label ? "active" : ""
                        }`}
                        onClick={() => {
                            setTimeControl(control);
                        }}
                    >
                        <p>{control.label.split(" ")[0]}</p>
                        <p>{control.label.split(" ")[1]}</p>
                    </Button>
                ))}
            </div>
            <div
                className="flex items-center justify-center"
                style={{ width: "600px" }}
            >
                <Chessboard
                    position={fen}
                    onPieceDrop={onDrop}
                    autoPromoteToQueen={true}
                    boardOrientation={playerColor}
                    // customDarkSquareStyle={{
                    //     backgroundColor: '#0D0A0B', // Dark brown
                    //     color: '#454955' // Light piece color
                    // }}
                    // customLightSquareStyle={{
                    //     backgroundColor: '#F3EFF5', // Light brown
                    //     color: '#F2EFE9' // Dark piece color
                    // }}
                    // customSquareStyles={{
                    //     /* Optional: highlight squares */
                    //     hover: {
                    //         backgroundColor: 'rgba(255, 255, 0, 0.4)'
                    //     },
                    //     lastMove: {
                    //         backgroundColor: 'rgba(155, 199, 0, 0.41)'
                    //     },
                    //     check: {
                    //         backgroundColor: 'rgba(255, 0, 0, 0.4)'
                    //     }
                    // }}
                />
            </div>
            <div>
                <p>{`${playerCount} Players are playing`}</p>
                <div className="rating-display">
                    <p>
                        Your rating: <strong>{yourRating}</strong>
                    </p>
                    <p>Opponent rating: {opponentRating || "Unknown"}</p>
                </div>
                <div className="timer-container">
                    <div
                        className={`timer ${
                            chess.turn() === "b" ? "active" : ""
                        }`}
                    >
                        Black: {formatTime(blackTime)}
                    </div>
                    <div
                        className={`timer ${
                            chess.turn() === "w" ? "active" : ""
                        }`}
                    >
                        White: {formatTime(whiteTime)}
                    </div>
                </div>
                <div className="chess-board-with-notation">
                    <div className="move-notation left">
                        {moveHistory
                            .filter((_, i) => i % 2 === 0)
                            .map((move, i) => (
                                <div key={`white-${i}`}>
                                    {i + 1}. {move}
                                </div>
                            ))}
                    </div>
                    <div className="move-notation right">
                        {moveHistory
                            .filter((_, i) => i % 2 === 1)
                            .map((move, i) => (
                                <div key={`black-${i}`}>
                                    {i + 1}... {move}
                                </div>
                            ))}
                    </div>
                </div>
            </div>
            <Button 
                disabled={!!gameId}
                onClick={() => {
                    if (!socket) return;
                    socket.send(
                        JSON.stringify({
                            type: INIT_GAME,
                            payload: {
                                timeControl: Object.keys(timeConfig).find(
                                    key => timeConfig[key as keyof typeof timeConfig].label == timeControl.label
                                ),
                                rating: yourRating,
                            },
                        })
                    );
                    setGameState("Finding Opponent...")
                }}
            >
                {gameId ? "Game in progress" : "Play Chess"}
            </Button>
        </div>
    );
};

export default Game;
