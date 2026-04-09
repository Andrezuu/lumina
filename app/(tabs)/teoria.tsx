/**
 * app/(tabs)/teoria.tsx
 *
 * Pantalla de referencia de teoría musical.
 * Placeholder estructurado — contenido expandible en iteraciones futuras.
 */

import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// ─── Datos de referencia ─────────────────────────────────────────────────────

const INTERVALS = [
  { name: 'Unísono',          semitones: 0,  symbol: 'P1'  },
  { name: 'Segunda menor',    semitones: 1,  symbol: 'm2'  },
  { name: 'Segunda mayor',    semitones: 2,  symbol: 'M2'  },
  { name: 'Tercera menor',    semitones: 3,  symbol: 'm3'  },
  { name: 'Tercera mayor',    semitones: 4,  symbol: 'M3'  },
  { name: 'Cuarta justa',     semitones: 5,  symbol: 'P4'  },
  { name: 'Tritono',          semitones: 6,  symbol: 'TT'  },
  { name: 'Quinta justa',     semitones: 7,  symbol: 'P5'  },
  { name: 'Sexta menor',      semitones: 8,  symbol: 'm6'  },
  { name: 'Sexta mayor',      semitones: 9,  symbol: 'M6'  },
  { name: 'Séptima menor',    semitones: 10, symbol: 'm7'  },
  { name: 'Séptima mayor',    semitones: 11, symbol: 'M7'  },
  { name: 'Octava',           semitones: 12, symbol: 'P8'  },
];

const MODES = [
  { name: 'Jónico (mayor)',   formula: 'T T S T T T S',   feel: 'Alegre, brillante'    },
  { name: 'Dórico',           formula: 'T S T T T S T',   feel: 'Melancólico, jazzístico' },
  { name: 'Frigio',           formula: 'S T T T S T T',   feel: 'Oscuro, flamenco'     },
  { name: 'Lidio',            formula: 'T T T S T T S',   feel: 'Etéreo, soñador'      },
  { name: 'Mixolidio',        formula: 'T T S T T S T',   feel: 'Dominante, blues'     },
  { name: 'Eólico (menor)',   formula: 'T S T T S T T',   feel: 'Triste, natural'      },
  { name: 'Locrio',           formula: 'S T T S T T T',   feel: 'Inestable, disonante' },
];

const CHORD_TYPES = [
  { name: 'Mayor',          symbol: '',     formula: '1 – 3 – 5'       },
  { name: 'Menor',          symbol: 'm',    formula: '1 – ♭3 – 5'      },
  { name: 'Dominante 7',    symbol: '7',    formula: '1 – 3 – 5 – ♭7'  },
  { name: 'Mayor 7',        symbol: 'maj7', formula: '1 – 3 – 5 – 7'   },
  { name: 'Menor 7',        symbol: 'm7',   formula: '1 – ♭3 – 5 – ♭7' },
  { name: 'Disminuido',     symbol: 'dim',  formula: '1 – ♭3 – ♭5'     },
  { name: 'Aumentado',      symbol: 'aug',  formula: '1 – 3 – ♯5'      },
  { name: 'Suspendido 2',   symbol: 'sus2', formula: '1 – 2 – 5'       },
  { name: 'Suspendido 4',   symbol: 'sus4', formula: '1 – 4 – 5'       },
];

// ─── Sección colapsable ──────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <View style={s.section}>
      <TouchableOpacity style={s.sectionHeader} onPress={() => setOpen(v => !v)} activeOpacity={0.7}>
        <Text style={s.sectionTitle}>{title}</Text>
        <Text style={s.sectionArrow}>{open ? '▾' : '▸'}</Text>
      </TouchableOpacity>
      {open && <View style={s.sectionBody}>{children}</View>}
    </View>
  );
}

// ─── Pantalla ────────────────────────────────────────────────────────────────

export default function TeoriaScreen() {
  return (
    <ScrollView style={s.root} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <Text style={s.pageTitle}>Teoría Musical</Text>
      <Text style={s.pageSubtitle}>Referencia rápida para el estudio de acordes</Text>

      {/* Intervalos */}
      <Section title="Intervalos">
        {INTERVALS.map(iv => (
          <View key={iv.symbol} style={s.row}>
            <View style={s.badge}><Text style={s.badgeText}>{iv.semitones}</Text></View>
            <Text style={s.rowMain}>{iv.name}</Text>
            <Text style={s.rowSub}>{iv.symbol}</Text>
          </View>
        ))}
      </Section>

      {/* Tipos de acordes */}
      <Section title="Tipos de acordes">
        {CHORD_TYPES.map(ct => (
          <View key={ct.symbol || 'maj'} style={s.row}>
            <View style={[s.badge, s.badgePurple]}>
              <Text style={[s.badgeText, s.badgePurpleText]}>{ct.symbol || 'M'}</Text>
            </View>
            <Text style={s.rowMain}>{ct.name}</Text>
            <Text style={s.rowSub}>{ct.formula}</Text>
          </View>
        ))}
      </Section>

      {/* Modos */}
      <Section title="Modos de la escala mayor">
        {MODES.map(m => (
          <View key={m.name} style={s.modeCard}>
            <Text style={s.modeName}>{m.name}</Text>
            <Text style={s.modeFormula}>{m.formula}</Text>
            <Text style={s.modeFeel}>{m.feel}</Text>
          </View>
        ))}
      </Section>

    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#06060f' },
  content: { padding: 20, paddingTop: 60, paddingBottom: 48, gap: 16 },

  pageTitle:    { color: '#c0b0f0', fontSize: 26, fontWeight: '700', letterSpacing: -0.3 },
  pageSubtitle: { color: '#2a2a4a', fontSize: 12, marginTop: 4, marginBottom: 4 },

  section: { backgroundColor: '#0e0e1a', borderRadius: 18, borderWidth: 1, borderColor: '#1a1a2a', overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#14142a' },
  sectionTitle: { color: '#6060a0', fontSize: 11, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
  sectionArrow: { color: '#2a2a4a', fontSize: 14 },
  sectionBody: { padding: 12, gap: 8 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  badge: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#1a1a28', borderWidth: 1, borderColor: '#2a2a3a', alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#6060a0', fontSize: 11, fontWeight: '700' },
  badgePurple: { backgroundColor: '#12103a', borderColor: '#2e2860' },
  badgePurpleText: { color: '#a78bfa' },
  rowMain: { color: '#8080a0', fontSize: 13, flex: 1 },
  rowSub:  { color: '#30304a', fontSize: 11, fontFamily: 'monospace' },

  modeCard: { backgroundColor: '#0a0a14', borderRadius: 12, borderWidth: 1, borderColor: '#1a1a2a', padding: 12, gap: 4 },
  modeName:    { color: '#9090b0', fontSize: 13, fontWeight: '600' },
  modeFormula: { color: '#404060', fontSize: 12, fontFamily: 'monospace' },
  modeFeel:    { color: '#2a2a4a', fontSize: 11, fontStyle: 'italic' },
});
