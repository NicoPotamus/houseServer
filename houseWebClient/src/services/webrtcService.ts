// WebRTC service for Next.js web client
import { v4 as uuidv4 } from 'uuid';

// Check if we're in browser environment
const isBrowser = typeof window !== 'undefined';

// WebRTC classes - available natively in browsers
let RTCPeerConnection: any, RTCSessionDescription: any, RTCIceCandidate: any;
let webrtcAvailable = false;

// Function to initialize WebRTC for web platform
function initializeWebRTC() {
  if (isBrowser && window.RTCPeerConnection) {
    RTCPeerConnection = window.RTCPeerConnection;
    RTCSessionDescription = window.RTCSessionDescription;
    RTCIceCandidate = window.RTCIceCandidate;
    webrtcAvailable = true;
    console.log('✅ WebRTC initialized successfully for Web');
    return true;
  } else {
    console.warn('⚠️  WebRTC is not supported in this browser environment');
    webrtcAvailable = false;
    return false;
  }
}

// Initialize WebRTC when in browser
if (isBrowser) {
  initializeWebRTC();
}

// Function to ensure dummy implementations exist
function ensureDummyImplementations() {
  if (!RTCPeerConnection) {
    RTCPeerConnection = class DummyRTCPeerConnection {
      constructor() { 
        console.warn('🚫 WebRTC not available - using dummy implementation'); 
      }
      createDataChannel() { return { 
        send: () => console.warn('WebRTC not available'), 
        close: () => {},
        readyState: 'closed'
      }; }
      close() {}
      addIceCandidate() { return Promise.resolve(); }
      createAnswer() { return Promise.resolve({}); }
      createOffer() { return Promise.resolve({}); }
      setLocalDescription() { return Promise.resolve(); }
      setRemoteDescription() { return Promise.resolve(); }
      addEventListener() {}
      removeEventListener() {}
    };
  }
  
  if (!RTCSessionDescription) {
    RTCSessionDescription = class DummyRTCSessionDescription {
      constructor(init: any) { Object.assign(this, init); }
    };
  }
  
  if (!RTCIceCandidate) {
    RTCIceCandidate = class DummyRTCIceCandidate {
      constructor(init: any) { Object.assign(this, init); }
    };
  }
}

// Ensure dummy implementations are available initially
ensureDummyImplementations();

// Helper function to check if WebRTC is supported
export function isWebRTCSupported(): boolean {
  if (isBrowser && window.RTCPeerConnection) {
    // Initialize WebRTC if not already done
    if (!webrtcAvailable) {
      initializeWebRTC();
    }
    return webrtcAvailable;
  }
  return false;
}

class WebRTCService {
  peerConnection: RTCPeerConnection | null = null;
  dataChannel: RTCDataChannel | null = null;
  ws: WebSocket | null = null;
  deviceId: string | null = null;
  userId: string | null = null;
  signalerId: string | null = null;
  signalingUrl: string | null = null;
  onConnected: (() => void) | null = null;
  onDisconnected: (() => void) | null = null;
  pingInterval: any = null;
  onData: ((data: any) => void) | null = null;
  connectionStartTime: number = 0;
  lastSignalingActivity: number = 0;
  pendingIceCandidates: any[] = [];
  
  // Check if WebRTC is available in this environment
  isWebRTCAvailable(): boolean {
    // For web platforms, try to initialize if not already done
    if (isBrowser && !webrtcAvailable) {
      initializeWebRTC();
    }
    return webrtcAvailable;
  }
  
  // Get WebRTC availability message
  getWebRTCStatus(): { available: boolean; message: string; instructions?: string } {
    // Ensure WebRTC is initialized
    const available = this.isWebRTCAvailable();
    
    if (available) {
      return {
        available: true,
        message: '✅ WebRTC is available and ready to use'
      };
    }
    
    return {
      available: false,
      message: '⚠️ WebRTC is not supported in this browser',
      instructions: 'Please use a modern browser that supports WebRTC (Chrome, Firefox, Safari, Edge)'
    };
  }

  connect(signalingUrl: string, targetDeviceId: string, userId: string) {
    this.signalingUrl = signalingUrl;
    console.log(`Connecting to signaling server at: ${signalingUrl}`);
    console.log(`Target device ID: ${targetDeviceId}, User ID: ${userId}`);
    
    this.connectionStartTime = Date.now();
    this.lastSignalingActivity = Date.now();
    
    this.cleanup();
    
    this.deviceId = targetDeviceId;
    this.userId = userId;
    this.pendingIceCandidates = [];
    
    try {
      if (!signalingUrl) {
        throw new Error('Invalid signaler URL: URL is empty');
      }
      
      let finalUrl = signalingUrl;
      
      // Handle protocol conversion
      if (finalUrl.startsWith('http://')) {
        finalUrl = finalUrl.replace('http://', 'ws://');
      } else if (finalUrl.startsWith('https://')) {
        finalUrl = finalUrl.replace('https://', 'wss://');
      } else if (!finalUrl.startsWith('ws://') && !finalUrl.startsWith('wss://')) {
        finalUrl = `ws://${finalUrl}`;
      }
      
      console.log(`Final connection URL: ${finalUrl}`);
      
      this.ws = new WebSocket(finalUrl);
      console.log('WebSocket connection object created, awaiting connection...');
      
      this.ws.onopen = () => {
        console.log('WebSocket connection to signaler OPENED successfully!');
        this.lastSignalingActivity = Date.now();
        
        const registerMsg = JSON.stringify({ 
          type: 'register', 
          deviceId: userId
        });
        console.log(`Sending registration message to signaler: ${registerMsg}`);
        
        try {
          this.ws?.send(registerMsg);
          console.log('Registration message sent to signaler');
          
          if (this.pingInterval) {
            clearInterval(this.pingInterval);
          }
          
          this.pingInterval = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
              try {
                this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
              } catch (e) {
                console.warn('Failed to send ping to signaler:', e);
              }
            }
          }, 20000);
        } catch (err) {
          console.error('Failed to send registration message:', err);
        }
      };

      this.ws.onmessage = async (event) => {
        console.log(`Received message from signaler: ${event.data.substring(0, 200)}${event.data.length > 200 ? '...' : ''}`);
        this.lastSignalingActivity = Date.now();
        
        try {
          const msg = JSON.parse(event.data);
          console.log(`Parsed message type: ${msg.type}`);
          
          if (msg.type === 'error') {
            console.error(`Signaler error: ${msg.message}`);
            if (msg.message === 'Target device not connected' || msg.message === 'Target not found') {
              console.error(`Target device ${targetDeviceId} is not connected to the signaler.`);
              if (this.onDisconnected) {
                this.onDisconnected();
              }
            }
            return;
          }
          
          if (msg.type === 'signaler-id') {
            console.log(`Signaler assigned ID: ${msg.signalerId}`);
            this.signalerId = msg.signalerId;
            
            console.log(`Initiating connection to target device: ${targetDeviceId}`);
            await this.createPeerConnection(targetDeviceId);
            await this.createAndSendOffer(targetDeviceId);
            
          } else if (msg.type === 'register-success') {
            console.log(`Registration successful, device ID: ${msg.deviceId}, signaler ID: ${msg.signalerId}`);
            this.signalerId = msg.signalerId;
            
            console.log(`Initiating connection to target device: ${targetDeviceId}`);
            await this.createPeerConnection(targetDeviceId);
            await this.createAndSendOffer(targetDeviceId);
            
          } else if (msg.type === 'offer') {
            console.log('Received WebRTC offer from signaler, handling...');
            await this.handleOffer(msg, targetDeviceId);
          } else if (msg.type === 'answer') {
            console.log('Received WebRTC answer from signaler, handling...');
            await this.handleAnswer(msg);
          } else if (msg.type === 'ice') {
            console.log('Received ICE candidate from signaler, handling...');
            await this.handleRemoteIce(msg);
          } else {
            console.warn(`Received unknown message type from signaler: ${msg.type}`);
          }
        } catch (err) {
          console.error('Failed to process signaler message:', err);
        }
      };

      this.ws.onclose = (event) => {
        console.log(`WebSocket connection to signaler CLOSED with code ${event.code}: ${event.reason || 'No reason provided'}`);
        console.log('Cleaning up peer connection due to signaler disconnect');
        
        this.cleanup();
        
        if (this.onDisconnected) {
          this.onDisconnected();
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket ERROR connecting to signaler:', error);
        
        if (this.onDisconnected) {
          this.onDisconnected();
        }
      };
      
    } catch (error) {
      console.error('Error in connect:', error);
      this.cleanup();
      throw error;
    }
  }

  cleanup() {
    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch (e) {
        console.warn('Error closing data channel:', e);
      }
      this.dataChannel = null;
    }
    
    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch (e) {
        console.warn('Error closing peer connection:', e);
      }
      this.peerConnection = null;
    }
    
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {
        console.warn('Error closing WebSocket:', e);
      }
      this.ws = null;
    }
    
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    this.pendingIceCandidates = [];
    this.signalerId = null;
  }

  async createPeerConnection(targetDeviceId: string, isCallee = false) {
    console.log(`Creating peer connection (isCallee: ${isCallee})`);
    
    if (!this.isWebRTCAvailable()) {
      console.warn('WebRTC is not supported in this environment');
      return;
    }
    
    if (!RTCPeerConnection || RTCPeerConnection.name === 'DummyRTCPeerConnection') {
      console.warn('WebRTC classes not properly initialized');
      return;
    }

    try {
      console.log('Creating new RTCPeerConnection with STUN servers');
      
      if (this.peerConnection) {
        console.log('Closing existing peer connection before creating a new one');
        this.peerConnection.close();
        this.peerConnection = null;
      }
      
      this.peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ],
      });
      
      this.dataChannel = null;
      
      console.log('Setting up peer connection event handlers');
      
      if (this.peerConnection) {
        this.peerConnection.onconnectionstatechange = () => {
          const state = this.peerConnection?.connectionState;
          console.log(`WebRTC connection state changed: ${state}`);
          
          if (state === 'connected') {
            console.log('WebRTC connection established!');
            if (this.onConnected) {
              this.onConnected();
            }
          } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
            console.log('WebRTC connection ended:', state);
            if (this.onDisconnected) {
              this.onDisconnected();
            }
          }
        };
        
        this.peerConnection.oniceconnectionstatechange = () => {
          console.log(`ICE connection state changed: ${this.peerConnection?.iceConnectionState}`);
        };
        
        this.peerConnection.onicegatheringstatechange = () => {
          console.log(`ICE gathering state changed: ${this.peerConnection?.iceGatheringState}`);
        };
        
        this.peerConnection.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
          console.log(`ICE candidate ${event.candidate ? 'generated' : 'generation complete'}`);
          
          if (event.candidate && this.ws) {
            console.log(`Sending ICE candidate to target device: ${targetDeviceId}`);
            const iceMsg = JSON.stringify({
              type: 'ice',
              targetDeviceId,
              ice: event.candidate,
            });
            
            try {
              this.ws.send(iceMsg);
              console.log('ICE candidate sent successfully');
              this.lastSignalingActivity = Date.now();
            } catch (err) {
              console.error('Failed to send ICE candidate:', err);
            }
          }
        };
      }
      
      if (!isCallee && this.peerConnection) {
        console.log('Creating data channel as caller');
        
        try {
          const dataChannel = this.peerConnection.createDataChannel('data', {
            ordered: true,
          });
          console.log(`Data channel created, initial state: ${dataChannel.readyState}`);
          this.dataChannel = dataChannel;
          
          dataChannel.onopen = () => {
            console.log(`Data channel OPENED (client side), state: ${dataChannel.readyState}`);
            
            try {
              dataChannel.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
              console.log('Test ping message sent on data channel');
            } catch (e) {
              console.warn('Could not send test message on data channel:', e);
            }
            
            if (this.onConnected) {
              console.log('Calling onConnected callback (data channel open)');
              this.onConnected();
            }
          };
          
          dataChannel.onclose = () => {
            console.log('Data channel CLOSED (client side)');
            if (this.onDisconnected) {
              this.onDisconnected();
            }
          };
          
          dataChannel.onerror = (error: any) => {
            console.error('Data channel ERROR (client side):', error);
          };
          
          dataChannel.onmessage = (e: MessageEvent) => {
            console.log(`Received message on data channel (client side): ${typeof e.data === 'string' ? 
              `${e.data.substring(0, 50)}${e.data.length > 50 ? '...' : ''}` : 'binary data'}`);
            this.handleDataChannelMessage(e.data);
          };
        } catch (err) {
          console.error('Failed to create data channel:', err);
        }
      } else if (this.peerConnection) {
        console.log('Setting up ondatachannel handler as callee');
        
        this.peerConnection.ondatachannel = (event: RTCDataChannelEvent) => {
          console.log('Data channel received from caller');
          const dataChannel = event.channel;
          console.log(`Received data channel label: ${dataChannel.label}, state: ${dataChannel.readyState}`);
          this.dataChannel = dataChannel;
          
          dataChannel.onopen = () => {
            console.log(`Data channel OPENED (server side), state: ${dataChannel.readyState}`);
            
            try {
              dataChannel.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
              console.log('Test pong message sent on data channel');
            } catch (e) {
              console.warn('Could not send test message on data channel:', e);
            }
            
            if (this.onConnected) {
              console.log('Calling onConnected callback (data channel open)');
              this.onConnected();
            }
          };
          
          dataChannel.onclose = () => {
            console.log('Data channel CLOSED (server side)');
            if (this.onDisconnected) {
              this.onDisconnected();
            }
          };
          
          dataChannel.onerror = (error: any) => {
            console.error('Data channel ERROR (server side):', error);
          };
          
          dataChannel.onmessage = (e: MessageEvent) => {
            console.log(`Received message on data channel (server side): ${typeof e.data === 'string' ? 
              `${e.data.substring(0, 50)}${e.data.length > 50 ? '...' : ''}` : 'binary data'}`);
            this.handleDataChannelMessage(e.data);
          };
        };
      }
      
      if (this.pendingIceCandidates.length > 0) {
        console.log(`Processing ${this.pendingIceCandidates.length} pending ICE candidates`);
        for (const candidate of this.pendingIceCandidates) {
          await this.handleRemoteIce({ ice: candidate });
        }
        this.pendingIceCandidates = [];
      }
    } catch (error) {
      console.error('Error creating peer connection:', error);
    }
  }

  async createAndSendOffer(targetDeviceId: string) {
    console.log(`Creating and sending offer to target device: ${targetDeviceId}`);
    
    if (!this.peerConnection) {
      console.error('Cannot create offer: peer connection not initialized');
      return;
    }
    
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error(`Cannot send offer: WebSocket state is ${this.ws?.readyState || 'null'}`);
      return;
    }
    
    try {
      console.log('Creating offer...');
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false
      });
      
      console.log(`Offer created: ${JSON.stringify(offer).substring(0, 100)}...`);
      
      console.log('Setting local description...');
      await this.peerConnection.setLocalDescription(offer);
      console.log('Local description set successfully');
      
      const offerMsg = JSON.stringify({
        type: 'offer',
        targetDeviceId,
        deviceId: this.userId,
        offer,
      });
      
      console.log(`Sending offer message to signaler: ${offerMsg.substring(0, 100)}...`);
      this.ws.send(offerMsg);
      console.log('Offer sent successfully');
      this.lastSignalingActivity = Date.now();
    } catch (error) {
      console.error('Error creating and sending offer:', error);
    }
  }

  async handleOffer(msg: any, targetDeviceId: string) {
    console.log('Handling incoming WebRTC offer');
    
    await this.createPeerConnection(targetDeviceId, true);
    
    if (!this.peerConnection) {
      console.error('Failed to create peer connection for handling offer');
      return;
    }
    
    try {
      console.log('Setting remote description from offer...');
      await this.peerConnection.setRemoteDescription(msg.offer);
      console.log('Remote description set successfully');
      
      console.log('Creating answer...');
      const answer = await this.peerConnection.createAnswer();
      console.log(`Answer created`);
      
      console.log('Setting local description from answer...');
      await this.peerConnection.setLocalDescription(answer);
      console.log('Local description set successfully');
      
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        console.error(`Cannot send answer: WebSocket state is ${this.ws?.readyState || 'null'}`);
        return;
      }
      
      const answerMsg = JSON.stringify({
        type: 'answer',
        targetDeviceId: msg.deviceId || targetDeviceId,
        deviceId: this.userId,
        answer,
      });
      
      console.log(`Sending answer message`);
      this.ws.send(answerMsg);
      console.log('Answer sent successfully');
      this.lastSignalingActivity = Date.now();
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  }

  async handleAnswer(msg: any) {
    console.log('Handling incoming WebRTC answer');
    
    if (!this.peerConnection) {
      console.error('Cannot handle answer: peer connection not initialized');
      return;
    }
    
    try {
      console.log('Setting remote description from answer...');
      await this.peerConnection.setRemoteDescription(msg.answer);
      console.log('Remote description set successfully');
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  }

  async handleRemoteIce(msg: any) {
    if (!this.peerConnection) {
      console.warn('Cannot handle ICE candidate: peer connection not initialized');
      this.pendingIceCandidates.push(msg.ice);
      console.log(`Saved ICE candidate for later processing. Total pending: ${this.pendingIceCandidates.length}`);
      return;
    }
    
    if (!msg.ice) {
      console.error('Received ICE message without candidate');
      return;
    }
    
    try {
      console.log(`Adding remote ICE candidate`);
      await this.peerConnection.addIceCandidate(msg.ice);
      console.log('Remote ICE candidate added successfully');
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  }

  handleDataChannelMessage(data: any) {
    console.log(`Handling data channel message: ${typeof data === 'string' ? data.substring(0, 50) : 'binary data'}`);
    
    if (this.onData) {
      this.onData(data);
    }
  }

  sendRequest(endpoint: string, method: string = 'GET', data: any = null): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        if (!this.peerConnection) {
          const error = new Error('WebRTC peer connection not initialized. Please check your connection.');
          console.error(error.message);
          return reject(error);
        }
        
        if (!this.dataChannel) {
          const error = new Error('WebRTC data channel not initialized. Please reconnect to the device.');
          console.error(error.message);
          return reject(error);
        }
        
        if (this.dataChannel.readyState !== 'open') {
          const error = new Error(`Data channel not open, current state: ${this.dataChannel.readyState}. Please reconnect.`);
          console.error(`Cannot send request: ${error.message}`);
          return reject(error);
        }
        
        const requestId = Date.now().toString();
        const message = {
          endpoint,
          method,
          data,
          requestId,
        };
        
        console.log(`Sending WebRTC request ${requestId} to endpoint: ${endpoint}`);
        
        const timeout = setTimeout(() => {
          const error = new Error(`Request ${requestId} to ${endpoint} timed out after 30 seconds`);
          console.error(error.message);
          reject(error);
        }, 30000);
        
        try {
          this.dataChannel.send(JSON.stringify(message));
          console.log(`Request ${requestId} to ${endpoint} sent successfully via data channel`);
          
          // For this demo, we'll just resolve immediately
          // In a real implementation, you'd wait for a response
          clearTimeout(timeout);
          resolve({ success: true, requestId });
        } catch (error) {
          console.error(`Failed to send request ${requestId} to ${endpoint}:`, error);
          clearTimeout(timeout);
          reject(error);
        }
      } catch (unexpectedError) {
        console.error('Unexpected error in sendRequest:', unexpectedError);
        reject(new Error(`Unexpected error in WebRTC sendRequest: ${unexpectedError instanceof Error ? unexpectedError.message : String(unexpectedError)}`));
      }
    });
  }

  getConnectionStatus() {
    const wsConnected = this.ws?.readyState === WebSocket.OPEN;
    const peerConnectionState = this.peerConnection?.connectionState || 'new';
    const iceConnectionState = this.peerConnection?.iceConnectionState || 'new';
    const dataChannelState = this.dataChannel?.readyState || 'closed';
    
    const isConnected = 
      wsConnected && 
      ['connected', 'completed'].includes(peerConnectionState) && 
      dataChannelState === 'open';
    
    return {
      wsConnected,
      peerConnectionState,
      iceConnectionState,
      dataChannelState,
      isConnected,
      lastSignalingActivity: this.lastSignalingActivity,
      connectionStartTime: this.connectionStartTime,
      timeSinceLastActivity: Date.now() - this.lastSignalingActivity
    };
  }
}

// Export a singleton instance of the WebRTCService
export const webrtcService = new WebRTCService();
