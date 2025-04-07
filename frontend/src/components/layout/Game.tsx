import { useCallback, useEffect, useState } from "react";
import { Button } from "../ui/button";
import { useSocket } from "@/hooks/useSocket";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";

export const INIT_GAME = "init_game";
export const MOVE = "move";
export const GAME_OVER = "game_over";

const Game = () => {
    const socket = useSocket();
    const [chess, setChess] = useState(new Chess());
    const [fen, setFen] = useState(chess.fen());
    const [gameState, setGameState] = useState("Waiting for opponent...");
    const [playerColor, setplayerColor] = useState('');
    const [isMyTurn, setIsMyTurn] = useState(false);

    useEffect(() => {
        if (!socket) return;

        socket.onmessage = (event) => {
            const message = JSON.parse(event.data);

            switch (message.type) {
                case INIT_GAME: {
                    const color = message.payload.color;
                    const newChess = new Chess();
                    setChess(newChess);
                    setFen(newChess.fen());
                    setplayerColor(color);
                    setIsMyTurn(color === 'white');
                    setGameState(color === 'white' ? 'Your turn!' : "Waiting for opponent...");
                    console.log(gameState);
                    break;
                }
                case MOVE: {
                    const move = message.payload;
                    makeAMove(move, true);
                    setGameState("Your turn!");
                    setIsMyTurn(true);
                    console.log("Remote move received ", move);
                    break;
                }
                case GAME_OVER:
                    setGameState("Game Over");
                    console.log("game over");
                    break;
            }
        };
    }, [socket, chess, playerColor]);

    const makeAMove = useCallback(
        (move: {from: string, to: string}, isRemoteMove = false) => {
          try {         
            const newChess = new Chess(chess.fen());
            const result = newChess.move(move);

            if (!result) {
                setGameState("Illegal move");
                return null;
            }
            
            setChess(newChess);
            setFen(newChess.fen());
            setIsMyTurn(false);

            if (!isRemoteMove) {
                socket?.send(JSON.stringify({
                    type: MOVE,
                    payload: {
                        move: move
                    }
                }))
                return true;
            } 
                
            setIsMyTurn(newChess.turn() === playerColor[0]);
            console.log("Move made, game state:", newChess.isGameOver() ? "Game Over" : "In Progress");
                
            if (newChess.isGameOver()) {
                if (newChess.isCheckmate()) {
                    setGameState(
                        `Checkmate! ${newChess.turn() === "w" ? "black" : "white"} wins!`
                    );
                } else if (newChess.isDraw()) {
                    setGameState("Draw");
                } else {
                    setGameState("Game over");
                }
                
                socket?.send(JSON.stringify({
                    type: GAME_OVER
                }));
            }
            return result;
            

            
          } catch (e) {
            console.error("Error making move:", e);
            setGameState("Error making move");
            return null;
          } 
    }, [chess, socket]);

    function onDrop(sourceSquare, targetSquare) {
        if (!isMyTurn) {
            setGameState("Not your turn");
            return false;
        }
        const moveData = {
          from: sourceSquare,
          to: targetSquare,
        };
    
        const move = makeAMove(moveData, false);
        
        setGameState("Waiting for opponent...");
    
        // illegal move    
        return move !== null;
    }

    

    if (!socket) return <div>Connecting...</div>;

    return (
        <div>
            <div>{gameState}</div>
            <div>Your color: {playerColor}</div>
            <div className="flex items-center justify-center" style={{ width: "600px" }}>
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
            <Button
                onClick={() => {
                    socket.send(
                        JSON.stringify({
                            type: INIT_GAME,
                        })
                    );
                }}
            >
                Play Chess
            </Button>
        </div>
    );
};

export default Game;

