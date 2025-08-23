import { WebSocket } from "ws";
import { CHAT, GAME_START, INIT_GAME, MOVE } from "./messages";
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
                        const isPlayer1 = game.player1 == socket;
                        const chatPayload = {
                            sender: message.payload.playerColor,
                            data: message.payload.data,
                            timeStamp: Date.now().toString()
                        }

                        game.chatHistory.push(chatPayload);

                        const opponent = isPlayer1 ? game.player2 : game.player1;
                        opponent.send(JSON.stringify({
                            type: CHAT,
                            payload: chatPayload
                        }))

                        socket.send(JSON.stringify({
                            type: CHAT,
                            payload: chatPayload
                        }))
                    }
                    break;
            }
        });
    }
}
