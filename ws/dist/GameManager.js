"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameManager = void 0;
const messages_1 = require("./messages");
const Game_1 = require("./Game");
class GameManager {
    constructor() {
        this.MAX_RATING_DIFFERENCE = 200;
        this.WAIT_TIME_TOLERANCE = 30000;
        this.games = [];
        this.queues = new Map();
        this.users = [];
    }
    addUser(socket, timeControl, rating) {
        this.users.push(socket);
        this.addToQueue(socket, timeControl, rating);
        this.addHandler(socket);
    }
    removeUser(socket) {
        this.users = this.users.filter((user) => user !== socket);
        this.removeFromQueue(socket);
    }
    addToQueue(socket, timeControl, rating) {
        if (!this.queues.has(timeControl)) {
            this.queues.set(timeControl, []);
        }
        const queue = this.queues.get(timeControl);
        queue.push({ socket, timeControl, rating, joinTime: Date.now() });
        this.tryMatchPlayers(timeControl);
    }
    removeFromQueue(socket) {
        this.queues.forEach((queue, timeControl) => {
            this.queues.set(timeControl, queue.filter((player) => player.socket !== socket));
        });
    }
    tryMatchPlayers(timeControl) {
        const queue = this.queues.get(timeControl);
        if (!queue || queue.length < 2)
            return;
        queue.sort((a, b) => a.rating - b.rating);
        let bestPairIndex = -1;
        let smallestRatingDiff = Infinity;
        for (let i = 0; i < queue.length - 1; i++) {
            const player1 = queue[i];
            const player2 = queue[i + 1];
            const ratingDiff = Math.abs(player1.rating - player2.rating);
            const waitedTooLong = Date.now() - player1.joinTime > this.WAIT_TIME_TOLERANCE ||
                Date.now() - player2.joinTime > this.WAIT_TIME_TOLERANCE;
            const isEligible = ratingDiff <= this.MAX_RATING_DIFFERENCE || waitedTooLong;
            if (isEligible && ratingDiff < smallestRatingDiff) {
                smallestRatingDiff = ratingDiff;
                bestPairIndex = i;
            }
        }
        if (bestPairIndex != -1) {
            const [player1, player2] = queue.splice(bestPairIndex, 2);
            const game = new Game_1.Game(player1.socket, player2.socket);
            player1.socket.send(JSON.stringify({
                type: messages_1.GAME_START,
                payload: {
                    color: "white",
                    opponentRating: player2.rating,
                    timeControl: timeControl,
                    gameId: game.gameId
                }
            }));
            player2.socket.send(JSON.stringify({
                type: messages_1.GAME_START,
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
    addHandler(socket) {
        socket.on("message", (data) => {
            const message = JSON.parse(data.toString());
            switch (message.type) {
                case messages_1.MOVE:
                    const game = this.games.find((game) => game.player1 === socket || game.player2 === socket);
                    if (game)
                        game.makeMove(socket, message.payload.move);
                    break;
            }
        });
    }
}
exports.GameManager = GameManager;
