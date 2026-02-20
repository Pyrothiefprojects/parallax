# Development

## Architecture
All modules use the IIFE revealing module pattern:
```js
const Module = (() => {
    // private state and functions
    return { /* public API */ };
})();
```
No build step, no imports — scripts load in dependency order via `<script>` tags. Module dependencies are resolved by load order in `index.html`.

## Play Mode

Press the **Play** button to enter play mode. The toolbar slides away and the game fills the full window:

- **Floating overlay buttons** — transparent Edit, Hint, and Inventory buttons float at the top-right corner of the game viewport
- **Radial inventory wheel** — right-click anywhere to open a circular wheel of collected inventory items; left-click an item to select it (cursor changes to item icon), click outside to dismiss; works in both the main scene and inside puzzle overlays
- **Cursor feedback** — default cursor for non-interactive areas, grab hand for interactive hotspots, item cursor when an item is selected
- **Inventory overlay** — click the inventory button to open a full grid panel; click an item to select it; click a hotspot that accepts that item to use it
- **Pick mode** — hotspots with move-asset actions enter pick mode: a ghost image follows the cursor, click a connected target hotspot to drop the asset there, ESC to cancel
- **Puzzle overlays** — open when a puzzle hotspot is clicked; interact with assets (rotate combo locks, type terminal commands, etc.); right-click to open the radial wheel inside puzzles
- **Dialogue box** — typewriter-animated text with frosted glass backdrop; click once to skip animation, click again to dismiss; action dialogues (pickup, accept item, move asset) auto-dismiss after 3 seconds, other dialogues auto-dismiss after 10 seconds; new dialogues immediately replace the current one
- **Hint system** — click the hint button to see the next hint from the progression list based on which flags the player has collected
- **State transitions** — hotspots and assets can trigger state changes with animated PNG frame sequences or embedded video transitions, swapping backgrounds and hotspot layouts
- **Loop animations** — continuously cycling frame overlays play on scene and puzzle hotspots, correctly scaled and positioned relative to the viewport
- **Background music** — scene music starts looping on the player's first click (browser autoplay restriction); crossfades smoothly when navigating to a scene with different music; stops when exiting play mode
- **Sound effects** — one-shot or looping audio plays when clicking hotspots, puzzle assets, or puzzle hotspots that have a sound assigned; looping sounds auto-stop on scene change or puzzle close
- **Clear after click** — one-time hotspots disappear after interaction (cursor no longer shows grab hand)
- **Clear group** — collecting an item clears all sibling hotspots across states that share the same item and spatially overlap, preventing duplicate collection
- **ESC** to close the radial wheel, exit pick mode, or return to edit mode (in that priority order)

## Animation Workflow
1. Create a transition video (e.g. cryo pod opening, door sliding) in any video tool or AI generator (Sora, etc.)
2. Rip the video into a PNG frame sequence using an external MP4-to-PNG converter (currently a local Java tool — planned as a built-in JS utility)
3. Use the **first frame** as the "before" state background and the **last frame** as the "after" state background — this keeps transitions visually seamless when navigating between states
4. Load the frame sequence into the state change transition panel and configure speed/reverse as needed
5. Optionally load the original video as an alternative to the PNG sequence (higher quality, larger file size)

This workflow ensures that state backgrounds match the transition endpoints exactly, so there's no visual pop when the animation starts or ends.

## Save / Load / Export
- **Save** — downloads a `parallax-project.json` file containing all scenes, items, puzzles, progression steps, images, animation frames, and videos (embedded as data URLs for portability)
- **Load** — upload a project JSON to restore the full editor state
- **Export** — generates `project-data.js` with path-based asset references instead of data URLs, ready for deployment alongside the asset files in `assets/`
- Includes backwards-compatible migration for older project formats

## Deployment
The exported game is fully static — no server-side code required.

1. **Export** the project from the editor (Export button in toolbar)
2. Place the exported `project-data.js` in `data/`
3. Place all asset files in the `assets/` folder structure matching the paths in the export
4. Host the entire folder on any static host (GitHub Pages, Netlify, etc.)

On load, the preloader scans all asset URLs from `window.PARALLAX_PROJECT`, preloads every image, video, and audio file in parallel with a progress bar, then auto-starts play mode.

### Live
- **Site:** [pyrothief.ca/parallax](https://pyrothief.ca/parallax/)
- **Repo:** [Pyrothiefprojects/parallax](https://github.com/Pyrothiefprojects/parallax)
- Hosted via GitHub Pages

## Dev Setup
- VS Code with Claude Code extension
- GitHub for version control and hosting
- Local dev via `python3 -m http.server`, Live Server, or `npx serve` (required for PNG export features like IsoMark compositor and Save Ruin)

## Puzzle Design — Ruin Codex

### Spindial as Player Tool

The spindial is the player's primary tool throughout the game — it's issued at the start, never lost, and serves as key, map, and ID.

**Setup:**
- Player wakes in a cryopod. The cryo symbol is visible above the pod in its correct orientation — this is the player's reference throughout the game.
- Inside the cryopod is a plate. Insert the plate into a machine and it issues a spindial, pre-loaded with the cryo symbol.
- The cryo symbol means: you're cryo crew, you have the map to cryo operations, and the spindial unlocks cryo doors/terminals.

**Spindial interactions:**
- Unlocks doors
- Interacts with terminals
- Loads ruinMarks (cards) found throughout the ship
- Each ruinMark is a piece of the ship map

**Puzzle flow:**
1. Player finds ruinMarks during exploration (navigation, weapons, shield, engine, etc.)
2. Load a ruinMark into the spindial via a terminal
3. Use the spindial on the codex (found in cryo operations, beside a terminal showing the cryo plate readout with all symbols)
4. The codex displays only the ruins the player has collected — empty slots are visible so the player knows how many remain
5. All positions are available to cycle through regardless of how many ruins are loaded
6. Player arranges the collected ruins into correct positions and orientations to form the ideogram
7. The completed ideogram IS the full map of the ship structure

**Cryo as reference:**
- Cryo's orientation is known from environmental cues (walls, lockers, doors, ruins throughout the ship)
- Cryo orbits with all other ruins but is exempt from coupling effects (lockOrientation / O)
- Acts as the player's compass — compare any ruin's orientation against cryo to gauge its state

**Symbol readout:**
- The terminal beside the codex shows the cryo plate with its symbol alongside the other symbols
- Symbols can be used together, so the readout looks complex
- But a player who's been paying attention to environmental cryo symbolism will recognize the correct orientation

## Puzzle Design — Forge Machine

The forge machine is a self-contained workstation the player interacts with to create and manage plates. It contains three components in one machine:

- **Isopress** — presses a ruinMark and an IsoPlate together to create an IsoMark. Editor tool built: place asset, link to codex, shows ruin at visual top (12 o'clock) with rotation/mirror transforms. Puzzle scene registration still needed.
- **Isolathe** — separates an IsoMark back into its component plates (ruinMark + IsoPlate). Editor tool exists as placeable asset; dev-mode clear behavior deferred for future expansion.
- **Screen** — a display with a slot for the player's spindial, allowing them to cycle through ruins and view their collection

### Plate Types & Process

| Asset | Description |
|-------|-------------|
| **blank_Mark** | Blank rectangular base plate (unpressed plate) |
| **ruinMark** | A blank_Mark with a ruin loaded onto it — created at another station, or found during exploration |
| **IsoPlate** | Hex gold plate |
| **IsoMark** | Finished product — a ruinMark and IsoPlate pressed together via the Isopress |

Blank plates (blank_Marks) can be found throughout the ship. The player combines a blank_Mark with a ruin at a separate station to create a ruinMark. Alternatively, completed ruinMarks can be found directly during exploration. To create an IsoMark, the player brings a ruinMark and an IsoPlate to the forge machine and uses the Isopress to press them together. The Isolathe reverses this — it separates an IsoMark back into a ruinMark and an IsoPlate.

## Known Issues
- **Allow Delete checkboxes share state** — all Allow Delete toggles (Scenes, Inventory, Puzzles, Ideograms) control the same `delete-enabled` class on the panel body. Checking one enables delete buttons across all sections. Works in practice since only one section is visible at a time, but the puzzle/ideogram views share a panel — checking Allow Delete in one persists when toggling to the other.
- **Disc/ruin orbit speed mismatch** — during drag-to-rotate, ruin boxes orbit at a different visual speed than the disc image because the disc rotation is computed from the mouse angular delta relative to the disc center, while ruins are positioned at their own orbital radius. Both receive the same angular delta but the visual perception differs. Ideally ruins should appear locked to the disc surface. Deferred for now — may revisit with a unified rotation model where ruins follow the disc image directly.

## Roadmap

The goal is to build **4–5 stories** using the Parallax engine, resulting in approximately **45 minutes to 1 hour of gameplay**.

The engine is feature-complete for game creation — the current focus is building the puzzle systems:

- **Ruin Codex** — the primary puzzle type, built using the ideogram editor. The ruin codex is designed to be a recurring puzzle mechanic reused across all stories. The codex tool (disc + spindial) is complete; remaining components are the IsoMark workspace, isopress, isolathe, and codex display.
- **Isopress** — a smaller puzzle type, mostly built via the IsoMark compositor. Needs puzzle scene registration and asset type wiring.
- **Third puzzle type** — TBD, one more smaller puzzle to round out the set.

All inventory items and puzzle assets are lined up for the current puzzle set.

## TODO
- [ ] Custom mouse cursors — replace default browser cursors with themed artwork (hand, magnifying glass, crosshair, etc.)
- [ ] Expand puzzle overlay theme — style the puzzle panel and background to match the game's atmosphere (frosted glass, glow effects, themed borders)
- [ ] Expand dialogue box theme — richer styling, character portraits or speaker names, multiple dialogue styles per context
- [ ] Sound effects: cryo pod lid opening — attach audio to the cryo pod state change transition
- [ ] Sound effects: console puzzle — keyboard typing sounds, error beep, success chime for the terminal asset
- [ ] **Ideogram Puzzle System** — the map puzzle is now the **Ideogram Puzzle**, built using the ideogram editor. Two workspace modes accessed via ideogram cards:
  - **Blank workspace** (current) — freeform canvas for building ideogram geometry, placing ruins, cutting, compositing, and general design work
  - [ ] **IsoMark Workspace** — a pre-organized workspace with designated areas for each puzzle component; selecting a card opens this structured layout where the puzzle components live together. The workflow: build an ideogram → cut ruins out of it → press ruinMarks with IsoPlates on the isopress to create IsoMarks → separate IsoMarks on the isolathe → reference the codex → use the spindial to cycle/flip/rotate ruins into position
  - Puzzle components (registered as puzzle asset types, similar to combo lock):
    - [~] **Isopress** — editor tool built (place asset, link to codex, shows ruin at visual 12 o'clock with rotation/mirror transforms via stable imageCache lookup); still needs puzzle scene and asset type registration
    - [~] **Isolathe** — editor tool exists as placeable asset; dev-mode clear behavior deferred; still needs puzzle scene and asset type registration
    - [x] **Spindial Mechanism** — built as the Codex tool: disc codex with slot boxes for cycling ruins, spindial overlay for rotating the linked ruin, drag-to-rotate gesture, cardinal direction snapping, dev lock mode, solve lock, 3-tier coupling system (disc-orientation, linked spindial, mirror) with per-slot lock controls and smooth coupling animation
    - [ ] **Codex Display** — displays the ideogram geometry for the player to reference while working
  - Plate assets (blank_Mark, ruinMark, IsoPlate, IsoMark) already exist; isopress and isolathe just need puzzle scenes and registration as puzzle parts
- [ ] **Rename ideogram tools** — current tool names in the ideogram section are confusing; needs a clarity pass to make tool purposes more obvious
- [ ] **Two-finger scroll rotation** — hover over a codex/spindial in dev lock mode and use two-finger trackpad scroll to rotate it (alternative to click-drag-rotate); uses the existing `wheel` event

## Build Log
- **Session 1:** 2:00 AM – 5:00 AM, Feb 11 — Core engine (scenes, hotspots, inventory, puzzles, play mode, game state)
- **Session 2:** 4:00 PM – 10:00 PM, Feb 11 — Puzzle assets, combo lock, asset grouping, puzzle hotspots, action config unification, dialogue fixes, state change toggles, scene image generation (Sora), transition animation planning
- **Session 3:** 12:00 AM – 6:00 AM, Feb 12 — Transition animations (PNG sequences + video), loop animations with placement/scale/reverse, reverse frames for state transitions, edit scene backgrounds, cleaned up export method and setup website.
- **Session 4:** 6:30 AM - 9:00 AM, Feb 12 — Export system with path-based asset references, asset preloader with progress bar, deployment to GitHub Pages
- **Session 5:** 9:00 AM - 1:00 PM, Feb 12 — Audio system (per-scene background music, per-action sound effects, looping sounds), cursor fixes, puzzle ID fix, music save/export fix, play mode toolbar redesign, typewriter dialogue box, console terminal puzzle asset type
- **Session 6:** Feb 13–14, ~14 hours — Scene assets system (per-state positioning, visibility, layering, flip H/V, fade transitions), hotspot connections, move asset with pick mode, asset show/hide actions, clear after click and clear group (sibling hotspot clearing), solve puzzle action type, image editor with 16:9 crop tool, dialogue timing overhaul (configurable duration, immediate replacement), play mode UI overhaul (hidden toolbar, floating overlay buttons, right-click radial inventory wheel with puzzle overlay support), canvas ResizeObserver
- **Session 7:** Feb 16, ~7 hours — Blueprint spatial editor (grid canvas, 6 placement tools with tool toggle behavior, spatial detection, scene inheritance, smart config popover positioning, categorized list view, item drag-to-reposition, panel integration), puzzle component prototyping
- **Session 8:** Feb 17–18, ~13 hours — Ideogram editor (ruin library with multi-file select, radial wheel placement at natural image size, rotation dial with mirror/delete, free-form resize with 8 handles and aspect ratio lock, color tool with 5 modes and popover, two-phase cut tool with move/cut context menu and offscreen capture, text tool with inline editor and word-wrap, save ruin as PNG with File System Access API, zoom slider with ctx.scale transform, custom dark-themed scrollbars with content-aware panning and mouse wheel support, grid toggle controlling snap behavior, tool locking, movable text elements, ideogram cards with CRUD, data persistence in save/load/export, puzzle panel view swapping, IsoMark preview fix, Create Ideogram tool with Line and Circle sub-tools (angle-constrained lines, ring circles, shape selection/drag/resize/delete, color/thickness popover, Save Ideogram as PNG), polygon cut tool (N-point polygon selection with grid snap, canvas clipping for non-rectangular cuts), removed Ruin Box tool)
- **Session 9:** Feb 18–19, ~8 hours — Codex puzzle tool (disc codex with ellipse-positioned slot boxes and angular skew, spindial variant with linked rotation, ruin assignment via file picker, ruin scale slider, solve lock save/clear, config panel with slot grid), drag-to-rotate gesture (angular delta tracking with discrete slot shifting for discs and continuous rotation for spindials, dragOffset for smooth visual feedback), cardinal direction snapping for spindial rotation on release, Dev lock mode (canvas freeze checkbox, rotation-only interaction without selection), save persistence fix (file path storage pattern replacing dataURLs to survive stripDataUrls export filter, loadIdeogramData cache clearing and switchIdeogram fix), ellipse hit testing for spindials, dead code cleanup (removed animation function and rotate button handlers)
- **Session 10:** Feb 19, ~6 hours — Codex coupling system (disc-orientation coupling rotates all unlocked ruins 90° on disc shift, linked spindial coupling rotates opposite ruin, mirror coupling flips unlocked ruins on disc shift), 3-tier difficulty (basic/medium/hard), per-slot lock controls (P locks slot content, O exempts from coupling, Pin fixes ruin to screen position), pin position with gate effects (gate rotate +90° and gate flip on ruin passing pinned position), smart greying logic (invalid combos auto-disabled), difficulty legend in config panel, smooth orientDragOffset animation for coupling during drag, unified codex/spindial config panel, documentation restructure (README split into docs/ folder with 5 linked pages)
- **Session 11:** Feb 20, ~8 hours (continuing) — Isopress overlay system (stable imageCache lookup via ruinLibrary matching instead of broken slotImageCache, visual top slot calculation using disc rotation for 12 o'clock position, rotation/mirror transform display on isopress), spindial topIndex fix (mousemove and snap target the visual 12 o'clock slot instead of hardcoded slots[0]), Isopress and Isolathe editor tools (place asset, convert, boundary box, config panel, save/load), cleanup (removed pressRuinCache, updateLinkedPresses, currentOverlay, reverted rebuildSlotImageCache to simple version), full naming convention rename (cypher→codex, press→isopress, lathe→isolathe, plate naming: blank_Mark/ruinMark/IsoPlate/IsoMark), size slider for codex/isopress/isolathe config panels, isopress ruin overlay scale/offset controls, documentation updates, forge machine scene construction with puzzle
- **Total build time:** ~76 hours (so far)
