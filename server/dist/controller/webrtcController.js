// WebRTC signaling and peer connection logic for the server
import WebSocket from 'ws';
import wrtc from 'wrtc';
import fs from 'fs';
const SIGNALER_WS_URL = process.env.SIGNALER_WS_URL || 'ws://signaler:8080';
const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    // Add TURN servers here if needed
];
let signalerId = null;
let peerConnection = null;
let ws = null;
export function startWebRTCSignaling() {
    connectToSignalerAndSaveId();
}
function connectToSignalerAndSaveId() {
    ws = new WebSocket(SIGNALER_WS_URL);
    ws.on('open', () => {
        console.log('Connected to signaler for device registration');
    });
    ws.on('message', async (data) => {
        try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'signaler-id' && msg.signalerId) {
                signalerId = msg.signalerId;
                if (signalerId) {
                    saveDeviceJson(signalerId);
                }
                if (signalerId) {
                    fs.writeFileSync('/usr/src/app/signalId.txt', signalerId); // Save to file (legacy)
                }
                else {
                    console.error('signalerId is null, cannot save to file');
                }
                console.log('Received and saved signalerId:', signalerId);
                // TODO: Broadcast over Bluetooth here
            }
            else if (msg.type === 'get-ice-config') {
                // Respond to signaler with ICE config
                ws?.send(JSON.stringify({
                    type: 'ice-config',
                    target: msg.from,
                    payload: { iceServers: ICE_SERVERS },
                }));
            }
            else if (msg.type === 'offer') {
                // Received offer from client, create peer connection and respond
                await handleOffer(msg);
            }
            else if (msg.type === 'answer') {
                // Received answer from client
                await handleAnswer(msg);
            }
            else if (msg.type === 'ice-candidate') {
                // Received ICE candidate from client
                await handleRemoteIceCandidate(msg);
            }
        }
        catch (e) {
            console.error('Error parsing message from signaler:', e);
        }
    });
    ws.on('close', () => {
        console.log('Signaler connection closed, retrying in 5s...');
        setTimeout(connectToSignalerAndSaveId, 5000);
    });
    ws.on('error', (err) => {
        console.error('Signaler connection error:', err);
    });
}
async function handleOffer(msg) {
    if (peerConnection) {
        peerConnection.close();
    }
    peerConnection = new wrtc.RTCPeerConnection({ iceServers: ICE_SERVERS });
    peerConnection.onicecandidate = (event) => {
        if (event.candidate && ws && msg.from) {
            ws.send(JSON.stringify({
                type: 'ice-candidate',
                target: msg.from,
                payload: { candidate: event.candidate },
            }));
        }
    };
    peerConnection.onconnectionstatechange = () => {
        console.log('Peer connection state:', peerConnection?.connectionState);
    };
    await peerConnection.setRemoteDescription(msg.payload.offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    // Send answer back to client
    ws?.send(JSON.stringify({
        type: 'answer',
        target: msg.from,
        payload: { answer },
    }));
}
async function handleAnswer(msg) {
    if (peerConnection) {
        await peerConnection.setRemoteDescription(msg.payload.answer);
    }
}
async function handleRemoteIceCandidate(msg) {
    if (peerConnection && msg.payload && msg.payload.candidate) {
        try {
            await peerConnection.addIceCandidate(new wrtc.RTCIceCandidate(msg.payload.candidate));
        }
        catch (e) {
            console.error('Error adding remote ICE candidate:', e);
        }
    }
}
function saveDeviceJson(id) {
    const deviceInfo = {
        signalerId: id,
        createdAt: new Date().toISOString(),
        // Add more device metadata here if needed
    };
    fs.writeFileSync('/usr/src/app/device.json', JSON.stringify(deviceInfo, null, 2));
    console.log('Saved device.json:', deviceInfo);
}
