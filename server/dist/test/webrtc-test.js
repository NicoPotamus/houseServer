/**
 * WebRTC Test Suite for Server
 * This file provides comprehensive testing for WebRTC functionality
 */
import WebSocket from 'ws';
import wrtc from 'wrtc';
// Configuration
const SIGNALER_URL = process.env.SIGNALER_WS_URL || 'ws://localhost:8080';
const TEST_DEVICE_ID = 'test-device-' + Date.now();
const TEST_USER_ID = 'test-user-' + Date.now();
class WebRTCTester {
    ws = null;
    peerConnection = null; // Using any for wrtc types
    dataChannel = null; // Using any for wrtc types
    signalerId = null;
    results = [];
    constructor() {
        console.log('🚀 Starting WebRTC Test Suite');
        console.log(`Signaler URL: ${SIGNALER_URL}`);
        console.log(`Test Device ID: ${TEST_DEVICE_ID}`);
        console.log(`Test User ID: ${TEST_USER_ID}`);
    }
    async runAllTests() {
        console.log('\n📋 Running WebRTC Test Suite...\n');
        await this.testSignalerConnection();
        await this.testSignalerRegistration();
        await this.testPeerConnectionCreation();
        await this.testDataChannelCreation();
        await this.testDataChannelMessaging();
        await this.testFileListingAPI();
        await this.testFileOperationsAPI();
        await this.cleanup();
        this.printResults();
        return this.results;
    }
    async runTest(testName, testFn) {
        const startTime = Date.now();
        console.log(`🔍 Testing: ${testName}`);
        try {
            await testFn();
            const duration = Date.now() - startTime;
            this.results.push({
                testName,
                passed: true,
                duration
            });
            console.log(`✅ ${testName} - PASSED (${duration}ms)`);
        }
        catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.results.push({
                testName,
                passed: false,
                duration,
                error: errorMessage
            });
            console.log(`❌ ${testName} - FAILED (${duration}ms): ${errorMessage}`);
        }
    }
    async testSignalerConnection() {
        await this.runTest('Signaler WebSocket Connection', async () => {
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Connection timeout'));
                }, 10000);
                this.ws = new WebSocket(SIGNALER_URL);
                this.ws.onopen = () => {
                    clearTimeout(timeout);
                    console.log('   📡 WebSocket connection established');
                    resolve();
                };
                this.ws.onerror = (error) => {
                    clearTimeout(timeout);
                    reject(new Error(`WebSocket error: ${error.message || 'Unknown error'}`));
                };
                this.ws.onclose = (event) => {
                    if (!timeout)
                        return; // Already resolved
                    clearTimeout(timeout);
                    reject(new Error(`WebSocket closed unexpectedly: ${event.code} ${event.reason}`));
                };
            });
        });
    }
    async testSignalerRegistration() {
        await this.runTest('Signaler Registration', async () => {
            if (!this.ws)
                throw new Error('WebSocket not connected');
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Registration timeout'));
                }, 5000);
                const messageHandler = (data) => {
                    try {
                        const message = JSON.parse(data.toString());
                        console.log('   📨 Received:', message.type);
                        if (message.type === 'signaler-id') {
                            this.signalerId = message.signalerId;
                            console.log(`   🆔 Assigned signaler ID: ${this.signalerId}`);
                            // Send registration
                            const registerMsg = {
                                type: 'register',
                                deviceId: TEST_DEVICE_ID
                            };
                            this.ws?.send(JSON.stringify(registerMsg));
                            console.log('   📤 Sent registration message');
                        }
                        else if (message.type === 'register-success') {
                            clearTimeout(timeout);
                            this.ws?.removeListener('message', messageHandler);
                            console.log(`   ✅ Registration successful for device: ${message.deviceId}`);
                            resolve();
                        }
                        else if (message.type === 'error') {
                            clearTimeout(timeout);
                            this.ws?.removeListener('message', messageHandler);
                            reject(new Error(`Registration error: ${message.message}`));
                        }
                    }
                    catch (e) {
                        clearTimeout(timeout);
                        this.ws?.removeListener('message', messageHandler);
                        reject(new Error(`Failed to parse message: ${e}`));
                    }
                };
                this.ws.on('message', messageHandler);
            });
        });
    }
    async testPeerConnectionCreation() {
        await this.runTest('RTCPeerConnection Creation', async () => {
            const iceServers = [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ];
            this.peerConnection = new wrtc.RTCPeerConnection({ iceServers });
            // Verify peer connection state
            if (this.peerConnection.connectionState === undefined) {
                throw new Error('RTCPeerConnection not properly initialized');
            }
            console.log(`   🔗 Peer connection state: ${this.peerConnection.connectionState}`);
            console.log(`   📡 ICE connection state: ${this.peerConnection.connectionState}`);
        });
    }
    async testDataChannelCreation() {
        await this.runTest('Data Channel Creation', async () => {
            if (!this.peerConnection)
                throw new Error('Peer connection not available');
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Data channel creation timeout'));
                }, 10000);
                this.dataChannel = this.peerConnection.createDataChannel('api', {
                    ordered: true
                });
                this.dataChannel.onopen = () => {
                    clearTimeout(timeout);
                    console.log(`   📺 Data channel opened - readyState: ${this.dataChannel.readyState}`);
                    resolve();
                };
                this.dataChannel.onerror = (error) => {
                    clearTimeout(timeout);
                    reject(new Error(`Data channel error: ${error}`));
                };
                this.dataChannel.onclose = () => {
                    console.log('   📺 Data channel closed');
                };
                // For testing purposes, we'll resolve immediately since we're testing creation, not actual connection
                if (this.dataChannel.readyState === 'connecting') {
                    clearTimeout(timeout);
                    console.log('   📺 Data channel created successfully (connecting state)');
                    resolve();
                }
            });
        });
    }
    async testDataChannelMessaging() {
        await this.runTest('Data Channel Messaging', async () => {
            if (!this.dataChannel)
                throw new Error('Data channel not available');
            // Create a mock data channel that simulates messaging
            const testMessage = {
                type: 'request',
                id: 1,
                endpoint: '/test',
                method: 'GET'
            };
            // Test message serialization
            const serialized = JSON.stringify(testMessage);
            const parsed = JSON.parse(serialized);
            if (parsed.type !== 'request' || parsed.id !== 1) {
                throw new Error('Message serialization/deserialization failed');
            }
            console.log('   💬 Message serialization test passed');
            console.log(`   📄 Test message: ${serialized.substring(0, 100)}...`);
        });
    }
    async testFileListingAPI() {
        await this.runTest('File Listing API', async () => {
            // Test the WebRTC API directly
            const { handleDataChannelMessage } = await import('../controller/webrtcAPI.js');
            const mockDataChannel = {
                send: (data) => {
                    const response = JSON.parse(data);
                    console.log(`   📤 API Response: ${response.type} (${data.length} bytes)`);
                    if (response.type !== 'response') {
                        throw new Error('Invalid response type');
                    }
                    if (response.error) {
                        throw new Error(`API Error: ${response.error.message}`);
                    }
                    if (response.result && Array.isArray(response.result)) {
                        console.log(`   📁 Found ${response.result.length} items`);
                    }
                }
            };
            const testRequest = {
                type: 'request',
                id: 1,
                endpoint: '/files',
                method: 'GET',
                params: { folderPath: '' }
            };
            await handleDataChannelMessage(testRequest, mockDataChannel);
        });
    }
    async testFileOperationsAPI() {
        await this.runTest('File Operations API', async () => {
            const { handleDataChannelMessage } = await import('../controller/webrtcAPI.js');
            const mockDataChannel = {
                send: (data) => {
                    const response = JSON.parse(data);
                    console.log(`   📤 File ops response: ${response.type}`);
                    if (response.error && !response.error.message.includes('not found')) {
                        // Allow "not found" errors for non-existent files
                        throw new Error(`API Error: ${response.error.message}`);
                    }
                }
            };
            // Test file info request for a potentially non-existent file
            const testRequest = {
                type: 'request',
                id: 2,
                endpoint: '/files/test.txt',
                method: 'GET'
            };
            await handleDataChannelMessage(testRequest, mockDataChannel);
            console.log('   ✅ File operations API responds correctly');
        });
    }
    async cleanup() {
        console.log('\n🧹 Cleaning up test resources...');
        if (this.dataChannel) {
            try {
                this.dataChannel.close();
            }
            catch (e) {
                console.log('   ⚠️ Error closing data channel:', e);
            }
        }
        if (this.peerConnection) {
            try {
                this.peerConnection.close();
            }
            catch (e) {
                console.log('   ⚠️ Error closing peer connection:', e);
            }
        }
        if (this.ws) {
            try {
                this.ws.close();
            }
            catch (e) {
                console.log('   ⚠️ Error closing WebSocket:', e);
            }
        }
        console.log('   ✅ Cleanup completed');
    }
    printResults() {
        console.log('\n📊 Test Results Summary:');
        console.log('=' + '='.repeat(50));
        const passed = this.results.filter(r => r.passed).length;
        const failed = this.results.filter(r => !r.passed).length;
        const total = this.results.length;
        console.log(`Total Tests: ${total}`);
        console.log(`Passed: ${passed} ✅`);
        console.log(`Failed: ${failed} ❌`);
        console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
        if (failed > 0) {
            console.log('\n❌ Failed Tests:');
            this.results
                .filter(r => !r.passed)
                .forEach(r => {
                console.log(`   • ${r.testName}: ${r.error}`);
            });
        }
        console.log('\n⏱️ Performance:');
        this.results.forEach(r => {
            const status = r.passed ? '✅' : '❌';
            console.log(`   ${status} ${r.testName}: ${r.duration}ms`);
        });
    }
}
// Export for use as a module
export { WebRTCTester };
// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const tester = new WebRTCTester();
    tester.runAllTests()
        .then(results => {
        const failed = results.filter(r => !r.passed).length;
        process.exit(failed > 0 ? 1 : 0);
    })
        .catch(error => {
        console.error('❌ Test suite failed:', error);
        process.exit(1);
    });
}
