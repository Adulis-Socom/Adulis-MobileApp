# Bundled fonts -- ADU-MOB-01 S12 / B16, ADU-MOB-03 S2.3 (D2, D3)

Two families, three weights each, six files. Static instances, not variable
fonts: React Native on Android selects a custom weight by family NAME, not by a
variable-font axis, so each weight is loaded under its own name (see
`app/_layout.tsx` and `typography.face` in `@adulis/tokens/native`).

**No Light, no Italic** (ADU-MOB-03 D3). A thin weight is the first thing to
vanish in sunlight; Noto Sans Ethiopic has no true italic and a synthesised one
is a smear.

**The default text style is the Latin family and no component sets an
Ethiopic-only family** (D2). The Ethiopic files are bundled per D3; whether the
platform's per-glyph fallback ever reaches a BUNDLED custom font -- rather than
the system's own Ethiopic face -- is a device-measured question, recorded as
register entry D-368 and as a tier 0 line in `DEFERRED-GATES.md`.

## Sources, pinned

| Family             | Source                                                                                                                        | Version                                                                                                                  |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Inter              | `https://github.com/rsms/inter/releases/download/v4.1/Inter-4.1.zip`, `extras/ttf/`                                           | release 4.1 (name table: Version 4.001)                                                                                  |
| Noto Sans Ethiopic | `https://raw.githubusercontent.com/notofonts/notofonts.github.io/main/fonts/NotoSansEthiopic/hinted/ttf/`, fetched 7 Sep 2026 | the `main` copy on that date; upm 1000, ascender 1069, descender -293. Not a release tag -- the SHA-256 below is the pin |

Both are licensed under the SIL Open Font License 1.1: `LICENSE-Inter.txt`,
`LICENSE-NotoSansEthiopic.txt`. Neither is a data processor (ADU-MOB-01 B2):
they are files in the bundle, they load nothing and phone home to nothing.

## Measured, not asserted

| File                           | Bytes  | SHA-256                                                            |
| ------------------------------ | ------ | ------------------------------------------------------------------ |
| `Inter-Bold.ttf`               | 420428 | `288316099b1e0a47a4716d159098005eef7c0066921f34e3200393dbdb01947f` |
| `Inter-Medium.ttf`             | 417300 | `97ad806f526e41546d46365bb3a393145f75b7b1568913db74549ad8b8dba872` |
| `Inter-Regular.ttf`            | 411640 | `40d692fce188e4471e2b3cba937be967878f631ad3ebbbdcd587687c7ebe0c82` |
| `NotoSansEthiopic-Bold.ttf`    | 375172 | `b45f16db963a94ccb6590b65d3b0e48f55cde011f7c0d4f3c00531e6b8500d6f` |
| `NotoSansEthiopic-Medium.ttf`  | 379976 | `d5c09c921049aa49066524e68cca4d7a5f5d07c30a0f1f436902910bbb8dd60d` |
| `NotoSansEthiopic-Regular.ttf` | 376804 | `f6f7fc379db9438959a2b0527e7a2cf36ea9c84626d56ec444fff37fc24c3c10` |

Six files, 2,381,320 bytes uncompressed, as fetched at WO-0b. **This is an input to
D3's measurement, not the measurement.** ADU-MOB-03 D3/Q3 measure "the bundle
with the fonts in it" -- the Android download of a development build -- against
ADU-MOB-01 S13's 30 MB, and that build needs the EAS login WO-0a provides; the
line is in `DEFERRED-GATES.md` under tier 0. Vertical metrics read from the
`hhea`/`OS/2` tables: Noto Sans Ethiopic content height 1.362 em (1069 + 293, no
line gap); Inter 1.210 em. `typography.metrics` in `@adulis/tokens/native`
carries the first number and every line height in the scale is derived from it.

Re-fetch by hand; do not add a fonts CDN, a Google Fonts loader or an
`@expo-google-fonts/*` package -- each is a dependency decision under B2 and the
first two are network calls at launch.
