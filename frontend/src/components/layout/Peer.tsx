import { useEffect, useState } from "react"
import { Button } from "../ui/button";

export const Peer = () => {
    const [socket, setSocket] = useState<WebSocket | null>(null);
    const [pc, setPC] = useState<RTCPeerConnection | null>(null);
    const [remotePeerId, setRemotePeerId] = useState("");
    const [localPeerId] = useState(Math.random().toString(36).substring(2, 11));
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

    useEffect(() => {
        const socket = new WebSocket('ws://localhost:8000');
        setSocket(socket);
        socket.onopen = () => {
            socket.send(JSON.stringify({
                type: 'register',
                peerId: localPeerId
            }));
        }

        return () => {
            if (socket) socket.close();
        };
    }, [localPeerId]);

    const initiateConn = async () => {
        if (!socket || !remotePeerId) {
            alert("Socket or remote peer ID not found");
            return;
        }

        const pc = new RTCPeerConnection();
        setPC(pc);

        // Set up ICE candidate handling
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.send(JSON.stringify({
                    type: 'iceCandidate',
                    candidate: event.candidate,
                    targetPeerId: remotePeerId
                }));
            }
        };

        // Set up remote stream handling
        pc.ontrack = (event) => {
            setRemoteStream(new MediaStream([event.track]));
        };

        // Add local stream tracks if available
        if (localStream) {
            localStream.getTracks().forEach(track => {
                pc.addTrack(track, localStream);
            });
        }

        // Handle incoming messages
        socket.onmessage = async (event) => {
            const message = JSON.parse(event.data);
            if (message.type === 'createOffer') {
                await pc.setRemoteDescription(message.sdp);
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socket.send(JSON.stringify({
                    type: 'createAnswer',
                    sdp: answer,
                    targetPeerId: message.senderPeerId
                }));
            } else if (message.type === 'createAnswer') {
                await pc.setRemoteDescription(message.sdp);
            } else if (message.type === 'iceCandidate') {
                await pc.addIceCandidate(message.candidate);
            }
        };

        // Create initial offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.send(JSON.stringify({
            type: 'createOffer',
            sdp: offer,
            targetPeerId: remotePeerId
        }));
    }

    const getCameraStream = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(stream);
        } catch (err) {
            console.error("Failed to get media", err);
        }
    }

    return <div>
        <div>
            <p>Your ID: {localPeerId}</p>
            <input 
                type="text" 
                value={remotePeerId} 
                onChange={(e) => setRemotePeerId(e.target.value)} 
                placeholder="Enter remote peer ID"
            />
            <Button onClick={getCameraStream}>Get Camera</Button>
            <Button onClick={initiateConn}>Connect</Button>
        </div>
        
        <div style={{ display: 'flex' }}>
            <div>
                <h3>Local Stream</h3>
                {localStream && (
                    <video 
                        autoPlay 
                        muted 
                        ref={(video) => {
                            if (video) video.srcObject = localStream;
                        }}
                        style={{ width: '300px' }}
                    />
                )}
            </div>
            <div>
                <h3>Remote Stream</h3>
                {remoteStream && (
                    <video 
                        autoPlay 
                        ref={(video) => {
                            if (video) video.srcObject = remoteStream;
                        }}
                        style={{ width: '300px' }}
                    />
                )}
            </div>
        </div>
    </div>
}