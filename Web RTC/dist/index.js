"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const wss = new ws_1.WebSocketServer({ port: 8000 });
const peers = {};
wss.on('connection', function connection(ws) {
    ws.on('error', console.error);
    let peerId;
    ws.on('message', function message(data) {
        const message = JSON.parse(data);
        if (message.type === 'register') {
            peerId = message.peerId;
            peers[peerId] = ws;
            console.log(`Peer ${peerId} registered`);
        }
        else if (message.type === 'createOffer') {
            const targetPeer = peers[message.targetPeerId];
            if (targetPeer) {
                targetPeer.send(JSON.stringify({
                    type: 'createOffer',
                    sdp: message.sdp,
                    senderPeerId: peerId
                }));
            }
        }
        else if (message.type === 'createAnswer') {
            const targetPeer = peers[message.targetPeerId];
            if (targetPeer) {
                targetPeer.send(JSON.stringify({
                    type: 'createAnswer',
                    sdp: message.sdp,
                    senderPeerId: peerId
                }));
            }
        }
        else if (message.type === 'iceCandidate') {
            const targetPeer = peers[message.targetPeerId];
            if (targetPeer) {
                targetPeer.send(JSON.stringify({
                    type: 'iceCandidate',
                    candidate: message.candidate,
                    senderPeerId: peerId
                }));
            }
        }
    });
    ws.on('close', () => {
        if (peerId) {
            delete peers[peerId];
            console.log(`Peer ${peerId} disconnected`);
        }
    });
});
