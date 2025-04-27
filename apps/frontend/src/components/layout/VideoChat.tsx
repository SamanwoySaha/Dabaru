import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export const VideoChat = ({ gameId, playerColor }: { gameId: string; playerColor: "white" | "black" | "" }) => {
    const [socket, setSocket] = useState<WebSocket | null>(null);
    const [pc, setPC] = useState<RTCPeerConnection | null>(null);
    const [remotePeerId, setRemotePeerId] = useState("");
    const [localPeerId] = useState(`${playerColor}-${gameId}`);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const whiteVideoRef = useRef<HTMLVideoElement>(null);
    const blackVideoRef = useRef<HTMLVideoElement>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [isAudioMuted, setIsAudioMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [disconnectedPlayer, setDisconnectedPlayer] = useState<"white" | "black" | null>(null);

    const addedTracks = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!gameId || !playerColor) return;

        const ws = new WebSocket('ws://localhost:8000');
        setSocket(ws);

        ws.onopen = () => {
            ws.send(JSON.stringify({
                type: 'register',
                peerId: localPeerId
            }));
        };

        return () => {
            cleanupConnection();
            if (ws) ws.close();
        };
    }, [gameId, playerColor]);

    useEffect(() => {
        if (disconnectedPlayer) {
            toast.error(`${disconnectedPlayer === "white" ? "White" : "Black"} disconnected`, {
                description: "The video chat has ended",
            });
            setDisconnectedPlayer(null);
        }
    }, [disconnectedPlayer]);

    const cleanupConnection = () => {
        if (pc) {
            pc.ontrack = null;
            pc.onicecandidate = null;
            pc.close();
            setPC(null);
        }
        
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            setLocalStream(null);
        }

        if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
        }

        if (whiteVideoRef.current) {
            whiteVideoRef.current.srcObject = null;
        }

        if (blackVideoRef.current) {
            blackVideoRef.current.srcObject = null;
        }

        setIsConnected(false);
        addedTracks.current.clear();
    };

    const toggleAudio = () => {
        if (localStream) {
            localStream.getAudioTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsAudioMuted(!isAudioMuted);
        }
    };

    const toggleVideo = () => {
        if (localStream) {
            localStream.getVideoTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsVideoOff(!isVideoOff);
        }
    };

    const disconnectVideo = () => {
        if (socket) {
            socket.send(JSON.stringify({
                type: 'disconnect',
                targetPeerId: remotePeerId,
                playerColor
            }));
        }
        cleanupConnection();
        setDisconnectedPlayer(playerColor);
    };

    const initiateConnection = async () => {
        if (!socket) return;

        setRemotePeerId(playerColor === "white" ? `black-${gameId}` : `white-${gameId}`);

        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });
        setPC(pc);

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.send(JSON.stringify({
                    type: 'iceCandidate',
                    candidate: event.candidate,
                    targetPeerId: remotePeerId
                }));
            }
        };

        pc.ontrack = (event) => {
            const trackId = event.track.id;
            if (!addedTracks.current.has(trackId)) {
                addedTracks.current.add(trackId);
                
                const remoteVideoElement = remotePeerId.startsWith('white') 
                    ? whiteVideoRef.current 
                    : blackVideoRef.current;

                if (remoteVideoElement) {
                    if (!remoteVideoElement.srcObject) {
                        const newStream = new MediaStream();
                        newStream.addTrack(event.track);
                        remoteVideoElement.srcObject = newStream;
                    } else {
                        const currentStream = remoteVideoElement.srcObject as MediaStream;
                        currentStream.addTrack(event.track);
                    }
                }
            }
        };

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: true, 
                audio: true 
            });
            setLocalStream(stream);
            
            // Enable both audio and video by default
            stream.getAudioTracks().forEach(track => track.enabled = true);
            stream.getVideoTracks().forEach(track => track.enabled = true);
            
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }
            
            stream.getTracks().forEach(track => {
                if (!addedTracks.current.has(track.id)) {
                    pc.addTrack(track, stream);
                    addedTracks.current.add(track.id);
                }
            });
        } catch (err) {
            console.error("Failed to get media", err);
            return;
        }

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
                setIsConnected(true);
            } else if (message.type === 'createAnswer') {
                await pc.setRemoteDescription(message.sdp);
                setIsConnected(true);
            } else if (message.type === 'iceCandidate') {
                await pc.addIceCandidate(message.candidate);
            } else if (message.type === 'disconnect') {
                cleanupConnection();
                setDisconnectedPlayer(message.playerColor);
            }
        };

        if (playerColor === "white") {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.send(JSON.stringify({
                type: 'createOffer',
                sdp: offer,
                targetPeerId: remotePeerId
            }));
        }
    };

    return (
        <div className="fixed top-4 left-4 right-4 flex justify-between pointer-events-none [&>*]:pointer-events-auto">
            {/* White player video (always on left) */}
            <Card className="w-40 h-40 overflow-hidden bg-background">
                <div className="relative w-full h-full">
                    {playerColor === "white" ? (
                        <>
                            <video 
                                ref={localVideoRef} 
                                autoPlay 
                                muted
                                className={`absolute inset-0 w-full h-full object-cover ${isVideoOff ? 'opacity-0' : ''}`}
                            />
                            {isVideoOff && (
                                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                                    <span className="text-2xl">⚪ You</span>
                                </div>
                            )}
                            <div className="absolute bottom-2 left-2 flex gap-1">
                                <Button 
                                    variant={isAudioMuted ? "destructive" : "outline"} 
                                    size="iconSm" 
                                    onClick={toggleAudio}
                                    className="h-6 w-6"
                                >
                                    {isAudioMuted ? <MicOff size={14} /> : <Mic size={14} />}
                                </Button>
                                <Button 
                                    variant={isVideoOff ? "destructive" : "outline"} 
                                    size="iconSm"
                                    onClick={toggleVideo}
                                    className="h-6 w-6"
                                >
                                    {isVideoOff ? <VideoOff size={14} /> : <Video size={14} />}
                                </Button>
                            </div>
                        </>
                    ) : (
                        <>
                            <video 
                                ref={whiteVideoRef} 
                                autoPlay 
                                className="absolute inset-0 w-full h-full object-cover"
                            />
                            {!isConnected && (
                                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                                    <span className="text-2xl">⚪ White</span>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </Card>

            {/* Black player video (always on right) */}
            <Card className="w-40 h-40 overflow-hidden bg-background">
                <div className="relative w-full h-full">
                    {playerColor === "black" ? (
                        <>
                            <video 
                                ref={localVideoRef} 
                                autoPlay 
                                muted
                                className={`absolute inset-0 w-full h-full object-cover ${isVideoOff ? 'opacity-0' : ''}`}
                            />
                            {isVideoOff && (
                                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                                    <span className="text-2xl">⚫ You</span>
                                </div>
                            )}
                            <div className="absolute bottom-2 left-2 flex gap-1">
                                <Button 
                                    variant={isAudioMuted ? "destructive" : "outline"} 
                                    size="iconSm" 
                                    onClick={toggleAudio}
                                    className="h-6 w-6"
                                >
                                    {isAudioMuted ? <MicOff size={14} /> : <Mic size={14} />}
                                </Button>
                                <Button 
                                    variant={isVideoOff ? "destructive" : "outline"} 
                                    size="iconSm"
                                    onClick={toggleVideo}
                                    className="h-6 w-6"
                                >
                                    {isVideoOff ? <VideoOff size={14} /> : <Video size={14} />}
                                </Button>
                            </div>
                        </>
                    ) : (
                        <>
                            <video 
                                ref={blackVideoRef} 
                                autoPlay 
                                className="absolute inset-0 w-full h-full object-cover"
                            />
                            {!isConnected && (
                                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                                    <span className="text-2xl">⚫ Black</span>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </Card>

            {/* Connect button (centered) */}
            {!isConnected && (
                <div className="absolute left-1/2 top-4 transform -translate-x-1/2">
                    <Button 
                        onClick={initiateConnection}
                        className="shadow-lg"
                    >
                        Connect Video Chat
                    </Button>
                </div>
            )}

            {/* Disconnect button (centered when connected) */}
            {isConnected && (
                <div className="absolute left-1/2 top-4 transform -translate-x-1/2">
                    <Button 
                        variant="destructive"
                        onClick={disconnectVideo}
                        className="shadow-lg gap-2"
                    >
                        <PhoneOff size={16} />
                        End Call
                    </Button>
                </div>
            )}
        </div>
    );
};