# Ideogram Editor

A standalone ruin-based puzzle editor for creating alien symbol layouts. Accessed via the **Ideogram** toggle button at the top of the Puzzle panel (swaps between puzzle cards and ideogram cards, same pattern as Game State / Blueprint).

- **Shared canvas** — uses the same canvas as Blueprint editor; activating one deactivates the other
- **White canvas** with optional grey reference gridlines (toggle in tools panel)
- **Asset Codex** — load PNG images as reusable ruin symbols via the "+ Add" button (multi-file select)
- **Radial wheel placement** — select the Asset tool, click the canvas, pick a ruin from the radial wheel; places at the image's natural pixel dimensions (not grid-constrained)
- **Rotation dial** — select a placed ruin or drawn shape to show circular rotation buttons (0°, 90°, 180°, 270°), mirror toggle, and delete button
- **Select mode resize** — selecting any element (ruin, text, or box) shows 8 drag handles (corners + edges); drag to resize with no grid constraint (snaps to grid only when grid is visible); "Lock Aspect" checkbox (default ON) constrains resize to maintain the original width/height ratio; handles and selection border rotate with the element
- **Color tool** — click a ruin with the Color tool active to open a popover with:
  - Native color picker
  - 5 modes: None, Transparency (opacity slider), Background (colored rect behind image), Tint (multiply blend), Full Color (silhouette replacement)
  - Live preview on every change
- **Ideogram tool** — drawing tool for constructing ideogram geometry from basic shapes:
  - **Sub-tools**: Line and Circle, selectable from a sub-tool row that appears when the tool is active; clicking an active sub-tool deselects it
  - **Grid auto-show** — activating the tool automatically enables the grid; restores previous grid state when switching away
  - **Line tool** — click two points on the canvas to draw a straight line; constrained to horizontal, vertical, or 45° diagonal angles; 2 grid cells thick; grid-snapped endpoints
  - **Circle tool** — click a center point and drag outward to draw a ring (stroke only, not filled); 2 grid cells thick; radius expands from the clicked center
  - **Default color** — all shapes draw in black; recolor later with the existing Color tool
  - **Shape selection** — drawn shapes can be selected, repositioned, and resized using the Select tool (same 8-handle resize as ruins and text)
  - **Shape color/thickness** — click a shape with the Color tool to adjust its color and stroke thickness via popover
  - **Delete** — press Delete/Backspace to remove the selected shape, or use the delete button on the rotation dial
- **Cut tool** — two-phase cut workflow with interactive selection:
  - **Rectangle mode** — click and drag to draw a selection box (dashed orange outline while drawing, solid when finalized)
  - **Polygon mode** — click individual points to build an N-sided polygon; close by clicking near the first point; supports triangles, pentagons, or any shape; grid-snapped when grid is on
  - On finalization, a **Move / Cut** context menu appears at the cursor
  - **Move** — reposition the selection (box or polygon) by dragging; menu reappears on release
  - **Cut** — captures the content inside the selection (ruins, text, drawn shapes — no grid lines) via offscreen canvas rendering on a transparent background; polygon cuts use canvas clipping
  - Cut stamp follows the cursor as a semi-transparent ghost; click to place — prompts for a name that appears in the Asset Codex and radial wheel
  - Click outside the selection to discard it and start a new one
  - Non-destructive: original content remains after cutting
- **Text tool** — click or drag an area on the canvas to create a text box:
  - Inline editor with textarea, font size control, color picker
  - Word-wrapping within the defined box
  - Text elements are movable in select mode (click to select, click again to drag)
  - Supports delete from the text editor panel
- **Save Asset** — select a placed ruin or drawn shape, click "Save" in the tools panel to export as a PNG:
  - For ruins: renders with all color effects, rotation, and mirror applied
  - For shapes: captures everything within the selected shape's bounding box (all overlapping shapes, ruins, and text) — content-aware export
  - File System Access API save-as dialog (Chrome/Edge) or fallback download
  - Prompts for a name; the saved asset is automatically added to the Asset Codex
- **Zoom** — slider in the tools panel (25%–400%) scales the entire canvas uniformly:
  - Grid lines, ruins, text, boxes, selection previews all scale together
  - Mouse interactions remain accurate at all zoom levels
  - Grid lines stay visually thin at any zoom level
  - Popovers and rotation dial position correctly relative to zoomed elements
  - Zoom level persists per ideogram
- **Custom scrollbars** — dark-themed scrollbar tracks appear on the canvas edges when content extends beyond the viewport:
  - Horizontal and vertical scrollbar thumbs for panning the viewport
  - Drag thumbs or click the track to jump
  - Mouse wheel / trackpad panning support
  - Content-aware: scrollbar range expands to cover all placed elements (ruins, text, shapes) plus padding
  - Styled to match the editor's dark theme (rust/orange hover accents)
- **Grid toggle** — "Show Grid" checkbox in tools panel; when ON, resize/move/cut/text snap to the 40px grid; when OFF (default), everything is free-form; Add Ruin never snaps
- **IsoMark compositor** — panel-based tool for compositing a ruinMark onto an IsoPlate to produce an IsoMark image:
  - Upload an IsoPlate image via the "Set IsoPlate" button (persists as the background for all composites)
  - Click any placed ruin on the canvas to overlay it centered on the IsoPlate in a live preview
  - Ruin appears at proportional size relative to the IsoPlate — resize the ruin on canvas to adjust its size
  - All ruin effects are preserved in the composite (color, rotation, mirror, opacity)
  - "Save IsoMark" exports the flattened composite as a PNG and adds it to the Asset Codex
  - Requires a local HTTP server for PNG export (`python3 -m http.server`)
- **Right-click deselect** — right-clicking anywhere on the ideogram canvas deselects the active tool and returns to select mode
- **Tool locking** — when a tool (Color, Cut, Text, Ideogram) is active, the rotation dial is suppressed; switching tools or clicking the active tool again cleans up all tool-specific UI
- **Ideogram cards** — each ideogram appears as a card in the sidebar with click-to-switch, inline rename, delete, and click-to-set thumbnail (white background, displays associated PNG); cards show asset and ideogram counts
- **Multiple ideograms** — create separate ideogram layouts, each with its own placed ruins, text, drawn shapes, cut areas, and viewport position/zoom
- **Data persistence** — all ideogram data (ruin library, placed ruins with color/size/rotation, text elements, drawn shapes, cut rects, viewport with zoom) is included in project save/load/export

## Codex Tool

Disc-based rotation puzzle with ruin slot boxes arranged around an ellipse:

- **Disc codex** — circular dial with configurable slot count (default 5); slot boxes positioned on an ellipse with angular skew so boxes face outward; assign ruin images to slots via file picker (click a slot box on canvas or use the config panel grid)
- **Spindial variant** — elliptical overlay element linked to a disc codex; no slot boxes of its own; rotating the spindial rotates the linked codex's first slot ruin independently
- **Ellipse hit testing** — spindials use `(dx/rx)² + (dy/ry)² ≤ 1` for precise elliptical click detection; clicks outside the ellipse pass through to elements underneath
- **Drag-to-rotate** — click-hold on a codex or spindial and drag the mouse around its center to rotate; disc codices shift slots in discrete steps, spindials rotate continuously with smooth visual feedback via `dragOffset`
- **Cardinal direction snapping** — spindial ruin rotation snaps to the nearest cardinal direction (0°, 90°, 180°, 270°) on mouse release; smooth drag during interaction, locked positions on commit
- **Dev lock mode** — "Dev" checkbox in tools panel freezes the entire canvas (no panning, no element movement, no tool actions); only drag-to-rotate gestures work, on any codex without needing to select it first
- **Ruin scale slider** — uniform scale control in the config panel; adjusts the display size of all ruin images within slot boxes
- **Solve lock** — save the current slot arrangement as the solved state; clear to reset; used by the puzzle system to check if the player has arranged the disc correctly
- **Config panel** — unified config for both disc codices and spindials: slot grid with ruin thumbnails and per-slot lock controls, ruin scale slider, solve lock save/clear, slot count, coupling checkboxes, and linked codex dropdown (when spindial is checked)
- **File path persistence** — slot ruin images and ideogram thumbnails are stored as relative file paths (`assets/puzzles/filename.png`) instead of data URLs, ensuring they survive the `stripDataUrls` export filter

### Coupling System

The codex puzzle supports coupling mechanics that create interdependency between disc rotation and ruin orientation, configured via checkboxes in the Ideogram Type section of the config panel. Each tier adds complexity on top of the previous one:

#### Difficulty Tiers

- **Basic — Disc-Orientation Coupling** — when the disc rotates one step, all unlocked ruin images also rotate 90° in the same direction. This means fixing a ruin's position by spinning the disc will break its orientation, and vice versa. The player must use the spindial (which rotates a single ruin without moving the disc) in combination with disc rotation to isolate and correct individual ruins. Solvable via conjugation: rotate the disc to bring a target ruin under the spindial, fix its orientation, then rotate the disc back — the target ruin gains a net 90° correction while all others return to their original state. ~15 moves worst case for 5 ruins.

- **Medium — + Linked Spindial** — in addition to disc-orientation coupling, the spindial now also rotates the opposite ruin (at index `ruinCount / 2`) by the same amount. This means every spindial correction has a side effect on a second ruin, requiring the player to plan sequences that account for both. Only available when disc-orientation coupling is enabled (greyed out otherwise), because linked spindial alone would create parity constraints with unreachable states.

- **Hard — + Mirror Coupling** — in addition to disc-orientation coupling, each disc rotation step also flips (mirrors horizontally) all unlocked ruin images. This adds a binary flip axis on top of the rotational one — the player must now manage position, orientation, and mirror state simultaneously. Only available when disc-orientation coupling is enabled.

#### Per-Slot Controls

Each slot has three mutually exclusive options, shown as **P**, **O**, and **Pin** toggle buttons below the slot thumbnail in the config grid:

- **Lock Position (P)** — the ruin stays in its slot index while other ruins cycle around it during disc rotation. The slot content doesn't swap, but the box still orbits visually with the disc. The locked ruin is exempt from coupling effects. Use case: keep a ruin in a specific slot position relative to others.

- **Lock Orientation (O)** — the ruin orbits normally with disc rotation but is exempt from coupling effects (no automatic rotation or mirroring from disc-orient or mirror coupling). Only available when disc-orientation coupling is enabled. Use case: a ruin that moves with the disc but whose orientation the player controls directly.

- **Pin Position (Pin)** — the ruin stays at a fixed angular position on the ellipse (fixed screen position) while other ruins orbit around it. Only one ruin can be pinned at a time. The pinned ruin is exempt from all coupling effects and does not participate in cycling. Use case: the cryo ruin as a visual anchor — always visible in the same spot while the player works on the other ruins.

#### Gate Effects

When a ruin is pinned, two additional checkboxes become available in the Ideogram Type section:

- **Gate Rotate** — when a ruin passes through the pinned ruin's position during disc rotation, it receives an additional +90° rotation (CW) or -90° (CCW). This creates position-dependent coupling — only the ruin at the gate point is affected, not all ruins.

- **Gate Flip** — when a ruin passes through the pinned ruin's position during disc rotation, it gets flipped (mirrored horizontally). Can be combined with Gate Rotate.

Gate effects are independent of disc-orientation coupling — they work on their own or stacked with other coupling types.

#### Greying Logic

Invalid or meaningless combinations are automatically greyed out in the config:
- Linked Spindial and Mirror require Disc-Orientation to be enabled
- O buttons require Disc-Orientation to be enabled
- Gate Rotate and Gate Flip require a pinned ruin
- Pin and P on slot 0 are disabled when a spindial is linked (slot 0 is the spindial target)
- The entire Ideogram Type section is greyed on spindial configs (coupling belongs to the disc codex)

#### Smooth Animation

Coupling effects animate smoothly during drag rather than snapping. As the player drags the disc partway between steps, ruin images show proportional rotation preview (`orientDragOffset`) that transitions seamlessly to the committed 90° increment on release. Locked and pinned ruins remain visually stable during drag.
