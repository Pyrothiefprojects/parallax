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

## Image Loading Convention

All image loading in this codebase uses the same pattern — **always use this, never use `fetch` or blob URLs**:

```js
const cached = typeof Preloader !== 'undefined' && Preloader.getImage(src);
if (cached) { callback(cached); return; }
const img = new Image();
img.onload = () => callback(img);
img.src = src;
```

Or as a Promise (used in `canvas.js`):

```js
const img = new Image();
img.onload = () => resolve(img);
img.onerror = reject;
img.src = src;
```

**Rules:**
- Check `Preloader.getImage(src)` first if a callback is available — avoids redundant loads
- Set `img.src` directly — no `fetch`, no `URL.createObjectURL`, no blob conversion
- If a new image type is added, register its URLs in `Preloader.collectUrls()` so it gets preloaded at startup

The Preloader loads all images before the game starts. Any image not registered there will load on-demand — which works but causes a pop-in delay the first time it's needed.

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

- **Isopress** — presses a ruinMark and an IsoPlate together to create an IsoMark. Editor tool built: place asset, link to codex, shows ruin at visual top (12 o'clock) with rotation/mirror transforms. Puzzle scene integration done via activateForPuzzle overlay. Config panel shows current symbol name from linked codex and supports locking — lock captures the current ruin (image, rotation, flip) so it persists while the codex continues to rotate, allowing multiple isopresses on the same codex to each lock different symbols. Size slider resizes from center. "Ruin on top" draws the ruin symbol above all other elements; "Hide plate" hides the hex plate image (dashed border shown in editor mode). Combined, these allow using locked isopress ruins as a transparent superimposition layer — the ruins render directly on top of whatever is beneath without the plate obstructing. Useful for compositing ruin symbols onto other visuals (reference displays, environmental art, terminal readouts, etc.).
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

## Puzzle Design — Ideogram Console

The ideogram console is a composed interactive display that the player uses to assemble and solve the ideogram puzzle over the course of the game. It's built entirely from existing editor components arranged in the ideogram editor:

**Components:**
- **Codex disc** — holds the ruin slots, linked to a spindial. As the player loads ruins onto the spindial, they reflect onto the disc.
- **Spindial** — overlaid on the codex. The player loads collected ruinMarks here via terminals. The spindial feeds the codex.
- **Transparent isopresses** — one per ruin position, each linked to the same codex. Configured with `hideAsset` (no plate visible), `ruinOnTop` (draws above everything), and `useOriginalScale` (preserves native image proportions). Each isopress is positioned to match its ruin's place in the solved ideogram.

**How it works:**
1. Designer builds the console in the ideogram editor — arranges the codex, spindial, and isopresses into the solved layout with a background.
2. Each isopress can be locked to a specific ruin symbol, or left unlocked to follow the codex's current top slot.
3. In-game, the player collects ruins during exploration and loads them onto the spindial at terminals.
4. Loaded ruins reflect from the spindial → codex disc → isopresses, appearing as superimposed symbols on the console.
5. As the player collects more ruins, the ideogram fills in progressively — empty positions remain blank.
6. The player rotates, flips, and arranges ruins on the codex to match the solved configuration.

**Design intent:** The console is a persistent reference the player returns to throughout the game. It visualizes progress — each new ruin adds a piece to the map. The transparent superimposition lets the ruins composite directly onto a background (environmental art, terminal display, etc.) without plate assets obstructing the view.

**Editor prototype:** "Ideogram Test" — codex ring with 5 ruin slots, spindial overlaid, 5 transparent isopresses positioned to show the solved ideogram. All isopresses use original scale at 25% with ruin-on-top and hidden plates.

**TODO:** Runtime ruin loading — currently ruins are pre-loaded in the editor. Need a mechanism for the player to load ruins onto the spindial in-game, which then populates empty codex slots and makes them visible on the corresponding isopresses.

## Puzzle Design — Prismatic

A light beam reflection puzzle built on the shared blueprint canvas. The designer creates beam routing challenges using sources, mirrors, filters, targets, and walls.

**Elements:**
- **Source** — emits a beam in a direction. Yellow circle with direction arrow. Drag the arrow tip handle to aim.
- **Mirror** — reflects beams. Line segment that can be freely rotated via drag handle. Can be locked (fixed in play mode). Can be assigned a color — reflecting changes the beam to that color.
- **Filter** — beam passes through without reflecting, but changes the beam color. Dashed line segment with diamond center indicator. Always has a color assigned.
- **Target** — bullseye goal. Red when unhit, green when a beam reaches it. All targets must be hit to solve.
- **Wall** — blocks beams. Two-click placement for start and end points.

**Color system:**
- Beams start as cyan (#00e5ff)
- Mirrors can optionally be assigned a color from 7 presets (red, green, blue, yellow, magenta, orange, cyan)
- Reflecting off a colored mirror changes the beam to that color
- Passing through a filter changes the beam to the filter's color
- Each beam segment renders in its current color with matching glow

**Beam tracing algorithm:**
- Ray cast from each source in its direction
- Find nearest intersection with any mirror, filter, wall, or target
- Mirror hit → reflect (angle of incidence = angle of reflection), optionally change color, continue
- Filter hit → beam passes through in same direction, change color, continue
- Wall hit → beam stops
- Target hit → mark target as hit, beam stops
- Max 50 bounces safety limit

**Editor tools:** Select, Source, Mirror, Target, Wall, Filter, Delete

**Config panels:**
- Mirror: locked checkbox, length slider (30–160), color swatches (7 presets + none)
- Filter: length slider (30–160), color swatches (7 presets, no "none" — filters always have a color)

**Scramble:** Randomizes movable mirror angles. Player rotates mirrors to guide beams to all targets. Solved flash when all targets hit.

## Puzzle Design — Clockwork

A gear chain puzzle built on the shared blueprint canvas. The designer creates gear routing challenges where the player must place gears of the right sizes on pegs to connect a driver to an output.

**Elements:**
- **Peg** — an axle point where a gear can sit. Has a role: Normal, Driver, or Output. Only one driver and one output per puzzle.
- **Gear** — sits on a peg. Has a configurable radius (15–60). Procedurally rendered with teeth, spokes, hub, and axle hole. Can be locked (stays during scramble).

**Meshing:**
- Two gears on adjacent pegs mesh when `|distance - (radius1 + radius2)| < 5px`
- Meshing gears rotate in opposite directions
- Speed scaled by gear ratio: `neighborSpeed = -parentSpeed * (parentRadius / neighborRadius)`

**Chain detection:** BFS from driver peg through meshing neighbors. Connected gears spin; disconnected gears are static.

**Gear rendering:**
- Tooth count = `max(8, round(2π * radius / 10))`, tooth height = 6px
- Alternating inner/outer radius points create gear silhouette
- Spokes drawn for gears with radius > 25
- Colors: Driver = green, Output = amber, Connected = blue-gray, Disconnected = dark gray

**Scramble:** Removes unlocked gears from pegs into a pool area at the bottom of the canvas. Pool gears are rendered at 60% scale with radius labels. Player drags gears from pool onto empty pegs — snap when within 20px of peg center. Click a placed unlocked gear to pick it back up into the pool.

**Solve check:** Pool empty AND output peg connected to driver through meshing gear chain.

**Editor tools:** Select, Peg, Gear (toggle on/off), Delete

**Config panel:** Role buttons (Normal/Driver/Output), Has Gear checkbox, Gear Radius slider, Locked checkbox.

## Known Issues
- **Allow Delete checkboxes share state** — all Allow Delete toggles (Scenes, Inventory, Puzzles, Ideograms) control the same `delete-enabled` class on the panel body. Checking one enables delete buttons across all sections. Works in practice since only one section is visible at a time, but the puzzle/ideogram views share a panel — checking Allow Delete in one persists when toggling to the other.
- **Puzzle asset delete button non-functional** — clicking the Delete button in the puzzle asset config popover does nothing. Likely cause: when a puzzle has a linked ideogram, `activateForPuzzle` sets the ideogram canvas to `pointer-events: auto` (ideogram-editor.js:4913), and the canvas sits on top of the asset layer in DOM order, potentially intercepting clicks. May also be a stale `activePuzzle`/`activeState` reference in PuzzleAssets. Needs investigation.
- **Disc/ruin orbit speed mismatch** — during drag-to-rotate, ruin boxes orbit at a different visual speed than the disc image because the disc rotation is computed from the mouse angular delta relative to the disc center, while ruins are positioned at their own orbital radius. Both receive the same angular delta but the visual perception differs. Ideally ruins should appear locked to the disc surface. Deferred for now — may revisit with a unified rotation model where ruins follow the disc image directly.

## Roadmap

The goal is to build **4–5 stories** using the Parallax engine, resulting in approximately **45 minutes to 1 hour of gameplay**.

The engine is feature-complete for game creation — the current focus is building the puzzle systems:

- **Ruin Codex** — the primary puzzle type, built using the ideogram editor. The ruin codex is designed to be a recurring puzzle mechanic reused across all stories. The codex tool (disc + spindial) is complete; remaining components are the IsoMark workspace, isopress, isolathe, and codex display.
- **Isopress** — a smaller puzzle type, mostly built via the IsoMark compositor. Needs puzzle scene registration and asset type wiring.
- **Ruinscope** — a node-swap untangle puzzle (inspired by WoW's Blingtron Circuit / Ley Line puzzles). Nodes arranged in a loop, each connected to exactly 2 neighbors. The solved state is a clean closed polygon with no line crossings. The scrambled state shuffles node positions so lines tangle. Click two nodes to swap them — their connections travel with them, redrawing lines from new positions. Red lines = crossing another line, blue/glowing lines = clean. All lines clean = solved. Pulsing feedback intensifies as crossings decrease. In-world context: power routing, ley line alignment, or circuit repair.
- **Prismatic** — a light beam reflection puzzle. The designer places beam sources, mirrors, color filters, targets, and walls on a canvas. Beams trace from sources, reflect off mirrors, stop at walls, and hit targets. Mirrors can be assigned colors — reflecting a beam off a colored mirror changes the beam color. Filters are transparent segments the beam passes through (no reflection) that change the beam color. Scramble randomizes movable mirror angles; the player rotates mirrors to guide beams to all targets. In-world context: optics calibration, laser routing, light-based locks.
- **Clockwork** — a gear chain puzzle. The designer places pegs (axle points) and gears of different sizes to create a mechanical chain from a driver gear to an output gear. Gears mesh when their edges touch (distance between peg centers ≈ sum of radii). Meshing gears rotate in opposite directions with speed scaled by gear ratio. Scramble removes unlocked gears into a pool; the player drags gears from the pool onto empty pegs to rebuild the chain. Solved when the output gear is connected to the driver through meshing gears. In-world context: engine repair, mechanical locks, power transmission.

All inventory items and puzzle assets are lined up for the current puzzle set.

## TODO
- [ ] Custom mouse cursors — replace default browser cursors with themed artwork (hand, magnifying glass, crosshair, etc.)
- [ ] Expand puzzle overlay theme — style the puzzle panel and background to match the game's atmosphere (frosted glass, glow effects, themed borders)
- [ ] Expand dialogue box theme — richer styling, character portraits or speaker names, multiple dialogue styles per context
- [ ] Sound effects: cryo pod lid opening — attach audio to the cryo pod state change transition
- [ ] Sound effects: console puzzle — keyboard typing sounds, error beep, success chime for the terminal asset
- [x] **Ideogram Puzzle System** — the map puzzle is now the **Ideogram Puzzle**, built using the ideogram editor. The ideogram canvas IS the workspace — codices, isopresses, and isolathes are placed directly on it, then the whole ideogram is activated on a puzzle canvas via activateForPuzzle. The workflow: build an ideogram → cut ruins out of it → press ruinMarks with IsoPlates on the isopress to create IsoMarks → separate IsoMarks on the isolathe → reference the codex → use the spindial to cycle/flip/rotate ruins into position
  - Puzzle components:
    - [x] **Isopress** — editor tool built (place asset, link to codex, shows ruin at visual 12 o'clock with rotation/mirror transforms via stable imageCache lookup); puzzle scene integration done via activateForPuzzle overlay
    - [x] **Isolathe** — editor tool exists as placeable asset; dev-mode clear behavior deferred; puzzle scene integration done via activateForPuzzle overlay
    - [x] **Spindial Mechanism** — built as the Codex tool: disc codex with slot boxes for cycling ruins, spindial overlay for rotating the linked ruin, drag-to-rotate gesture, cardinal direction snapping, dev lock mode, solve lock, 3-tier coupling system (disc-orientation, linked spindial, mirror) with per-slot lock controls and smooth coupling animation
    - [x] **Codex Display** — the codex and isopress plate serve as the player's reference display; no separate display component needed
  - Plate assets (blank_Mark, ruinMark, IsoPlate, IsoMark) already exist
- [ ] **Codex solve check** — `solvedSlots` snapshot is saved when the designer clicks "Lock" in the config panel, but no runtime comparison exists yet. The slots array physically reorders during disc rotation (pop/unshift for CW, shift/push for CCW), and all coupling, gates, and lock controls operate on this live array — everything lines up and gates work correctly regardless of the initial load order. The method of solving the codex puzzle is intentionally left open: the designer sets a solved state, but how the runtime checks the player's arrangement (index-based, identity-based, or hybrid) is still to be decided.
- [ ] **Puzzle completion rewards** — reward item and reward scene state fields exist on puzzle cards but runtime never grants the item or triggers the scene state change on solve; rewards may need different handling than pickup items — TBD
- [ ] **Rename ideogram tools** — current tool names in the ideogram section are confusing; needs a clarity pass to make tool purposes more obvious
- [ ] **Two-finger scroll rotation** — hover over a codex/spindial in dev lock mode and use two-finger trackpad scroll to rotate it (alternative to click-drag-rotate); uses the existing `wheel` event
- [ ] **Isopress ruin auto-centering** — ruin symbols on the isopress plate are not visually centered because the ruin image content may not be centered within its image bounds. The code centers the image rectangle, but transparent padding causes the visible symbol to appear off-center, and the offset shifts at different rotation angles since rotation pivots around the image center rather than the content center. A content-bounds approach (`getImageData` to find non-transparent pixel bounds) was attempted but `getImageData` throws CORS errors when running without a server, which crashes the IdeogramEditor IIFE. Needs a CORS-safe solution — options: pre-compute content bounds during ruin library import (when the image is read via FileReader as dataURL, avoiding CORS), store the offset on the ruin library entry, or use a server-only fallback. Manual Ruin Offset X/Y sliders work as a temporary workaround.
- [x] **Scale ruin images from original size** — "Original scale" checkbox in isopress config. When enabled, the Ruin Scale slider applies as a percentage of the image's native dimensions instead of fitting to the plate size. Each ruin retains its natural proportions and relative size differences.
- [ ] **Build ruinMark items** — create the cryo ruinMark and engine ruinMark as inventory items with art assets. These are the physical cards the player finds and loads onto the spindial at the terminal. Needed before wiring up the terminal loading interaction.
- [ ] **Terminal ruin loading interaction** — wire up the terminal puzzle so the player can use a ruinMark item on it to load the ruin onto the spindial. Consumes the ruinMark from inventory and adds the symbol to the persistent spindial ruin set.
- [ ] **Spindial persistent ruin set** — the spindial's loaded ruins need to persist in GameState across scenes and puzzles. When the player loads a ruinMark onto the spindial at a terminal, the ruin set is saved. Any puzzle that uses the spindial (isopress, isolathe, ideogram console) should load from this saved set so the player can choose which ruin to press/lathe/view. The spindial is the player's portable ruin collection — it travels with them everywhere.
- [ ] **Codex runtime state persistence** — the ideogram currently doesn't reflect its locked ruins at runtime. Need a way to save/load the state of codex slots (which ruins are loaded, their orientations) during gameplay so ruins can be added to the codex in-game and persist across scenes. Exact approach TBD.
- [ ] **Prismatic scene integration** — wire prismatics for use in scenes as puzzle hotspots. The designer should be able to assign a prismatic to a puzzle panel so the player encounters the beam reflection puzzle in-game.
- [ ] **Clockwork scene integration** — wire clockworks for use in scenes as puzzle hotspots. The designer should be able to assign a clockwork to a puzzle panel so the player encounters the gear chain puzzle in-game.
- [ ] **Ruinscope scene integration** — wire ruinscopes for use in scenes as puzzle hotspots. The designer should be able to assign a ruinscope to a puzzle panel so the player encounters the untangle puzzle in-game. Needs: puzzle overlay rendering, solve detection triggering game state flags, and saving the solved state.
- [ ] **Align file pickers with asset directories** — all file picker menus should save and load from the correct default directories for their asset type. Current mapping: scenes → `assets/scenes/`, items → `assets/items/`, puzzle backgrounds → `assets/puzzles/`, puzzle pieces (ruins, codex, spindial, plates) → `assets/puzzles/pieces/`, audio → `assets/audio/`, transitions → `assets/transitions/`. Each file picker should default to the appropriate directory for its context.

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
- **Session 11:** Feb 20, ~12 hours — Isopress overlay system (stable imageCache lookup via ruinLibrary matching instead of broken slotImageCache, visual top slot calculation using disc rotation for 12 o'clock position, rotation/mirror transform display on isopress), spindial topIndex fix (mousemove and snap target the visual 12 o'clock slot instead of hardcoded slots[0]), Isopress and Isolathe editor tools (place asset, convert, boundary box, config panel, save/load), cleanup (removed pressRuinCache, updateLinkedPresses, currentOverlay, reverted rebuildSlotImageCache to simple version), full naming convention rename (cypher→codex, press→isopress, lathe→isolathe, plate naming: blank_Mark/ruinMark/IsoPlate/IsoMark), size slider for codex/isopress/isolathe config panels, isopress ruin overlay scale/offset controls, documentation updates, forge machine scene construction with puzzle, **ideogram-to-puzzle integration** (activateForPuzzle/deactivateForPuzzle on overlay canvas, deep-copy arrays with image preloading, viewport offset for coordinate mapping, puzzle mode render path skipping editor-only elements, config panel z-index fix for puzzle overlay, mouse pass-through for missed clicks, editor state save/restore, puzzle ideogramState persistence, ideogram dropdown and remove button in puzzle tools panel, getContentBounds fix for codex/isopress/isolathe scroll clamping, Delete key support for all element types)
- **Session 12:** Feb 23 — Isopress original scale mode ("Original scale" checkbox scales ruins from native image dimensions instead of plate-fit), puzzle asset uniform resize slider (replaced separate Width/Height inputs with single percentage-based Size slider preserving aspect ratio via originalWidth/originalHeight), puzzle asset CSS fix (`.puzzle-asset img { max-width: none }` — assets were resizing based on distance from container edge due to inherited `max-width: 100%` on absolutely positioned elements), ideogram multi-select (drag-to-select in select mode draws cyan dashed selection rect, center-point detection for codices/isopresses/isolathes, group drag with delta from start positions, Escape to clear), persistent element groups (floating Group/Ungroup button after multi-select, `groupId` property on elements, auto group-drag when clicking any grouped element finds all members by groupId, orange dot indicator on grouped elements, persists through save/load/puzzle mode via spread operator), codex runtime state persistence TODO
- **Session 13:** Feb 24 — Prismatic puzzle editor (beam source/mirror/target/wall placement, ray casting beam tracing with reflection, glow rendering, scramble/reset, mirror config with locked/length, solved flash), Prismatic color system (color property on mirrors, filter element type with pass-through color change, per-segment beam color tracking, color swatches UI with 7 presets), Clockwork puzzle editor (peg/gear placement, procedural gear rendering with teeth/spokes/hub, mesh graph with distance-based gear meshing, BFS chain detection, rotation animation with gear ratios, gear pool with drag-to-snap placement, scramble/reset, peg config with role/radius/locked), toolbar integration for both (toggle buttons, 5-way mutual exclusion, card lists, export/import)
- **Total build time:** ~83 hours (so far)
