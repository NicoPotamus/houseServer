import React, { useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Pressable, Modal, TextInput, Button, Alert } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/context/AuthContext';
import { useDevice } from '@/context/DeviceContext';
import { NetworkInfo } from 'react-native-network-info';
import { API_BASE_URL } from '../../config/api';
import { webrtcService } from '@/services/webrtcService';

export default function DevicesScreen() {
  const [deviceIp, setDeviceIp] = useState('');
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [connections, setConnections] = useState([]); // Store device connections
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  const { setDevice } = useDevice();

  // Fetch all device connections for this user on mount
  React.useEffect(() => {
    const fetchConnections = async () => {
      if (!user) return;
      try {
        const res = await fetch(`${API_BASE_URL}/userDevices?userId=${user.id}`);
        if (res.ok) {
          const data = await res.json();
          setConnections(data);
        }
      } catch {}
    };
    fetchConnections();
  }, [user]);

  // Add device logic
  const handleAddDevice = () => {
    setAddModalVisible(true);
  };

  // Helper to get device IP and prefill the modal
  const handlePrefillDeviceIp = async () => {
    try {
      const ip = await NetworkInfo.getIPV4Address();
      setDeviceIp(ip || '');
      setAddModalVisible(true);
    } catch (e) {
      Alert.alert('Error', 'Could not get device IP');
      setAddModalVisible(true);
    }
  };

  const handlePairDevice = async () => {
    if (!deviceIp || !user) return;
    setPairing(true);
    try {
      // 1. Fetch deviceId from the device's onboarding API
      const res = await fetch(`http://${deviceIp}:4000/device-id`);
      if (!res.ok) throw new Error('Could not reach device');
      const { signalerId } = await res.json();
      if (!signalerId) throw new Error('No deviceId found');
      // 2. Pair device with the user account via new endpoint (POST /pairDeviceById)
      const pairRes = await fetch(`${API_BASE_URL}/pairDeviceById`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, deviceId: signalerId }),
      });
      if (!pairRes.ok) throw new Error('Pairing failed');
      // 3. Fetch all device connections for this user
      const connectionsRes = await fetch(`${API_BASE_URL}/userDevices?userId=${user.id}`);
      if (!connectionsRes.ok) throw new Error('Failed to fetch device connections');
      const connections = await connectionsRes.json();
      setConnections(connections); // Update state
      Alert.alert('Success', `Device paired! Connections: ${JSON.stringify(connections)}`);
      setAddModalVisible(false);
      setDeviceIp('');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to pair device');
    } finally {
      setPairing(false);
    }
  };

  const handleSelectDevice = (deviceId: string) => {
    setDevice(deviceId);
  };

  const handleConnectToDevice = async (deviceId: string) => {
    try {
      const SIGNALER_WS_URL = `${API_BASE_URL.replace('http', 'ws')}`;
      if (!user) throw new Error('User not logged in');
      webrtcService.connect(SIGNALER_WS_URL, deviceId, String(user.id));
      Alert.alert('Connecting', `Attempting WebRTC connection to device: ${deviceId}`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to connect to device');
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">My Devices</ThemedText>
        <Pressable onPress={handlePrefillDeviceIp} style={styles.addButton}>
          <IconSymbol name="paperplane.fill" size={28} color={Colors[colorScheme ?? 'light'].tint} />
        </Pressable>
      </View>
      {/* Show device connections */}
      <View style={{padding: 16}}>
        {connections.length === 0 ? (
          <ThemedText style={styles.emptyText}>No devices paired yet.</ThemedText>
        ) : (
          connections.map((conn: any) => (
            <Pressable key={conn.device_id} onPress={() => handleConnectToDevice(conn.device_id)} style={{padding: 8, borderBottomWidth: 1, borderColor: '#eee'}}>
              <ThemedText>Device ID: {conn.device_id}</ThemedText>
              <ThemedText>Status: {conn.status || 'unknown'}</ThemedText>
              <ThemedText>Last Seen: {conn.last_seen}</ThemedText>
            </Pressable>
          ))
        )}
      </View>
      {/* ...existing code... */}
      <Modal visible={addModalVisible} animationType="slide" transparent onRequestClose={() => setAddModalVisible(false)}>
        <View style={{ flex:1, justifyContent:'center', alignItems:'center', backgroundColor:'rgba(0,0,0,0.3)' }}>
          <View style={{ backgroundColor:'#fff', padding:24, borderRadius:12, width:300 }}>
            <ThemedText type="title">Add Device</ThemedText>
            <TextInput
              placeholder="Device IP (e.g. 192.168.1.100)"
              value={deviceIp}
              onChangeText={setDeviceIp}
              style={{ borderWidth:1, borderColor:'#ccc', borderRadius:8, padding:10, marginTop:16, marginBottom:16 }}
              autoCapitalize="none"
              keyboardType="numbers-and-punctuation"
            />
            <Button title={pairing ? 'Pairing...' : 'Pair Device'} onPress={handlePairDevice} disabled={pairing || !deviceIp} />
            <Button title="Cancel" onPress={() => setAddModalVisible(false)} disabled={pairing} />
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  addButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  errorText: {
    color: Colors.light.error,
    textAlign: 'center',
    marginTop: 32,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 32,
    color: '#888',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
