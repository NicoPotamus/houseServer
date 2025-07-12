import { useDevice } from '@/context/DeviceContext';
import { Platform } from 'react-native';

// Import WebRTC classes based on platform
let RTCPeerConnection: any, RTCSessionDescription: any, RTCIceCandidate: any;
let webrtcAvailable = false;

// Function to initialize WebRTC for web platform
function initializeWebRTC() {
  if (Platform.OS === 'web') {
    // Web implementation - use browser APIs
    if (typeof window !== 'undefined' && window.RTCPeerConnection) {
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
  } else {
    // Native implementation - use react-native-webrtc
    try {
      const {
        RTCPeerConnection: NativeRTCPeerConnection,
        RTCSessionDescription: NativeRTCSessionDescription,
        RTCIceCandidate: NativeRTCIceCandidate,
      } = require('react-native-webrtc');
      
      RTCPeerConnection = NativeRTCPeerConnection;
      RTCSessionDescription = NativeRTCSessionDescription;
      RTCIceCandidate = NativeRTCIceCandidate;
      webrtcAvailable = true;
      
      console.log('✅ WebRTC initialized successfully for React Native');
      return true;
    } catch (e) {
      console.warn('⚠️  react-native-webrtc not available. You need to create a development build to use WebRTC.');
      console.warn('   Run: npx expo run:android or npx expo run:ios');
      webrtcAvailable = false;
      return false;
    }
  }
}

// Initialize WebRTC immediately for non-web platforms
if (Platform.OS !== 'web') {
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

// Helper function to check if WebRTC is supported in this environment
export function isWebRTCSupported(): boolean {
  if (Platform.OS === 'web') {
    // For web, check if WebRTC is available in the browser
    if (typeof window !== 'undefined' && window.RTCPeerConnection) {
      // Initialize WebRTC if not already done
      if (!webrtcAvailable) {
        initializeWebRTC();
      }
      return webrtcAvailable;
    }
    return false;
  } else {
    // For native platforms, we'll assume WebRTC is available if we've successfully
    // loaded the module (which we check during import)
    return webrtcAvailable;
  }
}

// Function to properly format WebSocket URLs for different environments
export function formatWebSocketUrl(url: string): string {
  if (!url) return url;

  // If we're using localhost on a mobile device, we need to use special IP addresses
  if ((url.includes('localhost') || url.includes('127.0.0.1')) && Platform.OS !== 'web') {
    // For Android emulator, use 10.0.2.2 instead of localhost
    if (Platform.OS === 'android') {
      console.log('Android device detected, replacing localhost with 10.0.2.2');
      return url.replace(/localhost|127\.0\.0\.1/g, '10.0.2.2');
    }
    // For iOS simulator, use host.docker.internal or localhost depending on setup
    else if (Platform.OS === 'ios') {
      console.log('iOS device detected, using localhost (may need adjustment)');
      // You may need to replace with host.docker.internal if running in Docker
      return url;
    }
  }
  
  return url;
}

class WebRTCService {
  peerConnection: any = null; // RTCPeerConnection
  dataChannel: any = null; // RTCDataChannel, but type may be incomplete in react-native-webrtc
  ws: WebSocket | null = null;
  deviceId: string | null = null;
  userId: string | null = null;
  signalerId: string | null = null; // Store the signalerId received from signaler
  signalingUrl: string | null = null; // Store the original signaling URL
  onConnected: (() => void) | null = null;
  onDisconnected: (() => void) | null = null;
  pingInterval: any = null; // for the WebSocket ping
  onData: ((data: any) => void) | null = null;
  connectionStartTime: number = 0;
  lastSignalingActivity: number = 0;
  pendingIceCandidates: any[] = []; // Store ICE candidates if they arrive before peer connection is ready
  
  // Check if WebRTC is available in this environment
  isWebRTCAvailable(): boolean {
    // For web platforms, try to initialize if not already done
    if (Platform.OS === 'web' && !webrtcAvailable) {
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
    
    if (Platform.OS === 'web') {
      return {
        available: false,
        message: '⚠️ WebRTC is not supported in this browser',
        instructions: 'Please use a modern browser that supports WebRTC (Chrome, Firefox, Safari, Edge)'
      };
    } else {
      return {
        available: false,
        message: '⚠️ WebRTC requires a development build',
        instructions: 'Run: npx expo run:android or npx expo run:ios to create a development build with WebRTC support'
      };
    }
  }
  
  // Helper method to log connection details
  logConnectionDetails(closeCode: number): void {
    // Implementation will be in the method assignment below
  }

  connect(signalingUrl: string, targetDeviceId: string, userId: string) {
    // Store the original signaling URL for reconnection logic
    this.signalingUrl = signalingUrl;
    console.log(`Connecting to signaling server at: ${signalingUrl}`);
    console.log(`Target device ID: ${targetDeviceId}, User ID: ${userId}`);
    
    // Record the connection start time for diagnostics
    this.connectionStartTime = Date.now();
    this.lastSignalingActivity = Date.now();
    
    // Clean up any existing connections
    this.cleanup();
    
    this.deviceId = targetDeviceId;
    this.userId = userId;
    this.pendingIceCandidates = []; // Reset pending candidates
    
    try {
      // Validate the signaling URL
      if (!signalingUrl) {
        throw new Error('Invalid signaler URL: URL is empty');
      }
      
      // Format the signaling URL for the current environment
      let finalUrl = formatWebSocketUrl(signalingUrl);
      
      // Handle edge case where the URL is still using http:// or https:// instead of ws:// or wss://
      if (finalUrl.startsWith('http://')) {
        finalUrl = finalUrl.replace('http://', 'ws://');
      } else if (finalUrl.startsWith('https://')) {
        finalUrl = finalUrl.replace('https://', 'wss://');
      } else if (!finalUrl.startsWith('ws://') && !finalUrl.startsWith('wss://')) {
        // If no protocol, default to ws://
        finalUrl = `ws://${finalUrl}`;
      }
      
      // Log the device platform for debugging
      console.log(`Current platform: ${Platform.OS}`);
      
      
      console.log(`Final connection URL: ${finalUrl}`);
      
      // Create new WebSocket connection to signaling server
      this.ws = new WebSocket(finalUrl);
      console.log('WebSocket connection object created, awaiting connection...');
      
      this.ws.onopen = () => {
        console.log('WebSocket connection to signaler OPENED successfully!');
        this.lastSignalingActivity = Date.now();
        
        // Register with the signaler - using userId as our client identifier
        const registerMsg = JSON.stringify({ 
          type: 'register', 
          deviceId: userId // We use userId as our deviceId for the signaling server
        });
        console.log(`Sending registration message to signaler: ${registerMsg}`);
        
        try {
          this.ws?.send(registerMsg);
          console.log('Registration message sent to signaler');
          
          // Add a ping interval to keep the connection alive
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
          }, 20000); // Ping every 20 seconds
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
          
          // Handle error messages from signaler
          if (msg.type === 'error') {
            console.error(`Signaler error: ${msg.message}`);
            if (msg.message === 'Target device not connected' || msg.message === 'Target not found') {
              console.error(`Target device ${targetDeviceId} is not connected to the signaler.`);
              // Handle the error and notify the user
              if (this.onDisconnected) {
                this.onDisconnected();
              }
            }
            return;
          }
          
          if (msg.type === 'signaler-id') {
            console.log(`Signaler assigned ID: ${msg.signalerId}`);
            this.signalerId = msg.signalerId;
            
            // Now that we're registered, initiate connection to target device
            console.log(`Initiating connection to target device: ${targetDeviceId}`);
            await this.createPeerConnection(targetDeviceId);
            await this.createAndSendOffer(targetDeviceId);
            
          } else if (msg.type === 'register-success') {
            console.log(`Registration successful, device ID: ${msg.deviceId}, signaler ID: ${msg.signalerId}`);
            this.signalerId = msg.signalerId;
            
            // Now that we're registered, initiate connection to target device
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
          } else if (msg.type === 'incoming-connection') {
            console.log('Received incoming connection notification from signaler');
            // Client should always be the caller, not callee
            console.log('Creating peer connection as caller...');
            await this.createPeerConnection(targetDeviceId, false); // false = caller
            console.log('Creating and sending offer...');
            await this.createAndSendOffer(targetDeviceId);
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
        
        // Add detailed debug info about close reasons
        this.logConnectionDetails(event.code);
        
        this.cleanup();
        
        // Notify that we're disconnected
        if (this.onDisconnected) {
          this.onDisconnected();
        }
        
        // After a brief delay, try to reconnect if we're still active
        if (this.deviceId && this.userId) {
          const { deviceId, userId } = this;
          setTimeout(() => {
            if (this.deviceId === deviceId && this.userId === userId) {
              console.log('Attempting to reconnect to signaler...');
              // Get the latest signaling URL which might have changed
              const finalUrl = this.ws ? this.ws.url : formatWebSocketUrl(this.signalingUrl || '');
              this.connect(finalUrl, deviceId, userId);
            }
          }, 3000);
        }
      };
      
      // Helper method to provide verbose debug info
      this.logConnectionDetails = (closeCode) => {
        // Check common close codes
        let codeDescription = 'Unknown close reason';
        switch (closeCode) {
          case 1000:
            codeDescription = 'Normal closure - connection successfully completed';
            break;
          case 1001:
            codeDescription = 'Going away - server/client going away';
            break;
          case 1002:
            codeDescription = 'Protocol error';
            break;
          case 1003:
            codeDescription = 'Unsupported data';
            break;
          case 1005:
            codeDescription = 'No status received';
            break;
          case 1006:
            codeDescription = 'Abnormal closure - connection dropped without a close frame';
            break;
          case 1007:
            codeDescription = 'Invalid data';
            break;
          case 1008:
            codeDescription = 'Policy violation';
            break;
          case 1009:
            codeDescription = 'Message too big';
            break;
          case 1010:
            codeDescription = 'Extension required';
            break;
          case 1011:
            codeDescription = 'Internal error';
            break;
          case 1012:
            codeDescription = 'Service restart';
            break;
          case 1013:
            codeDescription = 'Try again later';
            break;
          case 1014:
            codeDescription = 'Bad gateway';
            break;
          case 1015:
            codeDescription = 'TLS handshake failure';
            break;
        }
        console.log(`WebSocket close code details: ${closeCode} - ${codeDescription}`);
        
        // Add network and environment info
        console.log(`Platform: ${Platform.OS}, Version: ${Platform.Version}`);
        console.log(`Connection established? ${this.ws && this.signalerId ? 'Yes' : 'No'}`);
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket ERROR connecting to signaler:', error);
        // Provide more helpful error information
        const errorDetail = error instanceof Error ? error.message : 'Unknown WebSocket error';
        console.error(`WebSocket connection failed: ${errorDetail}`);
        console.error(`Attempted connection to: ${signalingUrl}`);
        
        // If we're in development mode and using a domain, suggest checking if the server is running
        if (__DEV__) {
          console.log('Development mode detected. Make sure:');
          console.log('1. The signaler service is running at the correct URL');
          console.log('2. If using localhost on a mobile device, consider using your machine\'s IP address instead');
          console.log('3. Check for network restrictions or firewall issues');
        }
        
        // Notify that we're disconnected due to error
        if (this.onDisconnected) {
          this.onDisconnected();
        }
      };
      
    } catch (error) {
      console.error('Error in connect:', error);
      // Clean up any partial setup
      this.cleanup();
      
      // Re-throw the error for the caller to handle
      throw error;
    }
  }

  cleanup() {
    // Close and clean up data channel
    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch (e) {
        console.warn('Error closing data channel:', e);
      }
      this.dataChannel = null;
    }
    
    // Close and clean up peer connection
    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch (e) {
        console.warn('Error closing peer connection:', e);
      }
      this.peerConnection = null;
    }
    
    // Close WebSocket
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {
        console.warn('Error closing WebSocket:', e);
      }
      this.ws = null;
    }
    
    // Clear the ping interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    // Reset other state
    this.pendingIceCandidates = [];
    this.signalerId = null;
  }
  
  disconnect() {
    console.log('Disconnecting WebRTC service');
    this.cleanup();
  }

  async createPeerConnection(targetDeviceId: string, isCallee = false) {
    console.log(`Creating peer connection (isCallee: ${isCallee})`);
    
    // Check if WebRTC is supported in this environment
    if (!this.isWebRTCAvailable()) {
      console.warn('WebRTC is not supported in this environment');
      return;
    }
    
    // Ensure we have proper WebRTC implementations
    if (!RTCPeerConnection || RTCPeerConnection.name === 'DummyRTCPeerConnection') {
      console.warn('WebRTC classes not properly initialized');
      return;
    }

    try {
      console.log('Creating new RTCPeerConnection with STUN servers');
      
      // Clean up any existing peer connection first
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
      
      // Log connection state changes
      if (this.peerConnection) {
        // Connection state monitoring
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
        
        // ICE connection state monitoring
        this.peerConnection.oniceconnectionstatechange = () => {
          console.log(`ICE connection state changed: ${this.peerConnection?.iceConnectionState}`);
        };
        
        // ICE gathering state monitoring
        this.peerConnection.onicegatheringstatechange = () => {
          console.log(`ICE gathering state changed: ${this.peerConnection?.iceGatheringState}`);
        };
        
        // Handle ICE candidates
        this.peerConnection.onicecandidate = (event: any) => {
          console.log(`ICE candidate ${event.candidate ? 'generated' : 'generation complete'}`);
          
          if (event.candidate && this.ws) {
            console.log(`Sending ICE candidate to target device: ${targetDeviceId}`);
            const iceMsg = JSON.stringify({
              type: 'ice',
              targetDeviceId,
              ice: event.candidate,
            });
            console.log(`ICE message: ${iceMsg.substring(0, 100)}${iceMsg.length > 100 ? '...' : ''}`);
            
            try {
              this.ws.send(iceMsg);
              console.log('ICE candidate sent successfully');
              this.lastSignalingActivity = Date.now();
            } catch (err) {
              console.error('Failed to send ICE candidate:', err);
            }
          } else if (!event.candidate) {
            console.log('ICE candidate generation complete');
          }
        };
      }
      
      if (!isCallee && this.peerConnection) {
        // As the caller, we create the data channel
        console.log('Creating data channel as caller');
        
        try {
          const dataChannel = this.peerConnection.createDataChannel('data', {
            ordered: true,
            maxRetransmits: 10
          });
          console.log(`Data channel created, initial state: ${dataChannel.readyState}`);
          this.dataChannel = dataChannel;
          
          dataChannel.onopen = () => {
            console.log(`Data channel OPENED (client side), state: ${dataChannel.readyState}`);
            
            // Try a test message to confirm it's working
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
          
          dataChannel.onmessage = (e: any) => {
            console.log(`Received message on data channel (client side): ${typeof e.data === 'string' ? 
              `${e.data.substring(0, 50)}${e.data.length > 50 ? '...' : ''}` : 'binary data'}`);
            this.handleDataChannelMessage(e.data);
          };
        } catch (err) {
          console.error('Failed to create data channel:', err);
        }
      } else if (this.peerConnection) {
        // Handle data channels for callee
        console.log('Setting up ondatachannel handler as callee');
        
        this.peerConnection.ondatachannel = (event: any) => {
          console.log('Data channel received from caller');
          const dataChannel = event.channel;
          console.log(`Received data channel label: ${dataChannel.label}, state: ${dataChannel.readyState}`);
          this.dataChannel = dataChannel;
          
          dataChannel.onopen = () => {
            console.log(`Data channel OPENED (server side), state: ${dataChannel.readyState}`);
            
            // Try a test message to confirm it's working
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
          
          dataChannel.onmessage = (e: any) => {
            console.log(`Received message on data channel (server side): ${typeof e.data === 'string' ? 
              `${e.data.substring(0, 50)}${e.data.length > 50 ? '...' : ''}` : 'binary data'}`);
            this.handleDataChannelMessage(e.data);
          };
        };
      }
      
      // Process any pending ICE candidates that arrived before the peer connection was ready
      if (this.pendingIceCandidates.length > 0) {
        console.log(`Processing ${this.pendingIceCandidates.length} pending ICE candidates`);
        for (const candidate of this.pendingIceCandidates) {
          await this.handleRemoteIce({ ice: candidate });
        }
        this.pendingIceCandidates = []; // Clear the pending candidates
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
    
    if (!this.ws) {
      console.error('Cannot send offer: WebSocket connection not established');
      return;
    }
    
    if (this.ws.readyState !== WebSocket.OPEN) {
      console.error(`Cannot send offer: WebSocket state is ${this.ws.readyState}`);
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
        deviceId: this.userId, // Include our own ID as the source
        offer,
      });
      
      console.log(`Sending offer message to signaler: ${offerMsg.substring(0, 100)}...`);
      this.ws.send(offerMsg);
      console.log('Offer sent successfully');
      this.lastSignalingActivity = Date.now();
    } catch (error) {
      console.error('Error creating and sending offer:', error);
      
      // Log detailed state
      if (this.peerConnection) {
        console.log(`Connection state: ${this.peerConnection.connectionState || 'unknown'}`);
        console.log(`ICE connection state: ${this.peerConnection.iceConnectionState || 'unknown'}`);
        console.log(`Signaling state: ${this.peerConnection.signalingState || 'unknown'}`);
      }
    }
  }

  async handleOffer(msg: any, targetDeviceId: string) {
    console.log('Handling incoming WebRTC offer');
    console.log(`Offer content preview: ${JSON.stringify(msg.offer).substring(0, 100)}...`);
    
    // Create peer connection as callee
    console.log(`Creating peer connection to handle offer for device: ${targetDeviceId}`);
    await this.createPeerConnection(targetDeviceId, true);
    
    if (!this.peerConnection) {
      console.error('Failed to create peer connection for handling offer');
      return;
    }
    
    try {
      console.log('Setting remote description from offer...');
      
      // Handle differences between web and native platforms
      if (Platform.OS === 'web') {
        await this.peerConnection.setRemoteDescription(msg.offer);
      } else {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(msg.offer));
      }
      console.log('Remote description set successfully');
      
      console.log('Creating answer...');
      const answer = await this.peerConnection.createAnswer();
      console.log(`Answer created: ${JSON.stringify(answer).substring(0, 100)}...`);
      
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
        deviceId: this.userId, // Include our own ID as the source
        answer,
      });
      
      console.log(`Sending answer message: ${answerMsg.substring(0, 100)}...`);
      this.ws.send(answerMsg);
      console.log('Answer sent successfully');
      this.lastSignalingActivity = Date.now();
    } catch (error) {
      console.error('Error handling offer:', error);
      
      // Log detailed state
      if (this.peerConnection) {
        console.log(`Connection state: ${this.peerConnection.connectionState || 'unknown'}`);
        console.log(`ICE connection state: ${this.peerConnection.iceConnectionState || 'unknown'}`);
        console.log(`Signaling state: ${this.peerConnection.signalingState || 'unknown'}`);
      }
    }
  }

  async handleAnswer(msg: any) {
    console.log('Handling incoming WebRTC answer');
    console.log(`Answer content preview: ${JSON.stringify(msg.answer).substring(0, 100)}...`);
    
    if (!this.peerConnection) {
      console.error('Cannot handle answer: peer connection not initialized');
      return;
    }
    
    try {
      console.log('Setting remote description from answer...');
      
      // Handle differences between web and native platforms
      if (Platform.OS === 'web') {
        await this.peerConnection.setRemoteDescription(msg.answer);
      } else {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(msg.answer));
      }
      
      console.log('Remote description set successfully');
      console.log(`Current signaling state: ${this.peerConnection.signalingState}`);
    } catch (error) {
      console.error('Error handling answer:', error);
      
      // Log detailed state
      if (this.peerConnection) {
        console.log(`Connection state: ${this.peerConnection.connectionState || 'unknown'}`);
        console.log(`ICE connection state: ${this.peerConnection.iceConnectionState || 'unknown'}`);
        console.log(`Signaling state: ${this.peerConnection.signalingState || 'unknown'}`);
      }
    }
  }

  async handleRemoteIce(msg: any) {
    if (!this.peerConnection) {
      console.warn('Cannot handle ICE candidate: peer connection not initialized');
      // Store the candidate to process later when peer connection is ready
      this.pendingIceCandidates.push(msg.ice);
      console.log(`Saved ICE candidate for later processing. Total pending: ${this.pendingIceCandidates.length}`);
      return;
    }
    
    if (!msg.ice) {
      console.error('Received ICE message without candidate');
      return;
    }
    
    try {
      console.log(`Adding remote ICE candidate: ${JSON.stringify(msg.ice).substring(0, 100)}...`);
      
      // Handle differences between web and native platforms
      if (Platform.OS === 'web') {
        await this.peerConnection.addIceCandidate(msg.ice);
      } else {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(msg.ice));
      }
      
      console.log('Remote ICE candidate added successfully');
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
      
      // Log detailed state
      if (this.peerConnection) {
        console.log(`Connection state: ${this.peerConnection.connectionState || 'unknown'}`);
        console.log(`ICE connection state: ${this.peerConnection.iceConnectionState || 'unknown'}`);
        console.log(`ICE gathering state: ${this.peerConnection.iceGatheringState || 'unknown'}`);
        console.log(`Signaling state: ${this.peerConnection.signalingState || 'unknown'}`);
      }
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
        
        // Check if peer connection is in a valid state
        if (this.peerConnection.connectionState === 'failed' || 
            this.peerConnection.connectionState === 'closed' ||
            this.peerConnection.connectionState === 'disconnected') {
          const error = new Error(`Peer connection state is ${this.peerConnection.connectionState}. Please reconnect.`);
          console.error(error.message);
          return reject(error);
        }
        
        // Skip if data channel is not open
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
        console.log(`Request details: ${JSON.stringify(message).substring(0, 150)}...`);
        
        // Set timeout for the response (30 seconds)
        const timeout = setTimeout(() => {
          const error = new Error(`Request ${requestId} to ${endpoint} timed out after 30 seconds`);
          console.error(error.message);
          this.removeResponseHandler(requestId);
          reject(error);
        }, 30000);
        
        // Set handler for response
        this.setResponseHandler(requestId, (response: any) => {
          console.log(`Received response for request ${requestId} to ${endpoint}`);
          clearTimeout(timeout);
          resolve(response);
        });
        
        // Send message
        try {
          this.dataChannel.send(JSON.stringify(message));
          console.log(`Request ${requestId} to ${endpoint} sent successfully via data channel`);
        } catch (error) {
          console.error(`Failed to send request ${requestId} to ${endpoint}:`, error);
          clearTimeout(timeout);
          this.removeResponseHandler(requestId);
          reject(error);
        }
      } catch (unexpectedError) {
        console.error('Unexpected error in sendRequest:', unexpectedError);
        reject(new Error(`Unexpected error in WebRTC sendRequest: ${unexpectedError instanceof Error ? unexpectedError.message : String(unexpectedError)}`));
      }
    });
  }

  // Handle responses to specific requests
  private responseHandlers: Record<string, (response: any) => void> = {};
  
  private setResponseHandler(requestId: string, handler: (response: any) => void) {
    this.responseHandlers[requestId] = handler;
  }
  
  private removeResponseHandler(requestId: string) {
    delete this.responseHandlers[requestId];
  }
  
  /**
   * Get detailed status of the WebRTC connection
   */
  getConnectionStatus() {
    // Check WebSocket connection
    const wsConnected = this.ws?.readyState === WebSocket.OPEN;
    
    // Check peer connection status
    const peerConnectionState = this.peerConnection?.connectionState || 'new';
    const iceConnectionState = this.peerConnection?.iceConnectionState || 'new';
    
    // Check data channel
    const dataChannelState = this.dataChannel?.readyState || 'closed';
    
    // Overall connection status
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
  
  /**
   * Generate a human-readable connection diagnostic report
   */
  generateConnectionReport() {
    try {
      const status = this.getConnectionStatus();
      const now = Date.now();
      
      let report = `=== WebRTC CONNECTION DIAGNOSTIC REPORT ===\n`;
      report += `Time: ${new Date().toLocaleTimeString()}\n`;
      report += `Connection started: ${new Date(this.connectionStartTime).toLocaleTimeString()} (${Math.round((now - this.connectionStartTime)/1000)}s ago)\n\n`;
      
      // Overall status
      report += `CONNECTION STATUS: ${status.isConnected ? 'CONNECTED ✓' : 'DISCONNECTED ✗'}\n\n`;
      
      // WebSocket connection
      report += `WebSocket: ${status.wsConnected ? 'Connected ✓' : 'Disconnected ✗'}\n`;
      report += `Last signaling activity: ${Math.round((now - status.lastSignalingActivity)/1000)}s ago\n\n`;
      
      // Peer connection
      report += `Peer Connection State: ${status.peerConnectionState}\n`;
      report += `ICE Connection State: ${status.iceConnectionState}\n`;
      
      // Data channel
      report += `Data Channel State: ${status.dataChannelState}\n\n`;
      
      // Connected device info
      report += `Target Device ID: ${this.deviceId || 'Not set'}\n`;
      report += `User ID: ${this.userId || 'Not set'}\n`;
      report += `Signaler ID: ${this.signalerId || 'Not assigned'}\n\n`;
      
      // Troubleshooting suggestions
      report += `=== TROUBLESHOOTING SUGGESTIONS ===\n`;
      if (!status.wsConnected) {
        report += `• WebSocket connection failed. Check if the signaler service is running.\n`;
        report += `• Check network connectivity and firewall settings.\n`;
        report += `• If using localhost, ensure the server is accessible from your device.\n`;
      } 
      else if (status.peerConnectionState !== 'connected') {
        report += `• WebRTC peer connection failed to establish.\n`;
        report += `• Check if the target device is online and connected to the signaler.\n`;
        report += `• NAT traversal might be failing - check network and firewall settings.\n`;
        report += `• Try restarting the connection or using a different network.\n`;
      } 
      else if (status.dataChannelState !== 'open') {
        report += `• WebRTC connection established but data channel is not open.\n`;
        report += `• This is unusual - try restarting the connection.\n`;
      }
      
      return report;
    } catch (e) {
      return `Error generating report: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
}

// Export a singleton instance of the WebRTCService
export const webrtcService = new WebRTCService();
