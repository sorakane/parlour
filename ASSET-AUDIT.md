# Asset / attribution review — 2026-09-07

Scope: the current source tree and the newly built public site. This is a provenance
review, not a determination that a named creator or service infringed copyright.
Historical Git objects, already downloaded browser files, and older immutable Vercel
deployments are not erased by this commit.

## Retained notices and assets

- `LICENSE` already retained the upstream MIT text and `Copyright (c) 2026 Braedon
  Saunders`. It is now also shipped at `/legal/parlour-LICENSE.txt`, linked from the
  setup footer's `/credits/` page with upstream and fork URLs.
- Baloo 2 and Nunito Sans (Google Fonts) have their actual OFL 1.1 copyright/license
  files shipped under `/legal/`. The Japanese interface additionally uses installed
  system fonts, which are not redistributed by this project.
- Dependency notices are collected from the installed production dependency closure
  (32 packages, including build/platform components); supplemental Next/React notices
  and GSAP's original copyright + standard-license link are included. GSAP's original
  source headers remain. This game is an ordinary web interface, not an animation builder.
- `nostr-wasm` declares MIT in package metadata but has no separate upstream LICENSE
  file; this limitation and the author/source are recorded in the notices. It was not
  found in the exported client chunks. No licensing status was invented for it.
- The upstream Parlour vector logos and code-rendered avatar/background/card artwork
  remain under the repository's license. No franchise images, character portraits,
  screenshots, or third-party songs were added for the Daifugo redesign. New cut-ins
  use CSS geometry and semantic text.

## Audio removed / replaced

17 M4A music files and 103 MP3 effects/voice recordings were removed from `public/audio`.
The old procedural drone ambience was also removed. The recording history includes ElevenLabs scripts
and a later hand-made beach-track replacement commit; it does not establish the precise
creation plan, applicable terms, or transferable permissions for every recording.

Rather than infer rights from those files, this edition uses only seven reproducible
WAVs under `/audio/original/`: an original math-only pop instrumental, three
short original tones, two connection tones, and a silent voice placeholder. No external
samples, cloned voice, generated service output, or borrowed melody is used. Existing
music-channel mute preferences continue to control the soundtrack; the Daifugo control
now says `BGM`. Voice cues are silent. Event sound IDs and game timing are preserved.

`generate:audio` now runs only those local math generators. `build` (and `prebuild`) verifies a SHA-256
allowlist in `/legal/audio-provenance.json`; the old remote-generation scripts cannot
silently reintroduce recordings into a successful build. Legacy music metadata appears
only in a **test-only** fixture so playlist-controller tests still exercise multi-track
behavior; it is not shipped as an active soundtrack. New URLs avoid reuse of cached old
recordings; the existing versioned service-worker activation clears prior app caches
when a client safely updates. It does not interrupt an in-progress match to update.

## Sources checked

- Upstream MIT: https://github.com/braedonsaunders/parlour/blob/main/LICENSE
- MIT conditions: https://opensource.org/license/mit
- ElevenLabs usage conditions depend on the plan/service:
  https://help.elevenlabs.io/hc/en-us/articles/13313564601361-Can-I-publish-the-content-I-generate-on-the-platform
- Suno usage conditions also depend on the creation-time plan (a source-code comment
  mentions Suno, but that alone does not prove which service generated a given file):
  https://help.suno.com/en/articles/2416769
- Font notices: https://github.com/google/fonts/tree/main/ofl/baloo2 and
  https://github.com/google/fonts/tree/main/ofl/nunitosans
- GSAP permitted-use license: https://gsap.com/standard-license/

## Verification

The audio allowlist and WAV/manifest checks pass. The original recordings are absent
from the new public tree. AudioManager/MusicController, audio integration, table-menu
and Daifugo presentation tests cover mute, lifecycle, valid assets, and cut-in duration.
A broad web test run identified a pre-existing HandRail CSS-policy test failure at
`daifugoVisual.module.css`'s `--hand-rail-max: 46vw` (also present at pre-change HEAD
959197e). That unrelated prior layout override is retained. The music-menu test was
updated to expect the actual replacement soundtrack instead of a removed track.

## Pop soundtrack update

The previous drone ambience and its generator were removed. `audio/original/pop-shuffle.wav` is an original 120 BPM C-major instrumental synthesized by `scripts/generate-pop-music.mjs`: plucked oscillator chords and melody, bass, and seeded-noise percussion, with no recordings, external generation service, or borrowed tune. The reproducible source remains under this fork’s MIT license. The provenance allowlist records the new hash. The music controller now lets Howler loop without restarting/fading at each end event.


## Original generated avatar replacement (2026-09-07)

Eight original anime-style adult female portraits now replace the previous
code-drawn Daifugo portraits. They were generated separately using the built-in
OpenAI image-generation tool; the first generated portrait was used as a style
reference for the others. No external character image or franchise art was supplied.
The earlier statement about code-rendered portraits describes the prior revision.

The retained original PNGs and exact prompt/hash provenance are in
`apps/web/src/assets/daifugo/avatars/`. The public credits disclose image generation.
This records the production source; it does not claim third-party artwork licenses
or guarantee exclusive copyright in generated images. Upstream MIT notices, font
notices and the audio provenance allowlist remain intact.
