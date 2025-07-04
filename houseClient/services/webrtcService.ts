import { useDevice } from '@/context/DeviceContext';
import { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } from 'react-native-webrtc';

class WebRTCService {
  ws: WebSocket | null = null;
  peerConnection: RTCPeerConnection | null = null;
  dataChannel: any = null; // RTCDataChannel, but type may be incomplete in react-native-webrtc
  deviceId: string | null = null;
  userId: string | null = null;
  onConnected: (() => void) | null = null;
  onData: ((data: any) => void) | null = null;

  connect(signalingUrl: string, targetDeviceId: string, userId: string) {
    this.deviceId = targetDeviceId;
    this.userId = userId;
    this.ws = new WebSocket(signalingUrl);

    this.ws.onopen = () => {
      // Register with the signaler
      this.ws?.send(JSON.stringify({ type: 'register', deviceId: userId }));
      if (this.onConnected) this.onConnected();
    };

    this.ws.onmessage = async (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'signaler-id') {
        // Optionally store signalerId
      } else if (msg.type === 'offer') {
        await this.handleOffer(msg, targetDeviceId);
      } else if (msg.type === 'answer') {
        await this.handleAnswer(msg);
      } else if (msg.type === 'ice') {
        await this.handleRemoteIce(msg);
      } else if (msg.type === 'incoming-connection') {
        // If you are the device, start as callee
        await this.createPeerConnection(targetDeviceId, true);
        await this.createAndSendOffer(targetDeviceId);
      }
    };

    this.ws.onclose = () => {
      this.peerConnection?.close();
      this.peerConnection = null;
      this.dataChannel = null;
      this.ws = null;
    };
  }

  async createPeerConnection(targetDeviceId: string, isCallee = false) {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    this.dataChannel = null;
    // @ts-ignore: onicecandidate exists at runtime
    this.peerConnection.onicecandidate = (event: { candidate: RTCIceCandidate | null }) => {
      if (event.candidate && this.ws) {
        this.ws.send(
          JSON.stringify({
            type: 'ice',
            targetDeviceId,
            ice: event.candidate,
          })
        );
      }
    };
    if (!isCallee) {
      const dataChannel = this.peerConnection.createDataChannel('data');
      this.dataChannel = dataChannel;
      // @ts-ignore: onopen exists at runtime
      dataChannel.onopen = () => {
        if (this.onConnected) this.onConnected();
      };
      // @ts-ignore: onmessage exists at runtime
      dataChannel.onmessage = (e: { data: any }) => {
        if (this.onData) this.onData(e.data);
      };
    } else {
      // @ts-ignore: ondatachannel exists at runtime
      this.peerConnection.ondatachannel = (event: { channel: any }) => {
        const dataChannel = event.channel;
        this.dataChannel = dataChannel;
        // @ts-ignore: onopen exists at runtime
        dataChannel.onopen = () => {
          if (this.onConnected) this.onConnected();
        };
        // @ts-ignore: onmessage exists at runtime
        dataChannel.onmessage = (e: { data: any }) => {
          if (this.onData) this.onData(e.data);
        };
      };
    }
  }

  async createAndSendOffer(targetDeviceId: string) {
    if (!this.peerConnection || !this.ws) return;
    const offer = await this.peerConnection.createOffer({});
    await this.peerConnection.setLocalDescription(offer);
    this.ws.send(
      JSON.stringify({
        type: 'offer',
        targetDeviceId,
        offer,
      })
    );
  }

  async handleOffer(msg: any, targetDeviceId: string) {
    await this.createPeerConnection(targetDeviceId, true);
    await this.peerConnection?.setRemoteDescription(new RTCSessionDescription(msg.offer));
    const answer = await this.peerConnection?.createAnswer();
    await this.peerConnection?.setLocalDescription(answer);
    this.ws?.send(
      JSON.stringify({
        type: 'answer',
        targetDeviceId: msg.deviceId,
        answer,
      })
    );
  }

  async handleAnswer(msg: any) {
    await this.peerConnection?.setRemoteDescription(new RTCSessionDescription(msg.answer));
  }

  async handleRemoteIce(msg: any) {
    if (msg.ice) {
      await this.peerConnection?.addIceCandidate(new RTCIceCandidate(msg.ice));
    }
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
    this.peerConnection?.close();
    this.peerConnection = null;
    this.dataChannel = null;
  }

  sendData(data: any) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(data);
    }
  }
}

export const webrtcService = new WebRTCService();
