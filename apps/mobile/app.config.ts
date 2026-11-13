import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Expo app configuration -- ADU-MOB-01 v1.2 S17.2, built by ADU-MOB-WO-01 v1.2
 * WO-0b. Config plugins for secure store, camera, notifications, SQLite and
 * updates; nothing else.
 *
 * WHAT IS DELIBERATELY ABSENT, and the decision each waits on:
 *
 * - No App Links / Universal Links (`ios.associatedDomains`,
 *   `android.intentFilters`): there is no domain (ADU-MOB-01 S24 Q1,
 *   ADU-MOB-PLAN-01 D3), and a half-configured association degrades to a
 *   chooser dialog silently (ADU-MOB-01 S11).
 * - No `ios.bundleIdentifier` and no `android.package`: reverse-domain
 *   identifiers nobody has ruled (register D-372). EAS needs them before the
 *   first development build.
 * - No icon, no splash image, no splash colour: the brand hue is unruled
 *   (ADU-MOB-03 Q1) and a hex literal outside packages/tokens is grep gate 12.
 * - No `updates.url` and no `extra.eas.projectId`: an EAS project is created by
 *   the operator under their own Expo login (WO-0a), never by the agent.
 * - No `expo-font` config plugin: fonts load at runtime in app/_layout.tsx under
 *   the names `typography.face` gives them, so one name works on both platforms.
 *
 * PURPOSE STRINGS (ADU-MOB-05 S4.4): every one names a visible feature, and the
 * plugins' GENERIC defaults are switched off -- expo-camera would otherwise write
 * a microphone string and expo-secure-store a Face ID string for capabilities
 * Buyer Mode does not have. A generic string is a rejection. If WO-2 adopts
 * biometric unlock (ADU-MOB-01 S4.4), it supplies the Face ID string then.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Adulis',
  slug: 'adulis',
  version: '0.1.0',
  scheme: 'adulis',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  assetBundlePatterns: ['assets/fonts/*'],
  /**
   * THE RUNTIME VERSION IS NATIVE COMPATIBILITY, NOT THE BUNDLE VERSION.
   * ADU-MOB-01 B7 makes `X-Adulis-Client` carry two versions -- the JavaScript
   * bundle actually executing and the store binary -- and B21 makes every
   * over-the-air update a version bump. Expo's runtimeVersion decides which
   * installed binaries an update may reach; tying it to `expo.version` (the
   * 'appVersion' policy) would make every bump a new runtime and deliver the
   * update to nobody. The fingerprint policy keys it to the native project
   * instead, so `expo.version` is free to move with each update. WO-1 reads the
   * bundle version into the header from the update record.
   */
  runtimeVersion: { policy: 'fingerprint' },
  ios: {
    supportsTablet: false,
    /**
     * ADU-MOB-05 S4.3 / ADU-MOB-WO-01 v1.2 P6. The required-reason APIs that
     * React Native and the Expo modules in this bundle touch, with Apple's
     * approved reason codes. This is the declaration whose ABSENCE fails an
     * App Store Connect upload. The collected-data declaration (App Privacy
     * labels, Data safety) is a different form, generated from ADU-DPIA-01 S4
     * (ADU-MOB-05 S5), and is deliberately not asserted here. The third-party
     * manifests shipped inside the dependencies are listed in
     * apps/mobile/PRIVACY-MANIFESTS.md.
     */
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
          NSPrivacyAccessedAPITypeReasons: ['C617.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
          NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
          NSPrivacyAccessedAPITypeReasons: ['E174.1'],
        },
      ],
    },
  },
  android: {
    // Play's floor for new apps is API 36 (ADU-MOB-05 S1.1). Expo SDK 57
    // targets it by default and nothing here lowers it.
  },
  plugins: [
    'expo-router',
    [
      'expo-camera',
      {
        // MB-21 is the only camera use in Buyer Mode; no audio is ever recorded.
        cameraPermission:
          'Adulis uses the camera to scan the code the seller shows you. Scanning completes your order.',
        microphonePermission: false,
        recordAudioAndroid: false,
      },
    ],
    'expo-notifications',
    [
      'expo-secure-store',
      {
        // No biometric-gated read exists at WO-0b; a Face ID string would be generic.
        faceIDPermission: false,
      },
    ],
    'expo-sqlite',
    'expo-updates',
  ],
  experiments: {
    typedRoutes: false,
  },
});
