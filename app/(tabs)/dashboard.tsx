/**
 * app/(tabs)/dashboard.tsx  (Tab 1 — Dashboard / Inicio)
 *
 * Estado Vacío (Empty State) con bienvenida personalizada y
 * CTA principal para iniciar una nueva sesión de estudio.
 */

import { router } from 'expo-router';
import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { useAuthStore } from '../../src/store/useAuthStore';

// ─── Icono de micrófono ───────────────────────────────────────────────────────

function IconMic({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="9" y="2" width="6" height="11" rx="3" stroke="#a78bfa" strokeWidth="1.6" />
      <Path d="M5 11a7 7 0 0 0 14 0" stroke="#a78bfa" strokeWidth="1.6" strokeLinecap="round" />
      <Line x1="12" y1="18" x2="12" y2="22" stroke="#a78bfa" strokeWidth="1.6" strokeLinecap="round" />
      <Line x1="8"  y1="22" x2="16" y2="22" stroke="#a78bfa" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

// ─── Ilustración de Empty State ───────────────────────────────────────────────

function EmptyIllustration() {
  return (
    <Svg width={120} height={120} viewBox="0 0 120 120" fill="none">
      {/* Pentagrama */}
      <Line x1="10" y1="40" x2="110" y2="40" stroke="#1a1a3a" strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="10" y1="52" x2="110" y2="52" stroke="#1a1a3a" strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="10" y1="64" x2="110" y2="64" stroke="#1a1a3a" strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="10" y1="76" x2="110" y2="76" stroke="#1a1a3a" strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="10" y1="88" x2="110" y2="88" stroke="#1a1a3a" strokeWidth="1.5" strokeLinecap="round" />
      {/* Nota — cuerpo */}
      <Circle cx="60" cy="76" r="8" fill="#1e1640" stroke="#3b2f7a" strokeWidth="1.5" />
      {/* Nota — plica */}
      <Line x1="68" y1="76" x2="68" y2="40" stroke="#3b2f7a" strokeWidth="1.5" strokeLinecap="round" />
      {/* Signo de pregunta tenue */}
      <Path
        d="M57 58c0-4 6-5 6-2s-3 3-3 6"
        stroke="#2a2060"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="60" cy="66" r="1" fill="#2a2060" />
    </Svg>
  );
}

// ─── Pantalla ─────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const user   = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);

  const firstName = user?.name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'músico';

  return (
    <View style={styles.root}>

      {/* ── Cabecera ── */}
      <View style={styles.header}>
        <Text style={styles.appName}>lumina</Text>
        <TouchableOpacity onPress={logout} hitSlop={12}>
          <Text style={styles.logoutText}>Salir</Text>
        </TouchableOpacity>
      </View>

      {/* ── Empty State centrado ── */}
      <View style={styles.emptyState}>
        <EmptyIllustration />

        <Text style={styles.welcomeLabel}>BIENVENIDO</Text>
        <Text style={styles.welcomeName}>{firstName}</Text>

        <Text style={styles.emptyHint}>
          Aún no tienes sesiones guardadas.{'\n'}
          Empieza a detectar acordes y construye{'\n'}
          tu primera progresión.
        </Text>
      </View>

      {/* ── CTA principal ── */}
      <View style={styles.ctaWrapper}>
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => router.push('/(tabs)/estudio')}
          activeOpacity={0.85}
        >
          <View style={styles.ctaIconWrap}>
            <IconMic size={26} />
          </View>
          <Text style={styles.ctaLabel}>Iniciar Nueva Sesión</Text>
        </TouchableOpacity>

        <Text style={styles.ctaHint}>
          Detecta acordes en tiempo real
        </Text>
      </View>

    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#06060f',
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 32,
  },

  // Cabecera
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  appName:    { color: '#3b2f7a', fontSize: 18, fontWeight: '700', letterSpacing: 2 },
  logoutText: { color: '#2a2a4a', fontSize: 12, letterSpacing: 0.5 },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  welcomeLabel: {
    color: '#2a2a4a',
    fontSize: 10,
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginTop: 16,
  },
  welcomeName: {
    color: '#c0b0f0',
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  emptyHint: {
    color: '#30304a',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 4,
  },

  // CTA
  ctaWrapper: {
    alignItems: 'center',
    gap: 10,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#12103a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3b2f7a',
    paddingVertical: 18,
    paddingHorizontal: 32,
    width: '100%',
    // Sombra sutil
    shadowColor: '#a78bfa',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  ctaIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#1e1640',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: {
    color: '#c0b0f0',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  ctaHint: {
    color: '#2a2a4a',
    fontSize: 11,
    letterSpacing: 0.5,
  },
});
