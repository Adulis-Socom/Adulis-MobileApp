# Third-party privacy manifests in the SDK 57 dependency tree -- ADU-MOB-05 S4.3, ADU-MOB-WO-01 v1.2 S0b.2

Generated at WO-0b (7 Sep 2026) by reading every `PrivacyInfo.xcprivacy` in the installed dependency store (only React Native and Expo packages ship one, and only apps/mobile depends on them). Expo does not merge these into the app's own manifest; each is bundled with its framework and Apple reads them all at upload. The app's OWN declaration is in `app.config.ts` (`ios.privacyManifests`). Regenerate after any dependency change with the script recorded in `docs/build-status/MOB-WO-0-REPORT.md`.

10 manifest(s) found.

| Package              | Version | File                                                   | Required-reason API categories | Reason codes                   | Tracking | Collected data types |
| -------------------- | ------- | ------------------------------------------------------ | ------------------------------ | ------------------------------ | -------- | -------------------- |
| `expo-application`   | 57.0.2  | `ios/PrivacyInfo.xcprivacy`                            | FileTimestamp                  | C617.1                         | false    | none                 |
| `expo-constants`     | 57.0.17 | `ios/PrivacyInfo.xcprivacy`                            | UserDefaults                   | CA92.1                         | false    | none                 |
| `expo-file-system`   | 57.0.6  | `ios/PrivacyInfo.xcprivacy`                            | FileTimestamp, DiskSpace       | 0A2A.1, 3B52.1, E174.1, 85F4.1 | false    | none                 |
| `expo-notifications` | 57.0.17 | `ios/PrivacyInfo.xcprivacy`                            | UserDefaults                   | CA92.1                         | false    | none                 |
| `react-native`       | 0.86.3  | `React/Resources/PrivacyInfo.xcprivacy`                | FileTimestamp, UserDefaults    | C617.1, CA92.1                 | false    | none                 |
| `react-native`       | 0.86.3  | `ReactCommon/cxxreact/PrivacyInfo.xcprivacy`           | FileTimestamp                  | C617.1                         | false    | none                 |
| `react-native`       | 0.86.3  | `ReactCommon/react/timing/PrivacyInfo.xcprivacy`       | SystemBootTime                 | 35F9.1                         | false    | none                 |
| `react-native`       | 0.86.3  | `third-party-podspecs/boost/PrivacyInfo.xcprivacy`     | FileTimestamp, SystemBootTime  | C617.1, 35F9.1                 | false    | none                 |
| `react-native`       | 0.86.3  | `third-party-podspecs/glog/PrivacyInfo.xcprivacy`      | FileTimestamp                  | C617.1                         | false    | none                 |
| `react-native`       | 0.86.3  | `third-party-podspecs/RCT-Folly/PrivacyInfo.xcprivacy` | FileTimestamp                  | C617.1                         | false    | none                 |

## What this says

Categories declared across the dependencies: FileTimestamp (7), UserDefaults (3), DiskSpace (1), SystemBootTime (2). Tracking flags: false. Collected data types declared by any dependency: none -- consistent with ADU-MOB-01 B2 (no third-party SDK, no analytics, nothing that collects).

The app's own declaration carries the same four categories with Apple's approved reason codes (UserDefaults CA92.1, FileTimestamp C617.1, SystemBootTime 35F9.1, DiskSpace E174.1). Whether that set is COMPLETE for the app's own code is what the throwaway App Store Connect upload proves (DEFERRED-GATES.md, P6): Apple emails within minutes naming any API used without a reason.
