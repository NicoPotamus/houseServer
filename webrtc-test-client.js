const WebSocket = require('ws');
const wrtc = require('wrtc');

class WebRTCTestClient {
    constructor() {
        this.ws = null;
        this.pc = null;
        this.dataChannel = null;
        this.serverDeviceId = '16255138-096d-4319-885f-16ee20341de8'; // From your device.json
        this.clientId = `test-client-${Date.now()}`;
        this.pendingRequests = new Map();
    }

    async start() {
        console.log('🚀 Starting WebRTC Test Client');
        console.log(`📱 Client ID: ${this.clientId}`);
        console.log(`🎯 Target Server: ${this.serverDeviceId}`);
        
        await this.connectToSignaler();
    }

    async connectToSignaler() {
        console.log('\n📡 Connecting to signaler...');
        
        this.ws = new WebSocket('ws://localhost:8080');
        
        this.ws.on('open', () => {
            console.log('✅ Connected to signaler');
            
            // Register our client
            this.ws.send(JSON.stringify({
                type: 'register',
                deviceId: this.clientId
            }));
            
            console.log(`📝 Registered as: ${this.clientId}`);
        });

        this.ws.on('message', async (data) => {
            const msg = JSON.parse(data.toString());
            console.log('📨 Signaler message:', msg.type);
            
            switch (msg.type) {
                case 'signaler-id':
                    console.log(`🆔 Got signaler ID: ${msg.signalerId}`);
                    // Wait a moment then initiate WebRTC connection
                    setTimeout(() => this.initiateWebRTCConnection(), 2000);
                    break;
                    
                case 'answer':
                    await this.handleAnswer(msg);
                    break;
                    
                case 'ice':
                    await this.handleIceCandidate(msg);
                    break;
                    
                default:
                    console.log('📋 Other message:', msg);
            }
        });

        this.ws.on('close', () => {
            console.log('❌ Signaler connection closed');
        });

        this.ws.on('error', (error) => {
            console.error('💥 Signaler error:', error);
        });
    }

    async initiateWebRTCConnection() {
        console.log('\n🔗 Creating WebRTC peer connection...');
        
        this.pc = new wrtc.RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        });

        // Create data channel for API communication
        this.dataChannel = this.pc.createDataChannel('data', {
            ordered: true
        });

        this.setupDataChannel();
        this.setupPeerConnectionEvents();

        // Create offer
        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);

        console.log('📤 Sending offer to server...');
        this.ws.send(JSON.stringify({
            type: 'offer',
            targetDeviceId: this.serverDeviceId,
            deviceId: this.clientId,
            offer: offer
        }));
    }

    setupDataChannel() {
        this.dataChannel.onopen = () => {
            console.log('🎉 Data channel opened! Ready for API testing');
            
            // Start testing APIs
            setTimeout(() => this.runAPITests(), 1000);
        };

        this.dataChannel.onclose = () => {
            console.log('📪 Data channel closed');
        };

        this.dataChannel.onmessage = (event) => {
            try {
                const response = JSON.parse(event.data);
                this.handleAPIResponse(response);
            } catch (error) {
                console.log('📨 Raw message:', event.data);
            }
        };

        this.dataChannel.onerror = (error) => {
            console.error('💥 Data channel error:', error);
        };
    }

    setupPeerConnectionEvents() {
        this.pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.ws.send(JSON.stringify({
                    type: 'ice',
                    targetDeviceId: this.serverDeviceId,
                    ice: event.candidate
                }));
            }
        };

        this.pc.onconnectionstatechange = () => {
            console.log(`🔗 Connection state: ${this.pc.connectionState}`);
        };

        this.pc.oniceconnectionstatechange = () => {
            console.log(`🧊 ICE connection state: ${this.pc.iceConnectionState}`);
        };
    }

    async handleAnswer(msg) {
        console.log('📥 Received answer from server');
        await this.pc.setRemoteDescription(msg.answer);
    }

    async handleIceCandidate(msg) {
        if (msg.ice) {
            await this.pc.addIceCandidate(new wrtc.RTCIceCandidate(msg.ice));
        }
    }

    sendAPIRequest(method, url, body = null) {
        const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const request = {
            type: 'request',
            id: requestId,
            method: method,
            url: url,
            headers: {},
            body: body
        };

        console.log(`🚀 API ${method} ${url} (ID: ${requestId})`);
        
        // Store request for response tracking
        this.pendingRequests.set(requestId, {
            method,
            url,
            timestamp: Date.now()
        });

        this.dataChannel.send(JSON.stringify(request));
        
        return requestId;
    }

    handleAPIResponse(response) {
        if (response.type === 'response' && response.id) {
            const request = this.pendingRequests.get(response.id);
            if (request) {
                const duration = Date.now() - request.timestamp;
                
                if (response.error) {
                    console.log(`❌ ${request.method} ${request.url} - Error: ${response.error.message} (${duration}ms)`);
                } else {
                    console.log(`✅ ${request.method} ${request.url} - Success (${duration}ms)`);
                    if (response.body) {
                        try {
                            const data = JSON.parse(response.body);
                            console.log(`📋 Response data:`, data);
                        } catch (e) {
                            console.log(`📋 Response:`, response.body.substring(0, 100) + '...');
                        }
                    }
                }
                
                this.pendingRequests.delete(response.id);
            }
        } else if (response.type === 'system') {
            console.log(`🔧 System message: ${response.message}`);
        } else {
            console.log('📨 Other response:', response);
        }
    }

    async runAPITests() {
        console.log('\n🧪 Starting API Tests...\n');

        // Test 1: Health check
        console.log('Test 1: Health Check');
        this.sendAPIRequest('GET', '/health');

        // Test 2: Device ID
        setTimeout(() => {
            console.log('\nTest 2: Device ID');
            this.sendAPIRequest('GET', '/device-id');
        }, 1000);

        // Test 3: File listing
        setTimeout(() => {
            console.log('\nTest 3: File Listing');
            this.sendAPIRequest('GET', '/files');
        }, 2000);

        // Test 4: Non-existent file (should return 404)
        setTimeout(() => {
            console.log('\nTest 4: Non-existent File');
            this.sendAPIRequest('GET', '/files/view/nonexistent.txt');
        }, 3000);

        // Test 5: Performance test - multiple requests
        setTimeout(() => {
            console.log('\nTest 5: Performance Test (10 requests)');
            for (let i = 0; i < 10; i++) {
                setTimeout(() => {
                    this.sendAPIRequest('GET', '/health');
                }, i * 100);
            }
        }, 4000);

        // Summary after all tests
        setTimeout(() => {
            console.log('\n📊 Test Summary');
            console.log(`Pending requests: ${this.pendingRequests.size}`);
            if (this.pendingRequests.size > 0) {
                console.log('⏳ Waiting for responses...');
                setTimeout(() => this.printFinalSummary(), 5000);
            } else {
                this.printFinalSummary();
            }
        }, 8000);
    }

    printFinalSummary() {
        console.log('\n🎯 Test Complete!');
        console.log(`📱 Client: ${this.clientId}`);
        console.log(`🎯 Server: ${this.serverDeviceId}`);
        console.log(`🔗 Connection: ${this.pc?.connectionState || 'unknown'}`);
        console.log(`📡 Data Channel: ${this.dataChannel?.readyState || 'unknown'}`);
        
        if (this.pendingRequests.size > 0) {
            console.log(`⚠️ ${this.pendingRequests.size} requests still pending`);
        }
        
        console.log('\n✨ WebRTC API testing completed!');
    }
}

// Run the test
const client = new WebRTCTestClient();
client.start().catch(console.error);

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down test client...');
    process.exit(0);
});
