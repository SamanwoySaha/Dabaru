import WebSocket from "ws";
import { Chess } from 'chess.js'
import { GAME_OVER, MOVE } from "./messages";
import { v4 as uuidv4 } from 'uuid';
import redisClient from './redisClient';
import prisma from './prismaClient'; // Import Prisma client

export class Game {
    public player1: WebSocket;
    public player2: WebSocket;
    private board: Chess;
    public readonly startTime: Date; // Made public for _saveGameRecord, already was effectively
    private moveCount = 0;
    public readonly gameId: string; // UUID for this game session
    public chatHistory: {sender: string, data: string, timeStamp: string}[];

    public readonly timeControl: string;
    public player1SocketToUserId?: string; // For future auth link
    public player2SocketToUserId?: string; // For future auth link

    constructor(player1: WebSocket, player2: WebSocket, timeControl: string, p1UserId?: string, p2UserId?: string) {
        this.player1 = player1;
        this.player2 = player2;
        this.board = new Chess();
        this.startTime = new Date();
        this.gameId = uuidv4();
        this.chatHistory = [];
        this.timeControl = timeControl;
        this.player1SocketToUserId = p1UserId;
        this.player2SocketToUserId = p2UserId;
    }

    private async _saveGameRecord(winnerColor: 'white' | 'black' | 'draw') {
        if (!this.player1 || !this.player2) {
            console.error("Players not defined, cannot save game record for gameId:", this.gameId);
            return;
        }

        // CRITICAL: These placeholder IDs MUST exist in the User table for FK constraints.
        // This is a known potential point of failure for the subtask if DB is not seeded.
        // const placeholderWhitePlayerId = this.player1SocketToUserId || 'clxkytm0x0000qzyx1234abcd';
        // const placeholderBlackPlayerId = this.player2SocketToUserId || 'clxkytm0y0001qzyx5678efgh';

        const whitePlayerIdToSave = this.player1SocketToUserId;
        const blackPlayerIdToSave = this.player2SocketToUserId;

        if (!whitePlayerIdToSave || !blackPlayerIdToSave) {
            console.error(`Cannot save game record for game ${this.gameId}: missing player UserIDs. White: ${whitePlayerIdToSave}, Black: ${blackPlayerIdToSave}`);
            // Optionally, could use a known 'guest' or 'anonymous' user ID from the DB if desired,
            // but this would require that user to exist. For now, just log and skip save.
            return; // Or throw, or save with nulls if schema allows (current schema doesn't)
        }

        let resultString: string;
        let winnerId: string | null = null;

        if (winnerColor === 'white') {
            resultString = 'WHITE_WINS';
            winnerId = whitePlayerIdToSave;
        } else if (winnerColor === 'black') {
            resultString = 'BLACK_WINS';
            winnerId = blackPlayerIdToSave;
        } else { // draw
            resultString = 'DRAW';
            winnerId = null;
        }

        // TODO: Fetch actual ratings. For now, using default (1200).
        const whiteRatingBefore = 1200;
        const blackRatingBefore = 1200;
        const whiteRatingAfter = whiteRatingBefore; // Placeholder: No rating change logic yet
        const blackRatingAfter = blackRatingBefore; // Placeholder: No rating change logic yet

        try {
            // @ts-ignore - To handle potential mismatch if `originalWsGameId` is not yet in schema
            // This assumes `GameRecord` schema will have `originalWsGameId: String?`
            // and that `gameId` on `GameRecord` is the CUID PK.
            await prisma.gameRecord.create({
                data: {
                    // id: auto-generated CUID by Prisma
                    originalWsGameId: this.gameId, // Storing the WebSocket Game's UUID session ID
                    timeControl: this.timeControl,
                    result: resultString,
                    playedAt: this.startTime,

                    whitePlayerId: whitePlayerIdToSave,
                    whitePlayerRatingBefore: whiteRatingBefore, // Still placeholder
                    whitePlayerRatingAfter: whiteRatingAfter,   // Still placeholder

                    blackPlayerId: blackPlayerIdToSave,
                    blackPlayerRatingBefore: blackRatingBefore, // Still placeholder
                    blackPlayerRatingAfter: blackRatingAfter,   // Still placeholder

                    winnerId: winnerId,
                    // moves: this.board.history({ verbose: true }) // Example if storing moves in GameRecord
                }
            });
            console.log(`Game record saved for gameId: ${this.gameId} (originalWsGameId)`);
        } catch (error) {
            console.error('Failed to save game record for gameId (originalWsGameId):', this.gameId, error);
            // Log detailed error, could be due to FK violation if placeholder users don't exist,
            // or schema mismatch for originalWsGameId.
        }
    }

    makeMove(socket: WebSocket, move: {
        from: string,
        to: string,
        promotion?: string // Promotion is optional
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

        // Store the move in Redis
        const uciMove = move.from + move.to + (move.promotion ? move.promotion : '');
        try {
            // Asynchronously store the move.
            // No need to await if not critical for game progression immediately after.
            if (redisClient.isOpen) { // Check if client is connected before sending command
                redisClient.rPush(`game:${this.gameId}:moves`, uciMove)
                    .catch(err => console.error('Redis RPush Error:', err)); // Add error handling
            } else {
                console.error('Redis client not connected. Move not stored.');
                // Optionally, queue this move or handle reconnection logic more explicitly here if needed.
            }
        } catch (e) {
            // This catch block might be redundant if the promise .catch handles it,
            // but good for synchronous errors if any were possible before the promise.
            console.error("Error during redis operation preparation:", e);
        }

        if (this.board.isGameOver()) {
            const winner = this.board.turn() === "w" ? "black" : "white";
            this._saveGameRecord(winner); // Save game record
            this.player1.send(JSON.stringify({
                type: GAME_OVER,
                payload: { winner, gameId: this.gameId }
            }));
            this.player2.send(JSON.stringify({
                type: GAME_OVER,
                payload: { winner, gameId: this.gameId }
            }));
            return;
        }
        // Handle other draw conditions like stalemate, threefold repetition, etc.
        if (this.board.isDraw()) {
            this._saveGameRecord('draw'); // Save game record as a draw
            this.player1.send(JSON.stringify({ type: GAME_OVER, payload: { winner: 'draw', gameId: this.gameId } }));
            this.player2.send(JSON.stringify({ type: GAME_OVER, payload: { winner: 'draw', gameId: this.gameId } }));
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
        let winnerColor: 'white' | 'black';
        if (resigningSocket === this.player1) {
            winnerColor = "black"; // Player 2 (black) wins
        } else if (resigningSocket === this.player2) {
            winnerColor = "white"; // Player 1 (white) wins
        } else {
            console.error("Resigning socket does not match any player in this game for gameId:", this.gameId);
            return;
        }

        this._saveGameRecord(winnerColor); // Save game record

        // Send GAME_OVER message to both players
        this.player1.send(JSON.stringify({
            type: GAME_OVER,
            payload: { winner: winnerColor, gameId: this.gameId }
        }));
        this.player2.send(JSON.stringify({
            type: GAME_OVER,
            payload: { winner: winnerColor, gameId: this.gameId }
        }));
    }

    public handleAcceptDraw() {
        this._saveGameRecord('draw'); // Save game record as a draw

        // Send GAME_OVER message to both players indicating a draw
        const gameOverPayload = {
            type: GAME_OVER,
            payload: {
                winner: "draw",
                gameId: this.gameId
            }
        };
        this.player1.send(JSON.stringify(gameOverPayload));
        this.player2.send(JSON.stringify(gameOverPayload));
    }
}