// Type declarations for optional Capacitor plugins
// These are dynamically imported and may not be installed

declare module '@capacitor-community/firebase-analytics' {
  export const FirebaseAnalytics: {
    initializeFirebase(options: {
      apiKey: string;
      authDomain: string;
      projectId: string;
      storageBucket: string;
      messagingSenderId: string;
      appId: string;
      measurementId: string;
    }): Promise<void>;
    setCollectionEnabled(options: { enabled: boolean }): Promise<void>;
    setUserId(options: { userId: string }): Promise<void>;
    logEvent(options: { name: string; params?: Record<string, unknown> }): Promise<void>;
    setUserProperty(options: { name: string; value: string }): Promise<void>;
    setCurrentScreen(options: { screenName: string }): Promise<void>;
  };
}

declare module '@capacitor/device' {
  export const Device: {
    getId(): Promise<{ identifier: string }>;
    getInfo(): Promise<{
      name?: string;
      platform: string;
      model: string;
      operatingSystem: string;
      osVersion: string;
      manufacturer: string;
      isVirtual: boolean;
      memUsed?: number;
      diskFree?: number;
      diskTotal?: number;
      realDiskFree?: number;
      realDiskTotal?: number;
      webViewVersion?: string;
    }>;
  };
}
