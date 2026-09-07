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
