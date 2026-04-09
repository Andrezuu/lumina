/**
 * app/(tabs)/dashboard.tsx
 *
 * Pantalla de inicio del usuario autenticado.
 * Muestra: bienvenida, resumen rápido y acceso directo al Estudio.
 */

import { router } from 'expo-router';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';

import { useAuthStore } from '../../src/store/useAuthStore';
import { useCanvasStore } from '../../src/store/useCanvasStore';

function IconMic({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="9" y="2" width="6" height="11" rx="3" stroke="#a78bfa" strokeWidth="1.8" />
      <Path d="M5 11a7 7 0 0 0 14 0" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round" />
      <Line x1="12" y1="18" x2="12" y2="22" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round" />
      <Line x1="8"  y1="22" x2="16" y2="22" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export default function DashboardScreen() {
  const user     = useAuthStore(s => s.user);
  const logout   = useAuthStore(s => s.logout);
  const sessions = useCanvasStore(s => s.sessions);

  const firstName = user?.name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'músico';
  const totalCards = sessions.reduce((acc, s) => acc + s.cards.length, 0);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      {/* Greeting */}
      <View style={styles.greeting}>
        <Text style={styles.greetingLabel}>BIENVENIDO</Text>
        <Text style={styles.greetingName}>{firstName}</Text>
        {user?.email && <Text style={styles.greetingEmail}>{user.email}</Text>}
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{sessions.length}</Text>
          <Text style={styles.statLabel}>Sesiones{'\n'}guardadas</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalCards}</Text>
          <Text style={styles.statLabel}>Acordes{'\n'}en lienzo</Text>
        </View>
      </View>

      {/* Quick action */}
      <TouchableOpacity style={styles.ctaCard} onPress={() => router.push('/(tabs)/estudio')} activeOpacity={0.8}>
        <View style={styles.ctaIcon}><IconMic size={24} /></View>
        <View style={styles.ctaText}>
          <Text style={styles.ctaTitle}>Iniciar sesión de estudio</Text>
          <Text style={styles.ctaSubtitle}>Detecta acordes y construye progresiones</Text>
        </View>
        <Text style={styles.ctaArrow}>›</Text>
      </TouchableOpacity>

      {/* Recent sessions */}
      {sessions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SESIONES RECIENTES</Text>
          {sessions.slice(-3).reverse().map(sess => (
            <View key={sess.id} style={styles.sessionRow}>
              <View style={styles.sessionInfo}>
                <Text style={styles.sessionName}>{sess.name}</Text>
                <Text style={styles.sessionMeta}>
                  {sess.cards.length} acordes ·{' '}
                  {sess.tonality ? `${sess.tonality.key} ${sess.tonality.mode === 'major' ? 'mayor' : 'menor'}` : 'Sin tonalidad'} ·{' '}
                  {new Date(sess.createdAt).toLocaleDateString('es', { day: '2-digit', month: 'short' })}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.75}>
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#06060f' },
  content: { padding: 24, paddingTop: 60, paddingBottom: 48, gap: 20 },

  greeting: { marginBottom: 4 },
  greetingLabel: { color: '#2a2a4a', fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4 },
  greetingName:  { color: '#c0b0f0', fontSize: 30, fontWeight: '700', letterSpacing: -0.5 },
  greetingEmail: { color: '#303050', fontSize: 12, marginTop: 4 },

  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, backgroundColor: '#0e0e1a', borderRadius: 16, borderWidth: 1, borderColor: '#1a1a2a', padding: 16, alignItems: 'center', gap: 4 },
  statValue: { color: '#a78bfa', fontSize: 28, fontWeight: '700' },
  statLabel: { color: '#30304a', fontSize: 11, textAlign: 'center', lineHeight: 16 },

  ctaCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0e0e1a', borderRadius: 18, borderWidth: 1, borderColor: '#2a1060', padding: 18, gap: 14 },
  ctaIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#12103a', alignItems: 'center', justifyContent: 'center' },
  ctaText: { flex: 1, gap: 3 },
  ctaTitle:    { color: '#c0b0f0', fontSize: 15, fontWeight: '600' },
  ctaSubtitle: { color: '#40405a', fontSize: 12 },
  ctaArrow: { color: '#3a2a6a', fontSize: 24, fontWeight: '300' },

  section: { gap: 8 },
  sectionTitle: { color: '#2a2a4a', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 },
  sessionRow: { backgroundColor: '#0e0e1a', borderRadius: 14, borderWidth: 1, borderColor: '#1a1a2a', padding: 14 },
  sessionInfo: { gap: 4 },
  sessionName: { color: '#8080a0', fontSize: 14, fontWeight: '500' },
  sessionMeta: { color: '#2a2a4a', fontSize: 11 },

  logoutBtn: { marginTop: 8, paddingVertical: 14, borderRadius: 16, borderWidth: 1, borderColor: '#1a1a2a', alignItems: 'center' },
  logoutText: { color: '#30304a', fontSize: 13, letterSpacing: 0.5 },
});
