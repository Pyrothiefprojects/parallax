# Parallax

> **Parallax is source-available, not open source. See [LICENSE](LICENSE) for terms.**

## What It Is
Parallax is a browser-based point-and-click puzzle game editor and engine built entirely in vanilla JavaScript. It includes a visual editor for designing scenes, hotspots, inventory items, interactive puzzles, and game progression — and a built-in play mode for testing the whole thing as a player would experience it.

## How It Works
- Single HTML page — no frameworks, no bundler, no server required
- Visual editor with toolbar sections for Scenes, Hotspots, Inventory, Puzzles, Game State, and Image
- Scenes with polygon hotspot zones, multiple states, transition animations, and background music
- Unified action system shared across scene hotspots, puzzle hotspots, and puzzle assets
- Progression system with ordered hint steps tied to auto-generated flags
- Projects save/load as JSON; export produces deployment-ready `project-data.js` with path-based asset references
- Asset preloader with progress bar on startup

## Tech Stack
- **HTML** — single page shell
- **JavaScript** — engine, editor modules, all game logic (IIFE modules, no build step)
- **CSS** — dark theme UI (pyrothief.ca aesthetic)
- **Canvas API** — scene rendering, asset compositing, hotspot polygon drawing and hit-testing, ideogram editor
- **SVG** — puzzle hotspot rendering within puzzle overlays, connection lines
- **PNG / WebP / JPEG** — scene backgrounds, puzzle graphics, item icons, animation frames
- **MP4 / WebM** — optional video transitions for state changes
- **MP3 / WAV / M4A / AAC** — background music and sound effects (HTML5 Audio)
- **File System Access API** — save ruin images directly to disk (Chrome/Edge)

## Project Structure
```
/parallax
├── index.html                  # Single page app shell
├── css/
│   └── editor.css              # All styling (dark theme, panels, overlays, animations)
├── js/
│   ├── app.js                  # Bootstrap, preloader, auto-load
│   ├── canvas.js               # Canvas rendering, fit-to-screen, coordinate transforms, scene assets
│   ├── scene-manager.js        # Scene CRUD, states, drag reorder, import/export, hotspot connections
│   ├── hotspot-editor.js       # Polygon drawing, selection, drag handles, popover config, connections
│   ├── inventory-editor.js     # Item management, item card UI, use counts
│   ├── puzzle-editor.js        # Puzzle management, states, rewards config, clue toggle
│   ├── puzzle-assets.js        # Asset type registry, placement, grouping, solve logic
│   ├── puzzle-hotspot-editor.js# Polygon hotspots within puzzle overlays (SVG)
│   ├── action-config.js        # Shared action dropdown, state change, loop, sound, asset change, move asset UI
│   ├── transition-player.js    # PNG frame sequence and video playback for state transitions
│   ├── loop-animator.js        # Continuous frame loop overlays (scene and puzzle modes)
│   ├── audio-manager.js        # Background music and sound effect playback (HTML5 Audio)
│   ├── game-state.js           # Flags, inventory, scene/puzzle state, progression, asset/hotspot clearing
│   ├── play-mode.js            # Play mode runtime (actions, cursors, overlays, dialogue, radial wheel)
│   ├── blueprint-editor.js     # Blueprint spatial planning canvas (grid, tools, scene inheritance, item drag)
│   ├── ideogram-editor.js      # Ideogram ruin puzzle editor (placement, rotation, color, cut, resize, text)
│   ├── image-editor.js         # Image loading, preview, and 16:9 crop tool
│   ├── preloader.js            # Asset preloader with progress bar
│   ├── toolbar.js              # Toolbar sections, panel rendering, mode switching, save/load/export
│   └── assets/
│       ├── combo-lock.js       # Combo lock puzzle asset type
│       └── console-terminal.js # Console terminal puzzle asset type
├── assets/                     # All game assets (images, frames, videos, audio)
│   ├── scenes/                 # Scene background images
│   ├── items/                  # Inventory item icons
│   ├── puzzles/                # Puzzle background images
│   ├── transitions/            # PNG frame sequences and video clips
│   └── audio/                  # Background music and sound effect files
├── data/
│   └── project-data.js         # Exported project data (path-based asset references)
├── docs/                       # Documentation
│   ├── scenes-hotspots.md      # Scenes, scene assets, hotspots, connections, action system
│   ├── inventory-puzzles.md    # Inventory, puzzles, puzzle asset types
│   ├── ideogram-editor.md      # Ideogram editor, codex tool
│   ├── gamestate-image.md      # Game state, blueprint editor, image editor
│   └── development.md          # Architecture, play mode, save/load, deployment, TODO, build log, roadmap
└── README.md
```

## Editor Features

- **[Scenes & Hotspots](docs/scenes-hotspots.md)** — scene management with states, scene assets with per-state positioning/visibility/layering, polygon hotspot drawing with popover config, hotspot connections, and the unified action system
- **[Inventory & Puzzles](docs/inventory-puzzles.md)** — item management with use counts, puzzle overlays with interactive asset placement and grouping, puzzle hotspots, multi-state puzzles, and puzzle asset types (combo lock, console terminal)
- **[Ideogram Editor](docs/ideogram-editor.md)** — ruin-based puzzle editor with asset codex, radial wheel placement, rotation/resize/color tools, ideogram drawing (lines, circles), cut tool (rectangle and polygon), text tool, IsoMark compositor, zoom, and the codex tool (disc/spindial rotation puzzles with drag-to-rotate, dev lock, 3-tier coupling system, pin position with gate effects, and per-slot lock controls)
- **[Game State & Image](docs/gamestate-image.md)** — flags, progression hints, level overview, blueprint spatial planning editor with 6 placement tools, and image editor with 16:9 crop

## Play Mode
Press Play to enter game mode — the toolbar hides, floating overlay buttons appear, and the game fills the window. Right-click for a radial inventory wheel, interact with hotspots and puzzle assets, and follow the hint progression. Full details in [development docs](docs/development.md#play-mode).

## Links
- **Site:** [pyrothief.ca/parallax](https://pyrothief.ca/parallax/)
- **Repo:** [Pyrothiefprojects/parallax](https://github.com/Pyrothiefprojects/parallax)

## Development
See [docs/development.md](docs/development.md) for architecture, animation workflow, save/load/export, deployment, known issues, TODO, build log, and project roadmap.
