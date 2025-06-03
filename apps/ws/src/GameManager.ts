import { WebSocket } from "ws";
import {
    CHAT, GAME_START, INIT_GAME, MOVE, RESIGN,
    OFFER_DRAW, DRAW_OFFER_RECEIVED, ACCEPT_DRAW, DECLINE_DRAW, DRAW_OFFER_DECLINED, GAME_OVER
} from "./messages";
import { Game } from "./Game";

interface QueuedPlayer {
    socket: WebSocket;
    timeControl: string;
    rating: number;
    joinTime: number;
}

export class GameManager {
    private games: Game[];
    private queues: Map<string, QueuedPlayer[]>;
    private readonly MAX_RATING_DIFFERENCE = 200;
    private readonly WAIT_TIME_TOLERANCE = 30000;
    public users: WebSocket[];

    constructor() {
        this.games = [];
        this.queues = new Map();
        this.users = [];
    }

    addUser(socket: WebSocket, timeControl: string, rating: number) {
        this.users.push(socket);
        this.addToQueue(socket, timeControl, rating);
        this.addHandler(socket);
    }

    removeUser(socket: WebSocket) {
        this.users = this.users.filter((user) => user !== socket);
        this.removeFromQueue(socket);
    }

    private addToQueue(socket: WebSocket, timeControl: string, rating: number) {
        if (!this.queues.has(timeControl)) {
            this.queues.set(timeControl, []);
        }
        const queue = this.queues.get(timeControl)!;
        queue.push({ socket, timeControl, rating, joinTime: Date.now() });
        this.tryMatchPlayers(timeControl);
    }

    private removeFromQueue(socket: WebSocket) {
        this.queues.forEach((queue, timeControl) => {
            this.queues.set(timeControl, queue.filter((player) => player.socket !== socket));
        })
    }

    private tryMatchPlayers(timeControl: string) {
        const queue = this.queues.get(timeControl);
        if (!queue || queue.length < 2) return;

        queue.sort((a, b) => a.rating - b.rating);

        let bestPairIndex = -1;
        let smallestRatingDiff = Infinity;

        for (let i=0; i<queue.length-1; i++) {
            const player1 = queue[i];
            const player2 = queue[i+1];
            const ratingDiff = Math.abs(player1.rating - player2.rating);

            const waitedTooLong = 
                Date.now() - player1.joinTime > this.WAIT_TIME_TOLERANCE ||
                Date.now() - player2.joinTime > this.WAIT_TIME_TOLERANCE;

            const isEligible = ratingDiff <= this.MAX_RATING_DIFFERENCE || waitedTooLong;

            if (isEligible && ratingDiff < smallestRatingDiff) {
                smallestRatingDiff = ratingDiff;
                bestPairIndex = i;
            }
        }

        if (bestPairIndex != -1) {
            const [player1, player2] = queue.splice(bestPairIndex, 2);
            const game = new Game(player1.socket, player2.socket);

            player1.socket.send(JSON.stringify({
                type: GAME_START,
                payload: {
                    color: "white",
                    opponentRating: player2.rating,
                    timeControl: timeControl,
                    gameId: game.gameId
                }
            }));
            player2.socket.send(JSON.stringify({
                type: GAME_START,
                payload: {
                    color: "black",
                    opponentRating: player1.rating,
                    timeControl: timeControl,
                    gameId: game.gameId
                }
            }));

            this.games.push(game);
            this.queues.set(timeControl, queue);
        }
    }

    private addHandler(socket: WebSocket) {
        socket.on("message", (data) => {
            const message = JSON.parse(data.toString());
            const game = this.games.find(
                (game) => game.player1 === socket || game.player2 === socket
            );

            if (!game) return;

            switch (message.type) {
                case MOVE:                     
                    if (game) game.makeMove(socket, message.payload.move);
                    break;
                
                case CHAT:
                    if (game) {
                        const isPlayer1 = game.player1 === socket;
                        const senderColor = isPlayer1 ? "white" : "black"; // Assuming player1 is white

                        const chatPayload = {
                            sender: senderColor, // Use server-determined color
                            data: message.payload.data,
                            timeStamp: new Date().toISOString(), // Use ISO string for consistency
                            gameId: game.gameId // Include gameId
                        };

                        game.chatHistory.push(chatPayload);

                        const opponent = isPlayer1 ? game.player2 : game.player1;
                        opponent.send(JSON.stringify({
                            type: CHAT,
                            payload: chatPayload
                        }));

                        // Remove sending back to self, client handles optimistic update
                    }
                    break;
                case RESIGN:
                    if (game) {
                        game.handleResign(socket);
                        // Optionally, clean up the game from this.games array if it's truly over
                        // and no further interaction (like post-game chat) is expected through it.
                        // this.games = this.games.filter(g => g.gameId !== game.gameId);
                    }
                    break;
                case OFFER_DRAW:
                    if (game) {
                        // Determine the opponent
                        const opponentSocket = (socket === game.player1) ? game.player2 : game.player1;

                        opponentSocket.send(JSON.stringify({
                            type: DRAW_OFFER_RECEIVED,
                            payload: {
                                gameId: game.gameId,
                            }
                        }));
                        // console.log(`Draw offer relayed for game ${game.gameId} to opponent.`);
                    }
                    break;
                case ACCEPT_DRAW:
                    if (game) {
                        game.handleAcceptDraw();
                    }
                    break;
                case DECLINE_DRAW:
                    if (game) {
                        const originalOffererSocket = (socket === game.player1) ? game.player2 : game.player1;
                        originalOffererSocket.send(JSON.stringify({
                            type: DRAW_OFFER_DECLINED,
                            payload: { gameId: game.gameId }
                        }));
                    }
                    break;
            }
        });
    }
}
