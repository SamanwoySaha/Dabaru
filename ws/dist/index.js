"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const GameManager_1 = require("./GameManager");
const messages_1 = require("./messages");
const wss = new ws_1.WebSocketServer({ port: 8080 });
const gameManager = new GameManager_1.GameManager();
wss.on('connection', function connection(ws) {
    gameManager.addUser(ws);
    broadcastPlayerCount();
    ws.on('close', () => {
        gameManager.removeUser(ws);
        broadcastPlayerCount();
    });
});
const broadcastPlayerCount = () => {
    wss.clients.forEach(client => {
        client.send(JSON.stringify({
            type: messages_1.PLAYER_COUNT,
            count: gameManager.users.length,
        }));
    });
};
