import React, { useState } from 'react';
import { View, TextInput, Button, StyleSheet, Text, ActivityIndicator, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function AuthScreen() {
  const { login, register, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    const ok = isRegister
      ? await register(email.trim(), password)
      : await login(email.trim(), password);
    setSubmitting(false);
    if (!ok) {
      Alert.alert('Error', isRegister ? 'Registration failed' : 'Login failed');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{isRegister ? 'Create Account' : 'Login'}</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Button
        title={isRegister ? 'Register' : 'Login'}
        onPress={handleSubmit}
        disabled={submitting || loading}
      />
      <Button
        title={isRegister ? 'Already have an account? Login' : "Don't have an account? Register"}
        onPress={() => setIsRegister(v => !v)}
        disabled={submitting || loading}
      />
      {(submitting || loading) && <ActivityIndicator style={{ marginTop: 16 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    marginBottom: 24,
    fontWeight: 'bold',
  },
  input: {
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
});
