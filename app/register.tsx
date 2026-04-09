/**
 * app/register.tsx — Pantalla de registro de cuenta
 */

import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuthStore } from '../src/store/useAuthStore';

export default function RegisterScreen() {
  const register   = useAuthStore(s => s.register);
  const loading    = useAuthStore(s => s.loading);
  const error      = useAuthStore(s => s.error);
  const clearError = useAuthStore(s => s.clearError);

  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [localErr, setLocalErr] = useState<string | null>(null);

  // Token set → AuthGuard in _layout.tsx will redirect to /(tabs) automatically
  // No manual router.replace needed here

  const handleRegister = async () => {
    setLocalErr(null);
    if (!email.trim() || !password.trim()) { setLocalErr('El correo y la contraseña son obligatorios'); return; }
    if (password !== confirm) { setLocalErr('Las contraseñas no coinciden'); return; }
    if (password.length < 6) { setLocalErr('La contraseña debe tener al menos 6 caracteres'); return; }
    await register({ email: email.trim(), password, name: name.trim() || undefined });
  };

  const displayError = localErr ?? error;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          {/* Logo / title */}
          <Text style={styles.logo}>lumina</Text>
          <Text style={styles.subtitle}>Crear cuenta nueva</Text>

          {/* Error banner */}
          {displayError && (
            <TouchableOpacity style={styles.errorBanner} onPress={() => { setLocalErr(null); clearError(); }}>
              <Text style={styles.errorText}>{displayError}</Text>
              <Text style={styles.errorDismiss}>✕</Text>
            </TouchableOpacity>
          )}

          {/* Name (optional) */}
          <Text style={styles.label}>Nombre  <Text style={styles.optional}>(opcional)</Text></Text>
          <TextInput
            style={styles.input}
            placeholder="Juan Pérez"
            placeholderTextColor="#303050"
            textContentType="name"
            value={name}
            onChangeText={setName}
          />

          {/* Email */}
          <Text style={styles.label}>Correo electrónico</Text>
          <TextInput
            style={styles.input}
            placeholder="usuario@example.com"
            placeholderTextColor="#303050"
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
            value={email}
            onChangeText={text => { clearError(); setLocalErr(null); setEmail(text); }}
          />

          {/* Password */}
          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            style={styles.input}
            placeholder="Mínimo 6 caracteres"
            placeholderTextColor="#303050"
            secureTextEntry
            textContentType="newPassword"
            value={password}
            onChangeText={text => { clearError(); setLocalErr(null); setPassword(text); }}
          />

          {/* Confirm password */}
          <Text style={styles.label}>Confirmar contraseña</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#303050"
            secureTextEntry
            textContentType="newPassword"
            value={confirm}
            onChangeText={text => { setLocalErr(null); setConfirm(text); }}
            onSubmitEditing={handleRegister}
            returnKeyType="done"
          />

          {/* Submit */}
          <TouchableOpacity
            style={[styles.btn, (loading || !email || !password) && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={loading || !email.trim() || !password.trim()}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Crear cuenta</Text>
            }
          </TouchableOpacity>

          {/* Login link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>¿Ya tienes cuenta?  </Text>
            <TouchableOpacity onPress={() => router.push('/login')} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
              <Text style={styles.footerLink}>Iniciar sesión</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: '#06060f' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32 },
  card: {
    backgroundColor: '#0e0e1a',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1a1a2a',
    padding: 28,
  },
  logo: {
    color: '#c0b0f0',
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    color: '#303050',
    fontSize: 11,
    textAlign: 'center',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 28,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2d0a0a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#7f1d1d',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  errorText:    { color: '#fca5a5', fontSize: 13, flex: 1 },
  errorDismiss: { color: '#7f1d1d', fontSize: 13, marginLeft: 8 },
  label: {
    color: '#40405a',
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginTop: 16,
  },
  optional: { color: '#25253a', letterSpacing: 0 },
  input: {
    backgroundColor: '#0a0a14',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e1e2e',
    color: '#c0c0d8',
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  btn: {
    marginTop: 28,
    backgroundColor: '#7c3aed',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  btnDisabled: { backgroundColor: '#2a1060', opacity: 0.6 },
  btnText:     { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: { color: '#30304a', fontSize: 13 },
  footerLink: { color: '#7c3aed', fontSize: 13, fontWeight: '600' },
});
