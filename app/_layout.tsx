import 'expo-dev-client';
import { router, Stack, useRootNavigationState, useSegments } from 'expo-router';
import React, { useEffect } from 'react';

import { useAuthStore } from '../src/store/useAuthStore';

/**
 * Auth guard:
 *  • Waits for the root navigator to be fully mounted before navigating.
 *    (useRootNavigationState().key is undefined until the navigator is ready —
 *     navigating earlier throws "Attempted to navigate before mounting the Root Layout")
 *  • If the user is NOT authenticated → redirect to /login
 *  • If the user IS authenticated and visits /login or /register → redirect to /
 */
function AuthGuard() {
  const token       = useAuthStore(s => s.token);
  const segments    = useSegments();
  const navState    = useRootNavigationState();

  useEffect(() => {
    // Navigator not ready yet — do nothing
    if (!navState?.key) return;

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'register';

    if (!token && !inAuthGroup) {
      router.replace('/login');
    } else if (token && inAuthGroup) {
      router.replace('/');
    }
  }, [token, segments, navState?.key]);

  return null;
}

export default function RootLayout() {
  return (
    <>
      <AuthGuard />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
