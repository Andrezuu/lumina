/**
 * app/(tabs)/_layout.tsx
 *
 * Bottom Tab navigator — 3 pestañas principales de Lumina:
 *   • Dashboard  — resumen del usuario y sesiones recientes
 *   • Estudio    — detector de acordes + lienzo
 *   • Teoría     — referencia de teoría musical
 */

import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

// ─── Colores ─────────────────────────────────────────────────────────────────

const ACTIVE   = '#a78bfa';   // violeta
const INACTIVE = '#2a2a4a';
const BG       = '#08080f';
const BORDER   = '#14142a';

// ─── Iconos SVG inline ───────────────────────────────────────────────────────

function IconDashboard({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="3" width="7" height="7" rx="1.5" stroke={color} strokeWidth="1.8" />
      <Rect x="14" y="3" width="7" height="7" rx="1.5" stroke={color} strokeWidth="1.8" />
      <Rect x="3" y="14" width="7" height="7" rx="1.5" stroke={color} strokeWidth="1.8" />
      <Rect x="14" y="14" width="7" height="7" rx="1.5" stroke={color} strokeWidth="1.8" />
    </Svg>
  );
}

function IconEstudio({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      {/* Micrófono */}
      <Rect x="9" y="2" width="6" height="11" rx="3" stroke={color} strokeWidth="1.8" />
      {/* Arco */}
      <Path d="M5 11a7 7 0 0 0 14 0" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      {/* Línea base */}
      <Line x1="12" y1="18" x2="12" y2="22" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <Line x1="8"  y1="22" x2="16" y2="22" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

function IconTeoria({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      {/* Pentagrama — 3 líneas */}
      <Line x1="3" y1="8"  x2="21" y2="8"  stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="3" y1="12" x2="21" y2="12" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Line x1="3" y1="16" x2="21" y2="16" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      {/* Nota */}
      <Circle cx="8" cy="16" r="2.2" fill={color} />
      <Line x1="10.2" y1="16" x2="10.2" y2="7" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      {/* Segunda nota */}
      <Circle cx="16" cy="12" r="2.2" fill={color} />
      <Line x1="18.2" y1="12" x2="18.2" y2="3" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </Svg>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: BG,
          borderTopColor: BORDER,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 84 : 62,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          paddingTop: 8,
          elevation: 0,
        },
        tabBarActiveTintColor:   ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <IconDashboard color={color} />,
        }}
      />
      <Tabs.Screen
        name="estudio"
        options={{
          title: 'Estudio',
          tabBarIcon: ({ color }) => <IconEstudio color={color} />,
        }}
      />
      <Tabs.Screen
        name="teoria"
        options={{
          title: 'Teoría',
          tabBarIcon: ({ color }) => <IconTeoria color={color} />,
        }}
      />
    </Tabs>
  );
}
