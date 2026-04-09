/// <reference types="expo/types" />

// Extend Expo's env type with custom public variables
declare namespace NodeJS {
  interface ProcessEnv {
    readonly EXPO_PUBLIC_API_URL?: string;
  }
}
