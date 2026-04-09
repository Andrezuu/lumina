import 'expo-dev-client';
import { router, Slot, useRootNavigationState, useSegments } from 'expo-router';
import React, { useEffect } from 'react';

import { useAuthStore } from '../src/store/useAuthStore';

/**
 * AuthGuard — único responsable de toda la lógica de navegación.
 *
 * Reglas:
 *  1. Espera a que el navigator esté montado (navState.key).
 *  2. Si no hay token y el usuario no está en login/register → /login
 *  3. Si hay token y el usuario está en login/register o en la raíz → /(tabs)
 *
 * login.tsx y register.tsx NO hacen router.replace — solo cambian el store.
 * index.tsx es una pantalla vacía que nunca se ve porque este guard actúa primero.
 */
function AuthGuard() {
  const token    = useAuthStore(s => s.token);
  const segments = useSegments();
  const navState = useRootNavigationState();

  useEffect(() => {
    // Navigator no está listo aún
    if (!navState?.key) return;

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'register';
    const inRoot      = segments[0] === 'index' || !segments[0];

    if (!token) {
      // Sin sesión: solo se permite estar en login o register
      if (!inAuthGroup) {
        router.replace('/login');
      }
    } else {
      // Con sesión: no debe estar en login, register ni en la raíz
      if (inAuthGroup || inRoot) {
        router.replace('/(tabs)/dashboard');
      }
    }
  }, [token, segments, navState?.key]);

  return null;
}

export default function RootLayout() {
  return (
    <>
      <AuthGuard />
      {/*
        Slot renderiza la ruta activa sin añadir un Stack extra.
        expo-router ya gestiona el Stack internamente por grupo de rutas.
        Esto evita el error "unmatched route" que ocurre cuando el Stack
        no tiene declarado explícitamente el nombre de la ruta activa.
      */}
      <Slot />
    </>
  );
}
