import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Button, ScrollView, Alert } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { webrtcService, isWebRTCSupported } from '@/services/webrtcService';
import { getSignalerUrl } from '@/config/api';

export default function WebRTCTestScreen() {
  const [status, setStatus] = useState('Disconnected');
  const [logs, setLogs] = useState<string[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev.slice(-50), `[${timestamp}] ${message}`]);
  };

  const webrtcStatus = webrtcService.getWebRTCStatus();

  useEffect(() => {
    // Set up WebRTC service callbacks
    webrtcService.onConnected = () => {
      setStatus('Connected');
      addLog('✅ WebRTC connection established');
    };

    webrtcService.onDisconnected = () => {
      setStatus('Disconnected');
      addLog('❌ WebRTC connection lost');
    };

    webrtcService.onData = (data) => {
      addLog(`📨 Received data: ${JSON.stringify(data).substring(0, 100)}`);
    };

    return () => {
      webrtcService.cleanup();
    };
  }, []);

  const handleConnect = async () => {
    if (!isWebRTCSupported()) {
      Alert.alert('WebRTC Not Available', webrtcStatus.message + '\n\n' + (webrtcStatus.instructions || ''));
      return;
    }

    setIsConnecting(true);
    addLog('🔄 Starting WebRTC connection test...');

    try {
      const signalerUrl = getSignalerUrl();
      addLog(`📡 Signaler URL: ${signalerUrl}`);
      
      // Use a test device ID for now
      const testDeviceId = 'test-server-device';
      const testUserId = 'test-user-123';
      
      addLog(`🎯 Target device: ${testDeviceId}`);
      addLog(`👤 User ID: ${testUserId}`);
      
      webrtcService.connect(signalerUrl, testDeviceId, testUserId);
      setStatus('Connecting...');
      
    } catch (error) {
      addLog(`❌ Connection failed: ${error}`);
      setStatus('Failed');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    addLog('🔌 Disconnecting...');
    webrtcService.cleanup();
    setStatus('Disconnected');
  };

  const handleSendTestData = () => {
    if (status !== 'Connected') {
      Alert.alert('Not Connected', 'Please establish a WebRTC connection first');
      return;
    }

    const testData = {
      type: 'test',
      message: 'Hello from WebRTC client!',
      timestamp: Date.now()
    };

    addLog(`📤 Sending test data: ${JSON.stringify(testData)}`);
    
    try {
      webrtcService.sendRequest('/api/test', 'POST', testData)
        .then(response => {
          addLog(`📥 Response: ${JSON.stringify(response)}`);
        })
        .catch(error => {
          addLog(`❌ Request failed: ${error}`);
        });
    } catch (error) {
      addLog(`❌ Send failed: ${error}`);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>WebRTC Test</ThemedText>
      
      {/* WebRTC Status */}
      <View style={styles.statusContainer}>
        <ThemedText type="subtitle">WebRTC Support:</ThemedText>
        <ThemedText style={[
          styles.statusText, 
          { color: webrtcStatus.available ? '#10B981' : '#EF4444' }
        ]}>
          {webrtcStatus.message}
        </ThemedText>
        {webrtcStatus.instructions && (
          <ThemedText style={styles.instructionsText}>
            {webrtcStatus.instructions}
          </ThemedText>
        )}
      </View>

      {/* Connection Status */}
      <View style={styles.statusContainer}>
        <ThemedText type="subtitle">Connection Status:</ThemedText>
        <ThemedText style={[
          styles.statusText,
          { color: status === 'Connected' ? '#10B981' : status === 'Failed' ? '#EF4444' : '#6B7280' }
        ]}>
          {status}
        </ThemedText>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <Button 
          title={isConnecting ? "Connecting..." : "Connect to Server"} 
          onPress={handleConnect}
          disabled={isConnecting || !webrtcStatus.available}
        />
        <Button 
          title="Disconnect" 
          onPress={handleDisconnect}
          disabled={status === 'Disconnected'}
        />
        <Button 
          title="Send Test Data" 
          onPress={handleSendTestData}
          disabled={status !== 'Connected'}
        />
        <Button title="Clear Logs" onPress={clearLogs} />
      </View>

      {/* Logs */}
      <View style={styles.logsContainer}>
        <ThemedText type="subtitle">Logs:</ThemedText>
        <ScrollView style={styles.logsScroll}>
          {logs.map((log, index) => (
            <ThemedText key={index} style={styles.logText}>
              {log}
            </ThemedText>
          ))}
          {logs.length === 0 && (
            <ThemedText style={styles.emptyText}>No logs yet...</ThemedText>
          )}
        </ScrollView>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    textAlign: 'center',
    marginBottom: 24,
  },
  statusContainer: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  instructionsText: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 4,
  },
  controls: {
    gap: 8,
    marginBottom: 16,
  },
  logsContainer: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
  },
  logsScroll: {
    flex: 1,
    marginTop: 8,
  },
  logText: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.5,
    fontStyle: 'italic',
  },
});
