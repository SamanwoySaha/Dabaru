import { WebSocketServer } from 'ws';
import { GameManager } from './GameManager';
import { PLAYER_COUNT } from './messages';

const wss = new WebSocketServer({ port: 8080 });

const gameManager = new GameManager();

wss.on('connection', function connection(ws) {
  gameManager.addUser(ws);

  broadcastPlayerCount();

  ws.on('close', () => {
    gameManager.removeUser(ws);
    broadcastPlayerCount();
  })
});

const broadcastPlayerCount = () => {
  wss.clients.forEach(client => {
    client.send(JSON.stringify({
      type: PLAYER_COUNT,
      count: gameManager.users.length,
    }));
  });
}