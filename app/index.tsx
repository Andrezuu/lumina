import React from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * Pantalla raíz requerida por expo-router para la ruta "/".
 * Nunca se muestra al usuario — el AuthGuard en _layout.tsx
 * redirige inmediatamente a /login o /(tabs) según el token.
 */
export default function IndexScreen() {
  return <View style={styles.root} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#06060f' },
});
