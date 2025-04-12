import WebSocket, { WebSocketServer } from 'ws';
import { GameManager } from './GameManager';
import { PLAYER_COUNT, INIT_GAME } from './messages';
import { timeConfig } from './timeConfig';

const wss = new WebSocketServer({ port: 8080 });
const gameManager = new GameManager();

wss.on('connection', function connection(ws) {
  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    if (message.type == INIT_GAME) {
      const { timeControl, rating } = message.payload;
      gameManager.addUser(ws, timeControl, rating);
      broadcastPlayerCount();
    }
  })

  ws.on('close', () => {
    gameManager.removeUser(ws);
    broadcastPlayerCount();
  })
});

const broadcastPlayerCount = () => {
  wss.clients.forEach(client => {
    if (client.readyState == WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: PLAYER_COUNT,
        payload: {
          count: gameManager.users.length,
        }
      }));  
    }
  });
}