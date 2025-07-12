// Simple WebSocket connection test
const WebSocket = require('ws');

console.log('Testing WebSocket connection to signaler...');

const ws = new WebSocket('ws://localhost:8080');

ws.on('open', function open() {
  console.log('✅ Connected to signaler');
  
  // Send a test message
  const testMessage = {
    type: 'register',
    deviceId: 'test-device-123'
  };
  
  console.log('Sending test message:', testMessage);
  ws.send(JSON.stringify(testMessage));
});

ws.on('message', function message(data) {
  console.log('📨 Received:', JSON.parse(data.toString()));
});

ws.on('close', function close(code, reason) {
  console.log('❌ Connection closed');
  console.log('Close code:', code);
  console.log('Close reason:', reason.toString());
  
  if (code === 1006) {
    console.log('Code 1006 indicates abnormal closure - connection lost unexpectedly');
  }
});

ws.on('error', function error(err) {
  console.log('🚨 WebSocket error:', err);
});

// Keep the process alive for a bit
setTimeout(() => {
  console.log('Closing connection...');
  ws.close();
  process.exit(0);
}, 5000);
