import WebSocket from "ws";
import { Chess } from 'chess.js'
import { GAME_OVER, MOVE } from "./messages"; // Removed INIT_GAME as it's not used in this file
import { v4 as uuidv4 } from 'uuid';

export class Game {
    public player1: WebSocket;
    public player2: WebSocket;
    private board: Chess;
    private startTime: Date;
    private moveCount = 0;
    public readonly gameId: string;
    public chatHistory: {sender: string, data: string, timeStamp: string}[];

    constructor(player1: WebSocket, player2: WebSocket) {
        this.player1 = player1;
        this.player2 = player2;
        this.board = new Chess();
        this.startTime = new Date();
        this.gameId = uuidv4();
        this.chatHistory = [];
    }

    makeMove(socket: WebSocket, move: {
        from: string,
        to: string
    }) {
        // validate the move using zod
        if (this.moveCount % 2 === 0 && socket !== this.player1) {
            return;
        }
        if (this.moveCount % 2 === 1 && socket !== this.player2) {
            return;
        }

        try {
            this.board.move(move);
        } catch(e) {
            console.log(e);
            return;
        }        

        if (this.board.isGameOver()) {
            this.player1.send(JSON.stringify({
                type: GAME_OVER,
                payload: {
                    winner: this.board.turn() === "w" ? "black" : "white"
                }
            }));
            this.player2.send(JSON.stringify({
                type: GAME_OVER,
                payload: {
                    winner: this.board.turn() === "w" ? "black" : "white"
                }
            }));
            return;
        }

        if (this.moveCount % 2 === 0) {
            this.player2.send(JSON.stringify({
                type: MOVE,
                payload: move
            }))
        } else {
            this.player1.send(JSON.stringify({
                type: MOVE,
                payload: move
            }))
        }
        this.moveCount++;
    }

    public handleResign(resigningSocket: WebSocket) {
        let winner: string;
        if (resigningSocket === this.player1) {
            winner = "black"; // Player 2 (black) wins
        } else if (resigningSocket === this.player2) {
            winner = "white"; // Player 1 (white) wins
        } else {
            console.error("Resigning socket does not match any player in this game.");
            return; // Or handle error appropriately
        }

        // Send GAME_OVER message to both players
        this.player1.send(JSON.stringify({
            type: GAME_OVER,
            payload: { winner, gameId: this.gameId } // Include gameId
        }));
        this.player2.send(JSON.stringify({
            type: GAME_OVER,
            payload: { winner, gameId: this.gameId } // Include gameId
        }));

        // Consider internal state update to prevent further moves, though client handling GAME_OVER should suffice.
        // For example: this.board.load('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'); // Reset board or set a flag
    }

    public handleAcceptDraw() {
        // Send GAME_OVER message to both players indicating a draw
        const gameOverPayload = {
            type: GAME_OVER,
            payload: {
                winner: "draw", // Special value for draw
                gameId: this.gameId
            }
        };
        this.player1.send(JSON.stringify(gameOverPayload));
        this.player2.send(JSON.stringify(gameOverPayload));

        // Mark game as over (e.g., set a flag or use chess.js if it supports draw states)
        // This helps prevent further moves or actions.
        // Consider adding: private isConcluded: boolean = false; this.isConcluded = true;
    }
}