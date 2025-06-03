import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../ui/select";
import { RootState } from "@/store";
import {
    setGameFen,
    setGameState,
    setPlayerColor,
    setIsMyTurn,
    addMoveToHistory,
    setGameId,
    resetGame,
    makeMove as makeGameMoveAction, // Renamed to avoid conflict
} from "@/store/slices/gameSlice";
import {
    setTimeControlConfiguration,
    setWhiteTime,
    setBlackTime,
    decrementWhiteTime,
    decrementBlackTime,
    setTimerActive,
    resetTimer,
} from "@/store/slices/timerSlice";
import {
    setYourRating,
    setOpponentRating,
    setPlayerCount,
} from "@/store/slices/playerSlice";
import {
    addChatMessage,
    clearChat,
    ChatMessage as ReduxChatMessage, // Renamed to avoid conflict
} from "@/store/slices/chatSlice";
import { Button } from "../ui/button";
import { useSocket } from "@/hooks/useSocket";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { ratingCalculator } from "@/utils/ratingCalculator";
import {
    CHAT,
    GAME_OVER,
    GAME_START,
    INIT_GAME,
    MOVE,
    PLAYER_COUNT,
    RESIGN, // Import new message type
    OFFER_DRAW,
    DRAW_OFFER_RECEIVED,
    ACCEPT_DRAW,
    DECLINE_DRAW,
    DRAW_OFFER_DECLINED,
} from "@/utils/messages";
import { toast } from 'sonner'; // Import toast
import { timeConfig, TimeControlConfig, TimeControlPresets } from "@/utils/timeConfig";
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "../ui/resizable";
import { Input } from "../ui/input";
import { VideoChat } from "./VideoChat";

type Move = {
    from: string;
    to: string;
    promotion?: string;
};

type ChatMessage = {
    sender: string;
    data: string;
    timeStamp: string;
};

type GameMessage = {
    type: string;
    payload?: any;
};

const Game = () => {
    const socket = useSocket();
    const dispatch = useDispatch();

    // Local state that remains
    const [chess, setChess] = useState<Chess>(new Chess()); // Local chess instance
    const [message, setMessage] = useState(""); // For chat input
    const [showVideoChat, setShowVideoChat] = useState(false); // UI state
    const [selectedTimeControl, setSelectedTimeControl] = useState<keyof TimeControlPresets>('RAPID1');
    const [drawOfferState, setDrawOfferState] = useState<'idle' | 'sent' | 'received' | 'declined_by_opponent' | 'declined_by_me'>('idle');

    // Selectors for Redux state
    const {
        fen,
        gameState,
        playerColor,
        isMyTurn,
        moveHistory,
        gameId,
    } = useSelector((state: RootState) => state.game);
    const { timeControl, whiteTime, blackTime, timerActive } = useSelector(
        (state: RootState) => state.timer
    );
    const { yourRating, opponentRating, playerCount } = useSelector(
        (state: RootState) => state.player
    );
    const { chatHistory } = useSelector((state: RootState) => state.chat);

    const timerRef = useRef<NodeJS.Timeout | null>(null); // Keep for interval management

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
                    // Assuming playerCount in Redux is already up-to-date via selector
                    if (playerCount !== message.payload.count) {
                         dispatch(setPlayerCount(message.payload.count));
                    }
                    break;
                }
                case GAME_START: {
                    const {
                        color,
                        opponentRating: receivedOpponentRating,
                        timeControl: receivedTimeControl,
                        gameId: receivedGameId,
                    } = message.payload;

                    dispatch(resetGame()); // Resets fen, history, etc.
                    setChess(new Chess()); // Reset local chess instance

                    dispatch(setPlayerColor(color));
                    dispatch(setIsMyTurn(color === "white"));
                    dispatch(
                        setGameState(
                            color === "white"
                                ? "Your turn!"
                                : "Waiting for opponent..."
                        )
                    );
                    dispatch(setOpponentRating(receivedOpponentRating));

                    const newTimeControl = timeConfig[receivedTimeControl as keyof typeof timeConfig];
                    dispatch(setTimeControlConfiguration(newTimeControl));
                    // Times are set by setTimeControlConfiguration based on its initialTime

                    dispatch(setTimerActive(true));
                    dispatch(setGameId(receivedGameId));
                    setDrawOfferState('idle'); // Reset draw offer state
                    setShowVideoChat(true);
                    break;
                }
                case MOVE: {
                    const receivedMove = message.payload.move; // Assuming move is in payload.move

                    // Update local chess instance first to validate and get new FEN
                    const tempChess = new Chess(fen); // Use FEN from Redux
                    const moveResult = tempChess.move(receivedMove);

                    if (moveResult) {
                        dispatch(makeGameMoveAction(receivedMove)); // This action should update fen and moveHistory
                        dispatch(setGameState("Your turn!"));
                        dispatch(setIsMyTurn(true)); // It's now this player's turn

                        // Handle increment if applicable (assuming timeControl is in Redux)
                        if (timeControl) {
                            if (tempChess.turn() === "b") { // Last move was white's
                                dispatch(setWhiteTime(whiteTime + timeControl.increment * 1000));
                            } else { // Last move was black's
                                dispatch(setBlackTime(blackTime + timeControl.increment * 1000));
                            }
                        }
                    } else {
                        console.error("Invalid move received from server:", receivedMove);
                        dispatch(setGameState("Error: Invalid move from server"));
                    }
                    break;
                }
                case CHAT: {
                    const { sender, data, timeStamp, gameId: receivedGameId }: { sender: string; data: string; timeStamp: string; gameId: string } = message.payload;

                    // Ensure chat message is for the current game
                    // gameId below is from redux state (already available in component scope through useSelector)
                    if (receivedGameId !== gameId) {
                        console.warn(`Chat message for game ${receivedGameId} ignored, current game is ${gameId}`);
                        return;
                    }

                    // Adapt to ReduxChatMessage structure
                    const newChatMessage: ReduxChatMessage = {
                        id: `${receivedGameId}-${timeStamp}-${Math.random()}`, // Create a unique ID
                        sender: playerColor === sender ? 'user' : 'opponent', // playerColor is this client's color, sender is from payload ("white" or "black")
                        text: data,
                        timestamp: timeStamp,
                    };
                    dispatch(addChatMessage(newChatMessage));
                    break;
                }
                case GAME_OVER: {
                    const { winner, gameId: gameOverGameId }: { winner: string; gameId?: string } = message.payload;

                    if (gameOverGameId && gameOverGameId !== gameId) { // gameId from Redux
                        console.warn(`GAME_OVER for game ${gameOverGameId} ignored, current game is ${gameId}`);
                        return;
                    }

                    dispatch(setTimerActive(false));

                    const currentGameState = gameState; // from Redux selector
                    const currentPlayerColor = playerColor; // from Redux selector
                    const currentYourRating = yourRating; // from Redux selector
                    const currentOpponentRating = opponentRating; // from Redux selector
                    setDrawOfferState('idle'); // Reset draw offer state on game over


                    if (winner === "draw") {
                        dispatch(setGameState("Game drawn by agreement."));
                        // Rating calculation for draw (optional, often K-factor/2 or specific draw logic)
                        // For now, let's assume no rating change on draw by agreement to keep it simple.
                    } else if (currentOpponentRating !== null) { // Existing logic for win/loss
                        const { newWinnerRating, newLoserRating } =
                            ratingCalculator(
                                winner === currentPlayerColor
                                    ? currentYourRating
                                    : currentOpponentRating,
                                winner === currentPlayerColor
                                    ? currentOpponentRating
                                    : currentYourRating
                            );

                        dispatch(setYourRating(
                            winner === currentPlayerColor
                                ? newWinnerRating
                                : newLoserRating
                        ));
                        // Opponent's rating change would typically be handled server-side or not stored locally for them
                    }

                    if (winner !== "draw") { // Only set winner if not a draw (draw message set above)
                        dispatch(setGameState(`${winner} wins`));
                    }
                    break;
                }
                case DRAW_OFFER_RECEIVED: {
                    const { gameId: receivedGameId } = message.payload;
                    if (receivedGameId !== gameId) { // gameId from Redux
                        console.warn(`DRAW_OFFER_RECEIVED for game ${receivedGameId} ignored, current game is ${gameId}`);
                        return;
                    }
                    setDrawOfferState('received');
                    // Optionally, update game status message in Redux
                    // dispatch(setGameState("Opponent has offered a draw."));
                    break;
                }
                case DRAW_OFFER_DECLINED: {
                    const { gameId: receivedGameId } = message.payload;
                    if (receivedGameId !== gameId) { // gameId from Redux
                        console.warn(`DRAW_OFFER_DECLINED for game ${receivedGameId} ignored, current game is ${gameId}`);
                        return;
                    }
                    setDrawOfferState('declined_by_opponent');
                    // dispatch(setGameState("Your draw offer was declined."));
                    break;
                }
            }
        };

        socket.onclose = () => {
            dispatch(setGameState("Connection lost - reconnecting..."));
        };
    }, [socket, dispatch, fen, playerCount, gameState, playerColor, yourRating, opponentRating, timeControl, whiteTime, blackTime]);

    const makeAMove = useCallback(
        (move: Move, isRemoteMove = false) => {
            // Uses local 'chess' instance for validation, which should be synced with Redux 'fen'
            // This 'chess' instance is updated via useEffect listening to 'fen' from Redux
            const localChess = new Chess(fen); // Always use latest FEN from Redux for the new move
            const result = localChess.move(move);

            if (!result) {
                dispatch(setGameState("Illegal move"));
                return null;
            }

            // Dispatch action to update fen and move history in Redux
            // makeGameMoveAction should internally update fen and history
            dispatch(makeGameMoveAction(move));

            // Handle increment based on Redux state
            if (timeControl) {
                 if (localChess.turn() === "b") { // Move was white's
                    dispatch(setWhiteTime(whiteTime + timeControl.increment * 1000));
                } else { // Move was black's
                    dispatch(setBlackTime(blackTime + timeControl.increment * 1000));
                }
            }

            if (!isRemoteMove) {
                socket?.send(
                    JSON.stringify({
                        type: MOVE,
                        payload: { move },
                    })
                );
                dispatch(setIsMyTurn(false));
                dispatch(setGameState("Waiting for opponent..."));
            } else {
                // For remote moves, isMyTurn was already set in the MOVE handler
                // Game state ("Your turn!") was also set there.
            }

            if (localChess.isGameOver()) {
                dispatch(setTimerActive(false));
                let resultMessage = "";
                let winner = "";
                if (localChess.isCheckmate()) {
                    winner = localChess.turn() === "w" ? "black" : "white";
                    resultMessage = `Checkmate! ${winner} wins.`;
                } else if (localChess.isDraw()) {
                    resultMessage = "Draw";
                    winner = "draw"; // Or handle differently
                } else { // Stalemate or other draw conditions
                    resultMessage = "Stalemate";
                    winner = "draw"; // Or handle differently
                }
                dispatch(setGameState(resultMessage));

                // Send GAME_OVER only if it's the current player's move that ended the game
                // The server might also determine game over, this handles client-side determination
                if (!isRemoteMove) {
                     socket?.send(
                        JSON.stringify({
                            type: GAME_OVER,
                            payload: { winner, gameId },
                        })
                    );
                }
            }
            return result;
        },
        [dispatch, fen, socket, playerColor, timeControl, whiteTime, blackTime, gameId]
    );

    function onDrop(sourceSquare: string, targetSquare: string) {
        if (!isMyTurn) { // isMyTurn from Redux
            dispatch(setGameState("Not your turn"));
            return false;
        }
        const moveData: Move = {
            from: sourceSquare,
            to: targetSquare,
            // promotion: "q", // Always promote to queen for simplicity, or handle promotion UI
        };

        const moveResult = makeAMove(moveData, false);
        // Game state for "Waiting for opponent..." is set within makeAMove if it's not a remote move

        return moveResult !== null;
    }

    // timer effect
    useEffect(() => {
        if (!timerActive || !gameId) { // Ensure timer only runs during an active game
            if (timerRef.current) clearInterval(timerRef.current);
            return;
        }

        // Determine whose turn it is from FEN string (Redux state)
        const localGame = new Chess(fen);
        const turn = localGame.turn();

        timerRef.current = setInterval(() => {
            if (turn === "w") {
                dispatch(decrementWhiteTime(1000)); // Decrement by 1 second (1000 ms)
            } else {
                dispatch(decrementBlackTime(1000)); // Decrement by 1 second (1000 ms)
            }
        }, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [timerActive, fen, dispatch, gameId]);

    // Check for timeout
    useEffect(() => {
        // Ensure this effect only runs if a game is active and timer is not already stopped
        if (!gameId || !timerActive) return;

        if (whiteTime <= 0 || blackTime <= 0) {
            dispatch(setTimerActive(false));
            const winner = whiteTime <= 0 ? "black" : "white";
            dispatch(setGameState(`Time out! ${winner === "black" ? "Black" : "White"} wins!`));

            // Send GAME_OVER message to the server
            socket?.send(
                JSON.stringify({
                    type: GAME_OVER,
                    payload: {
                        winner,
                        gameId,
                    },
                })
            );
        }
    }, [whiteTime, blackTime, socket, gameId, dispatch, timerActive]);

    // Local chess instance synchronization with Redux FEN
    useEffect(() => {
        const localGame = new Chess(fen); // fen from Redux
        setChess(localGame); // Update local chess.js instance
    }, [fen]);


    const sendMessage = () => {
        if (!socket || !message.trim() || !gameId) return;

        const chatMsg: ReduxChatMessage = {
            id: `${gameId}-${Date.now()}-${Math.random()}`, // Temporary unique ID
            sender: 'user', // This client is always the 'user' for their own messages
            text: message,
            timestamp: new Date().toISOString(),
        };

        // Optimistically update UI
        dispatch(addChatMessage(chatMsg));

        socket.send(
            JSON.stringify({
                type: CHAT,
                payload: {
                    gameId, // gameId from Redux
                    data: message, // Original message text
                    // playerColor is removed as server will determine sender color
                },
            })
        );
        setMessage(""); // Clear input field
    };

    if (!socket) return <div className="flex justify-center items-center h-screen">Connecting...</div>;

    // Determine opponent and self based on playerColor
    const selfIsWhite = playerColor === 'white';
    const opponentColor = selfIsWhite ? 'black' : 'white';
    const selfTime = selfIsWhite ? whiteTime : blackTime;
    const opponentTime = selfIsWhite ? blackTime : whiteTime;
    const selfRatingToDisplay = yourRating;
    const opponentRatingToDisplay = opponentRating;


    const PlayerInfoPanel = ({
        isOpponent,
        colorName,
        rating,
        time,
        isTurn,
    }: {
        isOpponent?: boolean;
        colorName: string;
        rating: number | null;
        time: number;
        isTurn: boolean;
    }) => (
        <div className={`p-4 border rounded-lg shadow-md ${isTurn ? "border-green-500 ring-2 ring-green-500" : "border-gray-300"}`}>
            <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-lg">{isOpponent ? `Opponent (${colorName})` : `You (${colorName})`}</span>
                <span className={`font-bold text-2xl ${isTurn && timerActive ? "text-green-600" : ""}`}>
                    {formatTime(time / 1000)}
                </span>
            </div>
            <div className="text-sm text-gray-600">Rating: {rating ?? "N/A"}</div>
        </div>
    );

    return (
        <div className="flex flex-col h-screen bg-gray-100 p-2">
            {/* Top bar for global game status and player count */}
            <div className="mb-2 p-3 bg-white rounded-lg shadow flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-700">{gameState}</h2>
                <div className="text-sm text-gray-600">Players Online: {playerCount}</div>
            </div>

            <ResizablePanelGroup direction="horizontal" className="flex-grow rounded-lg border bg-white shadow">
                {/* Left Panel: Video Chat and Chat */}
                <ResizablePanel defaultSize={25} minSize={20} className="p-4 flex flex-col space-y-4"> {/* Added space-y-4 for consistent spacing */}
                    {showVideoChat && gameId && playerColor && (
                        <div className="border rounded-lg overflow-hidden shadow-md max-h-[40vh]"> {/* Added shadow and max-h */}
                            <VideoChat gameId={gameId} playerColor={playerColor} />
                        </div>
                    )}
                    {/* Ensure chat takes remaining space if video is hidden or present */}
                    <div className={`flex-grow flex flex-col border rounded-lg p-3 bg-gray-50 shadow-sm ${showVideoChat && gameId && playerColor ? 'min-h-[20vh]' : 'h-full'}`}>
                        <h3 className="text-lg font-semibold mb-2 border-b pb-2">Chat</h3>
                        <div className="flex-grow overflow-y-auto mb-3 space-y-2 pr-1">
                            {chatHistory.map(({ id, sender, text }) => (
                                <div
                                    key={id}
                                    className={`flex ${sender === 'user' ? "justify-end" : "justify-start"}`}
                                >
                                    <div
                                        className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg shadow-sm ${
                                            sender === 'user'
                                                ? "bg-blue-500 text-white"
                                                : "bg-gray-200 text-gray-800"
                                        }`}
                                    >
                                        {text}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex space-x-2">
                            <Input
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                type="text"
                                placeholder="Type a message..."
                                className="flex-grow"
                                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                            />
                            <Button onClick={sendMessage}>Send</Button>
                        </div>
                    </div>
                </ResizablePanel>
                <ResizableHandle withHandle className="mx-2 bg-gray-300" />

                {/* Center Panel: Chessboard and Player Info */}
                <ResizablePanel defaultSize={50} minSize={40} className="p-4 flex flex-col justify-center items-center">
                    {gameId && (
                         <PlayerInfoPanel
                            isOpponent
                            colorName={opponentColor.charAt(0).toUpperCase() + opponentColor.slice(1)}
                            rating={opponentRatingToDisplay}
                            time={opponentTime}
                            isTurn={chess.turn() === opponentColor[0] && timerActive}
                        />
                    )}
                    <div className="my-4 w-full max-w-[60vh] aspect-square"> {/* Adjusted for better sizing */}
                        <Chessboard
                            position={fen}
                            onPieceDrop={onDrop}
                            autoPromoteToQueen={true}
                            boardOrientation={playerColor || 'white'}
                            customBoardStyle={{
                                borderRadius: '4px',
                                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
                            }}
                            customDarkSquareStyle={{ backgroundColor: '#779952' }}
                            customLightSquareStyle={{ backgroundColor: '#edeed1' }}
                        />
                    </div>
                    {gameId && (
                        <PlayerInfoPanel
                            colorName={playerColor.charAt(0).toUpperCase() + playerColor.slice(1)}
                            rating={selfRatingToDisplay}
                            time={selfTime}
                            isTurn={chess.turn() === playerColor[0] && timerActive}
                        />
                    )}
                </ResizablePanel>
                <ResizableHandle withHandle className="mx-2 bg-gray-300" />

                {/* Right Panel: Move History and Game Controls */}
                <ResizablePanel defaultSize={25} minSize={20} className="p-4 flex flex-col">
                    <div className="flex-grow border rounded-lg p-3 bg-gray-50 mb-4 overflow-hidden">
                        <h3 className="text-lg font-semibold mb-2 border-b pb-2">Move History</h3>
                        <div className="overflow-y-auto h-[calc(100%-2.5rem)] pr-1"> {/* Adjust height to enable scroll */}
                            <ol className="space-y-1 text-sm">
                                {moveHistory.reduce((acc, move, index) => {
                                    if (index % 2 === 0) {
                                        acc.push([move]);
                                    } else {
                                        acc[acc.length - 1].push(move);
                                    }
                                    return acc;
                                }, [] as string[][]).map((pair, i) => (
                                    <li key={i} className="flex">
                                        <span className="w-6 font-medium">{i + 1}.</span>
                                        <span className="w-16 truncate">{pair[0]}</span>
                                        {pair[1] && <span className="w-16 truncate">{pair[1]}</span>}
                                    </li>
                                ))}
                            </ol>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <div className="mb-4">
                            <label htmlFor="time-control-select" className="block text-sm font-medium text-gray-700 mb-1">
                                Select Game Format:
                            </label>
                            <Select
                                value={selectedTimeControl}
                                onValueChange={(value) => setSelectedTimeControl(value as keyof TimeControlPresets)}
                                disabled={!!gameId}
                            >
                                <SelectTrigger id="time-control-select" className="w-full">
                                    <SelectValue placeholder="Select a time control" />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(timeConfig).map(([key, config]) => (
                                        <SelectItem key={key} value={key}>
                                            {config.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
                            className="w-full"
                            disabled={!!gameId}
                            onClick={() => {
                                if (!socket) return;
                                dispatch(setGameState("Finding Opponent..."));
                                socket.send(JSON.stringify({ type: INIT_GAME, payload: { timeControl: selectedTimeControl, rating: yourRating } }));
                            }}
                        >
                            {gameId ? (playerColor ? "Game in Progress" : "Observing") : "Play Chess"}
                        </Button>
                        {gameId && playerColor && ( /* Only show Resign/Draw if in a game as a player */
                            <>
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => {
                                        if (socket && gameId && playerColor) { // Ensure game is active and player is part of it
                                            socket.send(JSON.stringify({
                                                type: RESIGN,
                                                payload: { gameId }
                                            }));
                                            // Optionally, update UI state e.g., dispatch(setGameState("Resigning..."));
                                        } else {
                                            console.warn("Cannot resign: No active game or socket connection.");
                                        }
                                    }}
                                    disabled={!gameId || !playerColor} // Keep disabled if no game or not a player
                                >
                                    Resign
                                </Button>
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => {
                                        if (socket && gameId && playerColor) {
                                            socket.send(JSON.stringify({
                                                type: OFFER_DRAW,
                                                payload: { gameId }
                                            }));
                                            setDrawOfferState('sent');
                                            // Optionally, update game status message in Redux
                                            // dispatch(setGameState("Draw offer sent. Waiting for opponent..."));
                                        } else {
                                            console.warn("Cannot offer draw: No active game or socket connection.");
                                        }
                                    }}
                                    disabled={!gameId || !playerColor || drawOfferState === 'sent' || drawOfferState === 'received'}
                                >
                                    Offer Draw
                                </Button>
                                {drawOfferState === 'sent' && <p className="text-sm text-center mt-2">Draw offer pending...</p>}
                                {drawOfferState === 'declined_by_opponent' && <p className="text-sm text-center mt-2">Draw offer declined by opponent.</p>}
                            </>
                        )}
                        {gameId && playerColor && drawOfferState === 'received' && (
                            <div className="mt-2 space-y-2">
                                <p className="text-sm text-center font-semibold">Opponent has offered a draw.</p>
                                <Button
                                    variant="default" // Or some other variant to highlight
                                    className="w-full"
                                    onClick={() => {
                                        // Logic for ACCEPT_DRAW will be added in next subtask
                                        if (socket && gameId) {
                                            socket.send(JSON.stringify({
                                                type: ACCEPT_DRAW,
                                                payload: { gameId }
                                            }));
                                            // Optimistically assume draw, server will confirm with GAME_OVER
                                            // setDrawOfferState('idle'); // Or a state like 'accepted'
                                            // dispatch(setGameState("Draw offer accepted."));
                                        }
                                    }}
                                >
                                    Accept Draw
                                </Button>
                                <Button
                                    variant="destructive" // Or "outline"
                                    className="w-full"
                                    onClick={() => {
                                        // Logic for DECLINE_DRAW will be added in next subtask
                                        if (socket && gameId) {
                                            socket.send(JSON.stringify({
                                                type: DECLINE_DRAW,
                                                payload: { gameId }
                                            }));
                                            setDrawOfferState('declined_by_me');
                                            // dispatch(setGameState("Draw offer declined."));
                                        }
                                    }}
                                >
                                    Decline Draw
                                </Button>
                            </div>
                        )}
                        {/* Display message if current user declined an offer */}
                        {drawOfferState === 'declined_by_me' && <p className="text-sm text-center mt-2">You declined the draw offer.</p>}
                        {gameId && playerColor && ( // Only show if in a game
                            <Button
                                variant="outline"
                                className="w-full mt-4"
                                onClick={() => toast.success('Test Toast!', { description: 'Sonner is working.' })}
                            >
                                Show Test Toast
                            </Button>
                        )}
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
};

export default Game;
