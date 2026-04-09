/**
 * app/(tabs)/dashboard.tsx  (Tab 1 — Dashboard)
 *
 * Muestra:
 *   • Stats cards: sesiones totales, acordes captados, precisión, tonalidad favorita
 *   • Lista de sesiones recientes (5 más recientes) con tonalidad, fecha y nº de acordes
 *   • Empty State cuando no hay sesiones todavía
 *   • CTA "Iniciar Nueva Sesión" siempre visible en la parte inferior
 */

import { router } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { useSessionHistory } from '../../src/hooks/useSessionHistory';
import { useAuthStore } from '../../src/store/useAuthStore';
import type { SessionWithBlocks } from '../../src/services/sessionService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function totalChords(session: SessionWithBlocks): number {
  return session.blocks.reduce((acc, b) => acc + b.chords.length, 0);
}

// ─── Iconos ───────────────────────────────────────────────────────────────────

function IconMic({ size = 26 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="9" y="2" width="6" height="11" rx="3" stroke="#a78bfa" strokeWidth="1.6" />
      <Path d="M5 11a7 7 0 0 0 14 0" stroke="#a78bfa" strokeWidth="1.6" strokeLinecap="round" />
      <Line x1="12" y1="18" x2="12" y2="22" stroke="#a78bfa" strokeWidth="1.6" strokeLinecap="round" />
      <Line x1="8"  y1="22" x2="16" y2="22" stroke="#a78bfa" strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyIllustration() {
  return (
    <Svg width={100} height={100} viewBox="0 0 120 120" fill="none">
      <Line x1="10" y1="40" x2="110" y2="40" stroke="#1a1a3a" strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="10" y1="52" x2="110" y2="52" stroke="#1a1a3a" strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="10" y1="64" x2="110" y2="64" stroke="#1a1a3a" strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="10" y1="76" x2="110" y2="76" stroke="#1a1a3a" strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="10" y1="88" x2="110" y2="88" stroke="#1a1a3a" strokeWidth="1.5" strokeLinecap="round" />
      <Circle cx="60" cy="76" r="8" fill="#1e1640" stroke="#3b2f7a" strokeWidth="1.5" />
      <Line x1="68" y1="76" x2="68" y2="40" stroke="#3b2f7a" strokeWidth="1.5" strokeLinecap="round" />
      <Path d="M57 58c0-4 6-5 6-2s-3 3-3 6" stroke="#2a2060" strokeWidth="1.8" strokeLinecap="round" />
      <Circle cx="60" cy="66" r="1" fill="#2a2060" />
    </Svg>
  );
}

// ─── Stats Card ───────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={s.statCard}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
      {sub ? <Text style={s.statSub}>{sub}</Text> : null}
    </View>
  );
}

// ─── Session Row ──────────────────────────────────────────────────────────────

function SessionRow({ session }: { session: SessionWithBlocks }) {
  const chords = totalChords(session);
  const tonal  = session.detectedTonality ?? session.title ?? '—';
  return (
    <View style={s.sessionRow}>
      <View style={s.sessionLeft}>
        <Text style={s.sessionTonality}>{tonal}</Text>
        <Text style={s.sessionDate}>{formatDate(session.startedAt)}</Text>
      </View>
      <View style={s.sessionRight}>
        <Text style={s.sessionChords}>{chords}</Text>
        <Text style={s.sessionChordsLabel}>acordes</Text>
      </View>
    </View>
  );
}

// ─── Pantalla ─────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const user   = useAuthStore(st => st.user);
  const logout = useAuthStore(st => st.logout);

  const { sessions, stats, loading, error, refresh } = useSessionHistory();

  const firstName = user?.name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'músico';
  const recent    = sessions.slice(0, 5);
  const isEmpty   = !loading && sessions.length === 0;

  return (
    <View style={s.root}>

      {/* ── Cabecera ── */}
      <View style={s.header}>
        <Text style={s.appName}>lumina</Text>
        <TouchableOpacity onPress={logout} hitSlop={12}>
          <Text style={s.logoutText}>Salir</Text>
        </TouchableOpacity>
      </View>

      {/* ── Saludo ── */}
      <View style={s.greeting}>
        <Text style={s.greetingLabel}>HOLA,</Text>
        <Text style={s.greetingName}>{firstName}</Text>
      </View>

      {/* ── Cuerpo scrollable ── */}
      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor="#7c3aed"
            colors={['#7c3aed']}
          />
        }
      >
        {/* ── Loading inicial ── */}
        {loading && sessions.length === 0 && (
          <View style={s.centered}>
            <ActivityIndicator color="#7c3aed" size="large" />
          </View>
        )}

        {/* ── Error ── */}
        {error && !loading && (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{error}</Text>
            <TouchableOpacity onPress={refresh} style={s.retryBtn}>
              <Text style={s.retryText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Stats cards (solo cuando hay datos) ── */}
        {!loading && stats && sessions.length > 0 && (
          <>
            <Text style={s.sectionLabel}>RESUMEN</Text>
            <View style={s.statsGrid}>
              <StatCard
                label="Sesiones"
                value={String(stats.totalSessions)}
              />
              <StatCard
                label="Acordes"
                value={String(stats.totalChords)}
              />
              <StatCard
                label="Precisión"
                value={`${Math.round(stats.accuracyPct)}%`}
                sub="detector"
              />
              <StatCard
                label="Tonalidad fav."
                value={stats.favoriteTonality ?? '—'}
              />
            </View>

            <Text style={s.sectionLabel}>SESIONES RECIENTES</Text>
            <View style={s.sessionsList}>
              {recent.map(session => (
                <SessionRow key={session.id} session={session} />
              ))}
            </View>
            {sessions.length > 5 && (
              <Text style={s.moreSessions}>
                +{sessions.length - 5} sesiones anteriores
              </Text>
            )}
          </>
        )}

        {/* ── Empty State ── */}
        {isEmpty && !error && (
          <View style={s.emptyState}>
            <EmptyIllustration />
            <Text style={s.emptyTitle}>Sin sesiones aún</Text>
            <Text style={s.emptyHint}>
              Inicia tu primera sesión para ver{'\n'}
              acordes, tonalidad y estadísticas aquí.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ── CTA principal — siempre visible ── */}
      <View style={s.ctaWrapper}>
        <TouchableOpacity
          style={s.ctaButton}
          onPress={() => router.push('/(tabs)/estudio')}
          activeOpacity={0.85}
        >
          <View style={s.ctaIconWrap}>
            <IconMic size={24} />
          </View>
          <Text style={s.ctaLabel}>Iniciar Nueva Sesión</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#06060f',
    paddingTop: 56,
  },

  // Cabecera
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 4,
  },
  appName:    { color: '#3b2f7a', fontSize: 18, fontWeight: '700', letterSpacing: 2 },
  logoutText: { color: '#2a2a4a', fontSize: 12, letterSpacing: 0.5 },

  // Saludo
  greeting: { paddingHorizontal: 24, marginBottom: 20 },
  greetingLabel: {
    color: '#2a2a4a', fontSize: 10,
    letterSpacing: 4, textTransform: 'uppercase',
  },
  greetingName: {
    color: '#c0b0f0', fontSize: 28,
    fontWeight: '700', letterSpacing: -0.5, marginTop: 2,
  },

  // Scroll
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 16 },

  // Sección label
  sectionLabel: {
    color: '#252540', fontSize: 9,
    letterSpacing: 3, textTransform: 'uppercase',
    marginBottom: 10, marginTop: 4,
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 10, marginBottom: 24,
  },
  statCard: {
    flex: 1, minWidth: '44%',
    backgroundColor: '#0e0e1c',
    borderRadius: 16, borderWidth: 1, borderColor: '#1a1a2e',
    paddingVertical: 14, paddingHorizontal: 16,
    gap: 2,
  },
  statValue: { color: '#c0b0f0', fontSize: 26, fontWeight: '300', letterSpacing: -0.5 },
  statLabel: { color: '#2a2a4a', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' },
  statSub:   { color: '#1a1a3a', fontSize: 9, marginTop: 1 },

  // Lista de sesiones
  sessionsList: {
    gap: 8, marginBottom: 12,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0c0c1a',
    borderRadius: 14, borderWidth: 1, borderColor: '#14142a',
    paddingVertical: 12, paddingHorizontal: 16,
  },
  sessionLeft:         { gap: 3 },
  sessionTonality:     { color: '#a090d0', fontSize: 15, fontWeight: '600' },
  sessionDate:         { color: '#252540', fontSize: 11 },
  sessionRight:        { alignItems: 'flex-end', gap: 1 },
  sessionChords:       { color: '#c0b0f0', fontSize: 18, fontWeight: '300' },
  sessionChordsLabel:  { color: '#252540', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' },

  moreSessions: {
    color: '#252540', fontSize: 11,
    textAlign: 'center', marginBottom: 8,
  },

  // Empty State
  emptyState: {
    alignItems: 'center', justifyContent: 'center',
    paddingTop: 60, gap: 12,
  },
  emptyTitle: { color: '#3b3060', fontSize: 18, fontWeight: '600', marginTop: 8 },
  emptyHint:  { color: '#252540', fontSize: 13, lineHeight: 20, textAlign: 'center' },

  // Loading / Error
  centered:   { paddingTop: 80, alignItems: 'center' },
  errorBox:   {
    marginTop: 40, alignItems: 'center', gap: 12,
    backgroundColor: '#130a0a', borderRadius: 14,
    borderWidth: 1, borderColor: '#3a1010',
    paddingVertical: 20, paddingHorizontal: 20,
  },
  errorText:  { color: '#f87171', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  retryBtn:   {
    paddingHorizontal: 20, paddingVertical: 9,
    borderRadius: 12, borderWidth: 1, borderColor: '#3a1a1a',
  },
  retryText:  { color: '#7c3aed', fontSize: 13, fontWeight: '600' },

  // CTA
  ctaWrapper: {
    paddingHorizontal: 24,
    paddingBottom: 28,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#0e0e1c',
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
    paddingVertical: 16,
    shadowColor: '#a78bfa',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  ctaIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#1e1640',
    alignItems: 'center', justifyContent: 'center',
  },
  ctaLabel: { color: '#c0b0f0', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
});
