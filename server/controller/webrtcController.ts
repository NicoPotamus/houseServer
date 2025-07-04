// WebRTC signaling and peer connection logic for the server
import WebSocket from 'ws';
import wrtc from 'wrtc';
import fs from 'fs';

const SIGNALER_WS_URL = process.env.SIGNALER_WS_URL || 'ws://signaler:8080';
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  // Add TURN servers here if needed
];

let signalerId: string | null = null;
let peerConnection: wrtc.RTCPeerConnection | null = null;
let ws: WebSocket | null = null;

export function startWebRTCSignaling() {
  connectToSignalerAndSaveId();
}

function connectToSignalerAndSaveId() {
  // Check for existing signalId.txt in persistent volume
  const signalIdPath = '/usr/src/app/disk/signalId.txt';
  let existingId: string | null = null;
  if (fs.existsSync(signalIdPath)) {
    existingId = fs.readFileSync(signalIdPath, 'utf-8').trim();
    if (existingId) {
      signalerId = existingId;
      saveDeviceJson(signalerId);
      console.log('Loaded existing signalerId from disk:', signalerId);
      // Optionally, register this ID with the signaler if needed
    }
  }

  ws = new WebSocket(SIGNALER_WS_URL);

  ws.on('open', () => {
    console.log('Connected to signaler for device registration');
    // If we have an existing ID, send it to the signaler for reuse
    if (signalerId) {
      ws!.send(JSON.stringify({ type: 'register', deviceId: signalerId }));
      console.log('Sent existing deviceId to signaler:', signalerId);
    }
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
          fs.writeFileSync(signalIdPath, signalerId); // Save to persistent volume
        } else {
          console.error('signalerId is null, cannot save to file');
        }
        console.log('Received and saved signalerId:', signalerId);
        // TODO: Broadcast over Bluetooth here
      } else if (msg.type === 'get-ice-config') {
        ws?.send(JSON.stringify({
          type: 'ice-config',
          target: msg.from,
          payload: { iceServers: ICE_SERVERS },
        }));
      } else if (msg.type === 'incoming-connection') {
        // Prepare to receive offer from client
        await createPeerConnection(msg.deviceId, true);
        // Wait for offer from client
      } else if (msg.type === 'offer') {
        await handleOffer(msg);
      } else if (msg.type === 'answer') {
        await handleAnswer(msg);
      } else if (msg.type === 'ice') {
        await handleRemoteIceCandidate(msg);
      }
    } catch (e) {
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

async function createPeerConnection(targetDeviceId: string, isCallee = false) {
  if (peerConnection) peerConnection.close();
  peerConnection = new wrtc.RTCPeerConnection({ iceServers: ICE_SERVERS });

  peerConnection.onicecandidate = (event: any) => {
    if (event.candidate && ws) {
      ws.send(
        JSON.stringify({
          type: 'ice',
          targetDeviceId,
          ice: event.candidate,
        })
      );
    }
  };

  peerConnection.onconnectionstatechange = () => {
    console.log('Peer connection state:', peerConnection?.connectionState);
  };

  if (isCallee) {
    // @ts-ignore: ondatachannel exists at runtime
    peerConnection.ondatachannel = (event: any) => {
      const dataChannel = event.channel;
      dataChannel.onopen = () => {
        console.log('Data channel open');
      };
      dataChannel.onmessage = (e: any) => {
        console.log('Received data:', e.data);
      };
    };
  } else {
    // @ts-ignore: createDataChannel exists at runtime
    const dataChannel = peerConnection.createDataChannel('data');
    dataChannel.onopen = () => {
      console.log('Data channel open');
    };
    dataChannel.onmessage = (e: any) => {
      console.log('Received data:', e.data);
    };
  }
}

async function handleOffer(msg: any) {
  await createPeerConnection(msg.deviceId, true);
  if (!peerConnection) return;
  await peerConnection.setRemoteDescription({ type: 'offer', sdp: msg.offer.sdp });
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  ws?.send(
    JSON.stringify({
      type: 'answer',
      targetDeviceId: msg.deviceId,
      answer,
    })
  );
}

async function handleAnswer(msg: any) {
  if (peerConnection) {
    await peerConnection.setRemoteDescription({ type: 'answer', sdp: msg.answer.sdp });
  }
}

async function handleRemoteIceCandidate(msg: any) {
  if (peerConnection && msg.ice) {
    try {
      await peerConnection.addIceCandidate(new wrtc.RTCIceCandidate(msg.ice));
    } catch (e) {
      console.error('Error adding remote ICE candidate:', e);
    }
  }
}

function saveDeviceJson(id: string) {
  const deviceInfo = {
    signalerId: id,
    createdAt: new Date().toISOString(),
    // Add more device metadata here if needed
  };
  fs.writeFileSync('/usr/src/app/disk/device.json', JSON.stringify(deviceInfo, null, 2));
  console.log('Saved device.json:', deviceInfo);
}
