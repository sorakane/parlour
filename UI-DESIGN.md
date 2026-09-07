# 大富豪 visual redesign — 2026-09-07

## Current UI analysis

The live /daifugo screen uses the shared parlour setup carousel, warm cream display type, rounded translucent panels, illustrated card fans, and a scenic animated background. Four mode tiles compete for attention; the play action sits after detailed settings. The board uses a shared circular seat layout and subtle phase line. Role events have emoji bursts; special-rule cues mostly live in text. MatchPodium currently presents generic Blitz/Knock counters even for Daifugo. Existing game state, rules, transport, room recovery, and sound settings must remain intact.

## Decisions before implementation

| System      | Decision                                                                                                                                                                                                                                                                                                    |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Color       | Ink #111112 / red #be1020 / white #fffaf3. Ink is the quiet board and structural neutral; red establishes identity and major action; white creates sharp selection and typographic contrast. No gradients or new image assets.                                                                              |
| Typography  | Heavy Japanese Gothic system stack; oversized 大富豪 title and decisive action words. Compact uppercase Latin as subordinate editorial notation. Body Japanese stays horizontal, 1.6 leading; tabular rank/score numerals.                                                                                  |
| Composition | Asymmetric poster title and vertical mode index; overlapping original number/suit geometry. One diagonal direction (-8 to -12 degrees) for bands. Stable hand and action rail; decorative geometry around the quiet board. Phone stacks into a clear reading order.                                         |
| Motion      | Existing route wipe timing retained, with red/black angled panels. Quick turn-marker entrance, bounded special-action cut-in, and distinct match result entrance. Use existing FX + read-only view changes. No animation gates on game dispatch or networking. Reduced motion uses static/fade equivalents. |

## Presentation mapping

- Title/setup: large Japanese masthead; mode choices as editorial rows; primary CPU start and friend-room entry remain available.
- Start: Daifugo-only variant of existing WipeOverlay; same store, router and timing.
- Turn: stable HUD text names the active player; brief directional entrance on seat change.
- Special actions: confirmed pile-clear/effect/elimination/out events plus current-vs-previous view modifiers for revolution, jack-back, suit/rank lock. Highest-priority cue wins each batch; no stale queue. Keep phase/modifier text available after the cue.
- Round rank: identify the local rank from role/out events; distinguish this from the final match winner.
- Match results: dedicated Daifugo presentation reads MatchSnapshot.result.winner, supplied rankings and detail.points. No score or winner calculation added.

## Scope

Only Daifugo setup/table presentation and conditional Daifugo variants of shared transition/result components. Retain all action callbacks, stores, rule controls, hand admission/flight, match reports, and all packages unchanged. No new music, fonts, illustrations or dependencies.

## Skill

Installed at /Users/cella/.agents/skills/japanese-game-ui/SKILL.md. Validated with skill-creator quick_validate; Codex skills/list reports scope=user, enabled=true, errors=[]. Portable source is in ../japanese-game-ui next to the repository. Reviewed existing emil-design-eng and apple-design; frontend-design, ui-ux-pro-max, impeccable were not found in the available catalog.

## Review and verification

| Before                                            | After                                                                   | Why                                                                            |
| ------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Rounded glass-like carousel; start below settings | Poster masthead, editorial mode list, prominent Japanese start actions  | Establish one primary action and a distinct Daifugo identity                   |
| 8-seat mobile ring overlaps                       | Two rows of opponent plaques; local seat displayed at the hand position | Keep each player's identity readable without changing seat IDs or turn order   |
| Golden countdown and subtle effects               | Red/black diagonal entry and bounded text cut-ins                       | Give start, turns, special rules, and decisive moments different visual weight |
| Generic Blitz/Knock podium counters               | Authoritative Daifugo rank/points table and victory/defeat heading      | Show the information relevant to this game                                     |

- Checked desktop 1280px, phone 390×844, and short landscape 844×390. Inspected title, real start wipe, real card selection/commit, turn change, and 8-seat layout.
- Rare revolution, 8-cut, rank, victory/defeat and result layouts were checked with a temporary local React fixture using real presentation components; the fixture is excluded from the final route tree. This is not a claim of a completed remote multiplayer match.
- Reduced-motion browser check: cut-in animationName=none, transform=none; removed after its bounded lifetime while the recent-event text remained readable. The game's existing reduced-motion preference is also respected.
- Token contrast accounts for the existing app-wide Richer saturation filter (1.26). Red was adjusted to #be1020: paper on red is approximately 4.74:1 after the filter; paper on ink approximately 18.13:1.
- Browser development hot-reload produced a Next CSS HMR removeChild error while replacing styles. Final verification uses the compiled static export to exclude HMR from the application check.
- packages/, rule/view helpers, transports, stores, match-report timing, and multiplayer session logic have no diff. Shared components branch only on game=daifugo.
- Existing viewport-level pinch-zoom restriction is inherited from the shared app; this redesign does not change that global setting or claim full WCAG conformance.

Final checks: 20 related tests passed across 6 files; production webpack build and TypeScript passed; ESLint reported no code errors (existing repository-root Next pages-directory warning only). The final static export loads in a fresh browser with `errors: []`, and rule expansion/BGM controls work without horizontal overflow. Result visuals use the local fixture; real match-end behavior is also covered by the existing component tests. No new fixture route is included in the production output.

## Active-rule HUD (2026-09-07)

The previous HUD mixed technical suit codes and effect names into a small phase line.
A persistent “いまのルール” strip now separates strength order, suit lock, and the next
rank/count required by strict lock. Color: red identifies active constraints against
black/white. Typography: large suit symbols and required ranks; Japanese suit names
remain visible. Composition: a reserved top strip, a left column in short landscape,
and compact opponents on short phones keep hands and commit controls clear. Motion:
state updates immediately without blinking, timers, or blocking animations.

The strip reads the public table view directly. Strict-lock display follows the engine's
rank direction, run-overlap setting, run length and A/2 bounds. Revolution + 11-back
explicitly shows normal order. Suit/rank locks clear with the current state, including
when reconnecting, and the spade-three exception is explained when relevant. Previous
cut-in history is labelled “直前” so it cannot be confused with an active constraint.
Game rules, transports, legal-move validation, and scoring are unchanged.

Verification: tests compare displayed strict-lock targets to engine validation (sets,
reversal, simultaneous effects, overlapping/non-overlapping runs and endpoints), check
immediate reconstructed-state rendering and lock removal, and cover spade-three.
Browser fixtures use the actual table component at 1280×800, 390×844, 390×667 and
844×390 with 8 seats and commit controls. The temporary fixture route is removed
before production build; its source is saved outside the repository in work/.

## Decisive cut-ins (2026-09-07)

Color: solid red/black/paper, no flashes. Typography: a dominant rule word and quiet
actor/consequence line, with a decorative outlined echo. Composition: opposing angled
bands above the pile; the current-rule panel and action rail remain available. Motion:
1900 ms for revolution/return, 1300 ms for smaller special actions, with a readable hold
and explicit exit. Ordinary turn updates do not remove or restart the active cue.
Only newer decisive cues or outcomes replace a major cue; no queue or game-clock delay.
Reduced motion uses the same timed static band. Simultaneous revolution and 11-back
explain the resulting normal order; finishing a player cannot hide a simultaneous
revolution. Ordinary all-pass sweeps update history without a dramatic cut-in.

The same guidance is installed in `japanese-game-ui/SKILL.md`. See `ASSET-AUDIT.md`
for the separate audio provenance/removal and attribution work.

## Player portraits (2026-09-07)

The former rounded warm portraits were only desaturated on the Daifugo table.
They are now eight original vector portraits, resolved from the existing avatar ID.
Color: solid ink / paper with a red diagonal accent. Typography: a bold italic
initial. Composition: asymmetric hair, headsets, a visor and angular jacket shapes,
with distinct silhouettes readable at 32px. Motion: no idle motion; the existing
seat turn emphasis and reduced-motion handling remain unchanged.

`DaifugoAvatar` is shared by the Daifugo table, Daifugo results and the Daifugo
branch of the friend-room lobby. Other games keep their existing avatars. Player
names remain visible and accessible; the portrait is decorative, not a second
spoken label. No profile IDs, selected avatars, scores or game/network behavior
are changed. All SVG geometry was authored in this fork; no external images,
franchise assets, or fonts were introduced.

Visual review: 8-portrait lineup at large/32px sizes, 4-seat desktop, 8-seat phone,
phone results with long names, phone lobby, and reduced-motion mode. Rare states
use a temporary local route rendering the real components, removed before build.

## Fade-away refinement (2026-09-07)

Scope: refine the eight existing Daifugo portraits, not the game layout. The old
images had a paper/red diagonal ground, fully drawn black bust and enclosing jaw,
white shirt, hair/eyes, an initial and peripheral graphic marks. Hair, eyes and
accessories already carry identity, so the closed coat silhouette is expendable.

- Color: retain the exact ink, paper and red palette. Paint the coat with the same
  opaque red as the ground, physically joining its shoulder/torso to the field.
- Typography: keep the initial, slightly smaller so the face stays primary.
- Composition: keep face coordinates, all eight hair/eye designs, diagonal direction
  and portrait slots. Open the left cheek into the paper background; retain a short
  right jaw shadow, individual collars and one pocket fold to imply the unseen coat.
- Motion: unchanged; fade-away here is a static positive/negative-space relationship,
  not opacity animation. No mask, blur, translucent erasure or added idle movement.

Removed the full black bust, enclosing face backing, cross-frame slash, corner
ornament and barcode. Removed the badge's continuous border; the existing seat name,
turn label and turn-scale cue still identify the active player. No game/rule/profile
or network state changes. The reference is the historical design principle, not a
copied artwork or a contemporary illustrator's style.

Reference: Library of Congress, Coles Phillips drawing:
https://wwws.loc.gov/rr/print/caption/captionphillips.html

Reviewed before/after at 124px with 32/48px reductions, the 8-seat phone table and
phone results with long names. A temporary local fixture renders actual components
and is removed before production build. The comparison image is stored outside the
repository as `outputs/fade-away-comparison.png`.

## Anime fade-away portraits (2026-09-07)

Replace all eight Daifugo portrait illustrations while preserving the existing
portrait slots, stable avatar IDs and their table/lobby/result relationships.
The preceding vector/fade-away sections describe earlier revisions.

- Color: scarlet red, ink black and warm ivory remain the dominant palette. Red
  clothing joins the red diagonal ground; pale hair also loses edges into ivory.
- Typography: remove portrait initials so eyes and facial expression are primary.
  Existing player names, turn labels and result typography remain unchanged.
- Composition: original adult anime women with distinct bob/star, braid/ribbon,
  bob/headphones, long hair/crescent, ponytail/flower, pixie/ear cuff, glasses and
  twin-tail/butterfly identities. Keep eyes, hair/accessories and collar fragments;
  omit enclosed shoulders and torso. No new framing or surrounding ornament.
- Motion: preserve existing turn emphasis and reduced-motion behavior. Fade-away
  is an opaque color/negative-space relationship, not transparency animation.

The eight illustrations were individually generated with the built-in OpenAI image
tool. The first is a style reference for the remaining seven, not a borrowed
franchise image. Exact prompts and source-file hashes are recorded in
`apps/web/src/assets/daifugo/avatars/provenance.json`. Original PNGs are retained
without visual postprocessing. Next.js static imports provide versioned URLs and
intrinsic aspect ratios; the existing PWA manifest includes the exported images.
Names remain the accessible labels, with decorative portraits hidden from screen
readers. Game logic, CPU decisions, networking, BGM and layout are unchanged.

Verification: all eight images load at 180px/32px; the actual 8-seat phone table,
phone lobby and phone result components retain readable names and no horizontal
overflow. Reduced-motion display checked. The five relevant suites pass all 24
tests; TypeScript and changed-component lint checks pass. Temporary fixture routes
are removed before the production build.

## Supplied character-sheet replacement (2026-09-07)

The user supplied an eight-character red/ivory/black illustration and requested
these exact characters. Replaced the preceding generated portraits with the
unchanged supplied JPEG. Color: retain source colors and lost-edge artwork.
Typography: keep player labels; frame out source headings/English fragments.
Composition: eight individually positioned square CSS windows retain faces and
identity anchors (ribbon, hat, ponytail, flower, glasses and held cards). Motion:
no changes to existing turn emphasis or reduced-motion behavior.

One shared 1280 × 853 JPEG replaces eight large PNGs. Static import hashing and the
existing PWA manifest version the asset. No redraw, image generation, pixel editing,
extra dependencies, game logic, profile IDs or layout changes. The shared component
applies to Daifugo play, lobby and results. Adjacent names remain accessible labels.
Source hash and crop coordinates are recorded in the avatar provenance file.
The earlier anime-generation section describes the replaced revision.

Verified all eight framing windows at 180px/32px and the actual phone table, lobby
and results. The browser loads one shared image; no horizontal overflow or console
errors. Relevant 24 tests, TypeScript and changed-component lint checks pass.
The temporary visual fixture is removed before production build.

## Complete secondary screens and sweep selection (2026-09-07)

Audit: Daifugo setup/table/results/credits already use the editorial palette.
The shared join, profile, create/waiting-room and portaled how-to-play surfaces
still used the original blue/glass treatment. Secondary routes now have a black
scrolling canvas and a red diagonal accent. Lobby styling is explicitly enabled
for Daifugo; the irrelevant background picker is hidden in its waiting room.
The profile selector now uses the same supplied character identities as play.

Color: black, red and ivory surfaces with visible neutral borders and focus rings.
Typography: heavy readable system headings and a large room code; retain semantic
text and existing localization. Composition: preserve field/control order and
responsive seats; remove translucent rounded panels and ornamental glow. Motion:
no new page animations; preserve reduced motion, turn cues and continuous audio.

Daifugo opponent backs and face-down flight cards display D. The shared card keeps
its previous default for other games. Pressed hand cards expose aria-pressed and
an ivory selection frame. A pointer sweep paints the first card's selection state:
start unselected to add, or selected to erase. The segment is sampled at 4px so fast
swipes cross narrow card slices; each card is visited once per stroke. Primary
pointer capture keeps the gesture owned by the hand. Cancellation, lost capture,
disabling, a new fx epoch and unmount end it. Ordinary keyboard/AT clicks still
work; the synthetic click after a pointer selection is suppressed. Hover fan
spreading is disabled only for this hand to keep the targets stable.

Selection continues to obey the existing required-count cap and legal-set check.
Neither swiping nor lifting the finger submits a move; the existing confirmation
button does. No engine rules, turn order, scoring, networking or audio changes.

Verification: 45 relevant tests pass, including fast/reverse strokes, caps, pointer
cancellation, secondary pointers, keyboard activation and engine-validated 7-give /
10-discard choices. Real Chromium mouse and CDP touch inputs at 390×844 and 1280×800
verify multi-select, erase, tap toggling and explicit confirmation. Phone join,
profile, guest/host lobby and portaled help are visually reviewed. Test routes are
removed before export; browser harnesses/screenshots stay outside the repository.


## Rank-based seating and legal-hand assistance (2026-09-07)

- Color: keep the existing red / black / ivory palette. A red top edge marks cards participating in a legal combination; a white outline and pressed state identify selection. Text and accessible labels explain both states.
- Typography: compact, readable Japanese for candidate counts, suit/rank selection and turn order. No new decorative display treatment around frequent choices.
- Composition: one assistance lane above the existing confirmation buttons; on tall portrait phones lower the action rail into the gap above the hand. Keep the pile and opponent row visible at 4–8 seats. Seats follow `state.seatOrder`, rotated around the local player at position zero; identities, scores and card ownership stay stable.
- Motion: reuse card selection feedback and the existing reduced-motion-aware seat layout transition. Hints and seat rearrangement never gate game progression.
- The optional `rank-up` preset selects `seatOrder: rank-ascending` and `nextLeader: last`. Each next deal reverses the complete previous finish order (including neutral ranks and eliminations). The original top-first `rank` setting remains available; independent leader settings are respected. A new match starts without previous ranks.
- Hints come exclusively from the local player's offered `playSet` moves. Cycle complete combinations with “出せる組を見る”; never dispatch until confirmation. Prefer non-penalty combinations, then larger sets and weaker strength; flag forbidden finishes explicitly. Partial manual selections narrow the highlighted cards to compatible complete sets. No opponent-hand inspection or alternate legality implementation.
- Verification: engine matches/replay and card conservation for 4–8 players, rank order / leader / exchange roles, special-rule hints, partial selections, candidate cycling, explicit confirmation, turn resets, local room flow, mobile and landscape browser checks.


## Declared joker roles and protected tribute (2026-09-07)

- Color / Typography: reuse red, black and ivory, Japanese body text and suit/rank labels. No new visual theme or raster assets.
- Composition: selecting a joker reveals a compact “ジョーカーの役割を指定” disclosure above the existing confirmation controls. Its bounded, scrollable panel contains a native select for each joker and a resolved-card/effect preview. Close it with the disclosure; the main action remains separate. The played pile records and displays the interpreted faces while retaining the real cards.
- Motion: immediate native input feedback; no additional animation or blocking delay. A changed event batch discards stale selection/declarations and unmounts the panel.
- `jokerAs` maps selected physical joker IDs to standard card IDs in the play payload. The engine validates held cards, declaration keys/values, size, kind, strength and locks. The same resolver serves application, bots, hints and effect previews. Auto mode completes same-rank sets or the weakest legal run; explicit declarations enable intentional ranks/suits and effects. With substituted effects enabled, a joker may represent spade-three for its counter, including automatic fallback against a lone joker.
- `jokerEffects` and `excludeJokersFromExchange` default ON. Staircase wildcard substitution defaults ON but still requires the staircase rule itself. Setting switches allow the old real-card-only effects and joker-inclusive tribute. Tribute exclusion is applied to the lower ranks' required gifts, not the upper ranks' freely chosen returns or 7-give effects.
- Engine tests cover declarations, endpoint/two-joker runs, locks, substituted effects, penalties, both tribute modes, CPU selection, deterministic replay and card conservation. UI tests cover explicit confirmation, stale declarations and disabled tribute jokers; mocked peer tests carry a declared joker through synchronization, guest reload and host migration. Browser fixtures verify an actual declared 8-cut and a completed joker-free tribute.

## Return paths stay in Daifugo (2026-09-07)

The Daifugo result's return action now points to `/daifugo` and still closes a finished friend room. Profile and join return links use the same destination. The former Parlour startup splash is no longer mounted. The root page reuses the existing Daifugo setup component, so direct visits and cached menu navigation cannot render the former beach-themed Parlour home. A missing or reloaded result uses the Daifugo palette and one explicit return action. Rematch behavior remains unchanged. Verified with result/room-close and menu-shell tests plus browser navigation against the exported app.
