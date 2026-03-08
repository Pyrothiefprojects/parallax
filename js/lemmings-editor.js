const LemmingsEditor = (() => {
    // ========== STATE ==========
    let active = false;
    let canvas = null, ctx = null;
    let viewport = { offsetX: 0, offsetY: 0, zoom: 1.0 };
    let activeTool = 'select';
    let lemmings = [];              // [{ id, name, sources, mirrors, targets, walls, filters, splitters, pegs }]
    let currentLemmingId = null;

    // Prismatic state
    let sources = [];               // [{ id, x, y, angle }]
    let mirrors = [];               // [{ id, x, y, angle, length, locked, color }]
    let targets = [];               // [{ id, x, y }]
    let walls = [];                 // [{ id, x1, y1, x2, y2 }]
    let filters = [];               // [{ id, x, y, angle, length, color }]
    let splitters = [];             // [{ id, x, y, splits, angle }]
    let selectedType = null;        // 'source' | 'mirror' | 'target' | 'wall' | 'filter' | 'splitter' | 'peg' | null
    let selectedElement = null;
    let dragging = null;
    let rotating = null;
    let wallFirstPoint = null;
    let mouseWorld = { x: 0, y: 0 };
    let beamSegments = [];
    let hitTargets = new Set();

    // Clockwork state
    let pegs = [];                  // [{ id, x, y, role, hasGear, gearRadius, gearLocked }]
    let gearPool = [];
    let draggingPoolGear = null;
    let spinPhase = 0;
    let gearRotations = {};
    let connectedPegs = new Set();

    // Display toggles
    let showElements = true;

    // Connect tool state
    let connectPendingPeg = null; // peg waiting for second click (element)

    // Shared state
    let originalAngles = null;
    let originalPlacements = null;
    let scrambled = false;
    let pulsePhase = 0;
    let animFrameId = null;
    let solvedFlash = null;

    // Prismatic constants
    const GRID_SIZE = 40;
    const GRID_BG = '#1a1a2e';
    const GRID_COLOR = 'rgba(255,255,255,0.04)';
    const SOURCE_RADIUS = 12;
    const TARGET_RADIUS = 10;
    const SPLITTER_RADIUS = 10;
    const MIRROR_DEFAULT_LENGTH = 60;
    const FILTER_DEFAULT_LENGTH = 50;
    const MAX_BEAM_LENGTH = 5000;
    const MAX_BOUNCES = 50;
    const BEAM_COLOR = '#00e5ff';
    const COLOR_PRESETS = ['#ff3333', '#33ff33', '#3388ff', '#ffcc00', '#ff33ff', '#ff8800', '#00e5ff'];
    const SPECTRUM_COLORS = ['#ff0000', '#ff8800', '#ffff00', '#00ff00', '#0088ff', '#4400ff', '#8800ff', '#ff00ff'];

    // Clockwork constants
    const PEG_RADIUS = 5;
    const DEFAULT_GEAR_RADIUS = 30;
    const MIN_GEAR_RADIUS = 15;
    const MAX_GEAR_RADIUS = 60;
    const TOOTH_HEIGHT = 6;
    const TOOTH_SPACING = 10;
    const MESH_TOLERANCE = 5;
    const SNAP_DISTANCE = 20;
    const SPIN_SPEED = 0.02;
    const POOL_HEIGHT = 80;
    const GEAR_COLORS = {
        driverBody: '#4CAF50', driverStroke: '#2E7D32',
        outputBody: '#FF9800', outputStroke: '#E65100',
        connectedBody: '#607D8B', connectedStroke: '#455A64',
        disconnectedBody: '#424242', disconnectedStroke: '#333333',
        poolBody: '#78909C', poolStroke: '#546E7A',
        driverPeg: '#4CAF50', outputPeg: '#FF9800', normalPeg: '#666'
    };

    // ========== KEY HANDLER ==========
    function _onKeyDown(e) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (selectedElement && !scrambled) {
                if (selectedType === 'peg') {
                    deletePeg(selectedElement);
                } else {
                    deletePrismaticElement(selectedType, selectedElement);
                }
                selectedElement = null;
                selectedType = null;
                updateInfo();
                render();
            }
        }
        if (e.key === 'Escape') {
            selectedElement = null;
            selectedType = null;
            wallFirstPoint = null;
            updateConfigPanels();
            render();
        }
    }

    // ========== CANVAS INIT ==========
    function initCanvas() {
        canvas = document.getElementById('blueprint-canvas');
        if (!canvas) return false;
        ctx = canvas.getContext('2d');
        const parent = canvas.parentElement;
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        canvas.addEventListener('mousedown', _onMouseDown);
        canvas.addEventListener('mousemove', _onMouseMove);
        canvas.addEventListener('mouseup', _onMouseUp);
        canvas.addEventListener('wheel', _onWheel, { passive: false });
        canvas.addEventListener('contextmenu', _onContextMenu);
        return true;
    }

    // ========== ACTIVATE / DEACTIVATE ==========
    function activate() {
        if (active) return;
        if (typeof IdeogramEditor !== 'undefined' && IdeogramEditor.isActive()) IdeogramEditor.deactivate();
        if (typeof BlueprintEditor !== 'undefined' && BlueprintEditor.isActive()) BlueprintEditor.deactivate();
        if (typeof RuinscopeEditor !== 'undefined' && RuinscopeEditor.isActive()) RuinscopeEditor.deactivate();

        active = true;
        const gameCanvas = document.getElementById('game-canvas');
        const bpCanvas = document.getElementById('blueprint-canvas');
        if (gameCanvas) gameCanvas.classList.add('hidden');
        if (bpCanvas) bpCanvas.classList.remove('hidden');

        initCanvas();
        showToolset();
        document.addEventListener('keydown', _onKeyDown);

        if (lemmings.length === 0) {
            createLemming('Untitled');
        }
        if (!currentLemmingId && lemmings.length > 0) {
            switchLemming(lemmings[0].id);
        }
        startAnimLoop();
        render();
    }

    function deactivate() {
        if (!active) return;
        active = false;
        saveCurrentLemming();

        if (canvas) {
            canvas.removeEventListener('mousedown', _onMouseDown);
            canvas.removeEventListener('mousemove', _onMouseMove);
            canvas.removeEventListener('mouseup', _onMouseUp);
            canvas.removeEventListener('wheel', _onWheel);
            canvas.removeEventListener('contextmenu', _onContextMenu);
        }
        document.removeEventListener('keydown', _onKeyDown);
        canvas = null;
        ctx = null;

        const gameCanvas = document.getElementById('game-canvas');
        const bpCanvas = document.getElementById('blueprint-canvas');
        if (bpCanvas) bpCanvas.classList.add('hidden');
        if (gameCanvas) gameCanvas.classList.remove('hidden');

        hideToolset();
        stopAnimLoop();

        selectedElement = null;
        selectedType = null;
        dragging = null;
        rotating = null;
        wallFirstPoint = null;
        draggingPoolGear = null;
        activeTool = 'select';

        if (typeof Canvas !== 'undefined') Canvas.resize();
    }

    function isActive() { return active; }

    // ========== TOOLSET UI ==========
    function showToolset() {
        const panel = document.getElementById('lemmings-tools-panel');
        if (panel) panel.classList.remove('hidden');
        const body = document.getElementById('lemmings-tools-body');
        if (!body) return;

        body.innerHTML = `
            <div style="display:flex; gap:4px; margin-bottom:6px;">
                <button class="blueprint-tool active" data-tool="select" title="Select" style="flex:1;">
                    <span class="tool-icon">&#10022;</span>
                    <span class="tool-label">Select</span>
                </button>
                <button class="blueprint-tool" data-tool="delete" title="Delete" style="flex:1;">
                    <span class="tool-icon">&#10005;</span>
                    <span class="tool-label">Delete</span>
                </button>
                <button class="blueprint-tool" data-tool="asset" title="Assign Asset" style="flex:1;">
                    <span class="tool-icon">&#9733;</span>
                    <span class="tool-label">Asset</span>
                </button>
                <button class="blueprint-tool" data-tool="connect" title="Connect Gear to Element" style="flex:1;">
                    <span class="tool-icon">&#9741;</span>
                    <span class="tool-label">Connect</span>
                </button>
            </div>
            <div style="font-size:10px; color:var(--accent-gold); margin:8px 0 4px;">Prismatic</div>
            <div class="blueprint-tool-grid" style="grid-template-columns: repeat(3, 1fr);">
                <button class="blueprint-tool" data-tool="source" title="Beam Source">
                    <span class="tool-icon">&#9728;</span>
                    <span class="tool-label">Source</span>
                </button>
                <button class="blueprint-tool" data-tool="mirror" title="Mirror">
                    <span class="tool-icon">&#10207;</span>
                    <span class="tool-label">Mirror</span>
                </button>
                <button class="blueprint-tool" data-tool="target" title="Target">
                    <span class="tool-icon">&#9678;</span>
                    <span class="tool-label">Target</span>
                </button>
                <button class="blueprint-tool" data-tool="wall" title="Wall">
                    <span class="tool-icon">&#9644;</span>
                    <span class="tool-label">Wall</span>
                </button>
                <button class="blueprint-tool" data-tool="filter" title="Color Filter">
                    <span class="tool-icon">&#9670;</span>
                    <span class="tool-label">Filter</span>
                </button>
                <button class="blueprint-tool" data-tool="splitter" title="Beam Splitter">
                    <span class="tool-icon">&#10038;</span>
                    <span class="tool-label">Splitter</span>
                </button>
            </div>
            <div style="font-size:10px; color:var(--accent-gold); margin:8px 0 4px;">Clockwork</div>
            <div class="blueprint-tool-grid" style="grid-template-columns: repeat(2, 1fr);">
                <button class="blueprint-tool" data-tool="peg" title="Place Peg">
                    <span class="tool-icon">&#8857;</span>
                    <span class="tool-label">Peg</span>
                </button>
                <button class="blueprint-tool" data-tool="gear" title="Add/Remove Gear">
                    <span class="tool-icon">&#9881;</span>
                    <span class="tool-label">Gear</span>
                </button>
            </div>
            <div style="margin-top:10px; display:flex; gap:6px; flex-wrap:wrap;">
                <button class="panel-btn" id="lemmings-scramble">Scramble</button>
                <button class="panel-btn" id="lemmings-reset">Reset</button>
            </div>
            <label style="display:flex; align-items:center; gap:6px; font-size:11px; color:var(--text-secondary); cursor:pointer; margin-top:8px;">
                <input type="checkbox" id="lemmings-show-elements" checked> Show Elements
            </label>
            <div style="margin-top:8px; font-size:11px; color:var(--text-secondary);">
                <span id="lemmings-info"></span>
            </div>
            <div style="margin-top:6px; font-size:10px; color:var(--text-secondary);" id="lemmings-status"></div>
            <div id="lemmings-source-config" class="hidden" style="margin-top:10px; border-top:1px solid rgba(255,255,255,0.1); padding-top:8px;">
                <div style="font-size:10px; color:var(--text-secondary); margin-bottom:4px;">Source Config</div>
                <div style="margin-top:6px;">
                    <label style="font-size:10px; color:var(--text-secondary);">Beam Color</label>
                    <div id="lemmings-source-colors" style="display:flex; gap:4px; margin-top:4px; flex-wrap:wrap;"></div>
                </div>
                <div id="lemmings-source-link" class="hidden" style="margin-top:8px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.1);">
                    <div style="font-size:10px; color:orange;">Driven by gear</div>
                    <button class="panel-btn lemmings-el-disconnect" style="font-size:10px; margin-top:4px;">Disconnect</button>
                </div>
            </div>
            <div id="lemmings-mirror-config" class="hidden" style="margin-top:10px; border-top:1px solid rgba(255,255,255,0.1); padding-top:8px;">
                <div style="font-size:10px; color:var(--text-secondary); margin-bottom:4px;">Mirror Config</div>
                <label style="display:flex; align-items:center; gap:6px; font-size:11px; color:var(--text-secondary); cursor:pointer;">
                    <input type="checkbox" id="lemmings-mirror-locked"> Locked (fixed in play)
                </label>
                <div style="margin-top:6px;">
                    <label style="font-size:10px; color:var(--text-secondary);">Length</label>
                    <input type="range" id="lemmings-mirror-length" min="30" max="160" value="60" style="width:100%; margin-top:2px;">
                </div>
                <div style="margin-top:6px;">
                    <label style="font-size:10px; color:var(--text-secondary);">Beam Color</label>
                    <div id="lemmings-mirror-colors" style="display:flex; gap:4px; margin-top:4px; flex-wrap:wrap;"></div>
                </div>
                <div id="lemmings-mirror-link" class="hidden" style="margin-top:8px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.1);">
                    <div style="font-size:10px; color:orange;">Driven by gear</div>
                    <button class="panel-btn lemmings-el-disconnect" style="font-size:10px; margin-top:4px;">Disconnect</button>
                </div>
            </div>
            <div id="lemmings-filter-config" class="hidden" style="margin-top:10px; border-top:1px solid rgba(255,255,255,0.1); padding-top:8px;">
                <div style="font-size:10px; color:var(--text-secondary); margin-bottom:4px;">Filter Config</div>
                <div style="margin-top:6px;">
                    <label style="font-size:10px; color:var(--text-secondary);">Length</label>
                    <input type="range" id="lemmings-filter-length" min="30" max="160" value="50" style="width:100%; margin-top:2px;">
                </div>
                <div style="margin-top:6px;">
                    <label style="font-size:10px; color:var(--text-secondary);">Color</label>
                    <div id="lemmings-filter-colors" style="display:flex; gap:4px; margin-top:4px; flex-wrap:wrap;"></div>
                </div>
                <div id="lemmings-filter-link" class="hidden" style="margin-top:8px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.1);">
                    <div style="font-size:10px; color:orange;">Driven by gear</div>
                    <button class="panel-btn lemmings-el-disconnect" style="font-size:10px; margin-top:4px;">Disconnect</button>
                </div>
            </div>
            <div id="lemmings-target-config" class="hidden" style="margin-top:10px; border-top:1px solid rgba(255,255,255,0.1); padding-top:8px;">
                <div style="font-size:10px; color:var(--text-secondary); margin-bottom:4px;">Target Config</div>
                <div style="margin-top:6px;">
                    <label style="font-size:10px; color:var(--text-secondary);">Required Color</label>
                    <div id="lemmings-target-colors" style="display:flex; gap:4px; margin-top:4px; flex-wrap:wrap;"></div>
                </div>
            </div>
            <div id="lemmings-splitter-config" class="hidden" style="margin-top:10px; border-top:1px solid rgba(255,255,255,0.1); padding-top:8px;">
                <div style="font-size:10px; color:var(--text-secondary); margin-bottom:4px;">Splitter Config</div>
                <div style="margin-top:6px;">
                    <label style="font-size:10px; color:var(--text-secondary);">Splits: <span id="lemmings-splitter-count-label">2</span></label>
                    <input type="range" id="lemmings-splitter-count" min="2" max="8" value="2" style="width:100%; margin-top:2px;">
                </div>
                <div style="margin-top:6px; display:flex; gap:4px;">
                    <button class="panel-btn lemmings-split-mode-btn" data-mode="full" style="flex:1; font-size:10px;">Full</button>
                    <button class="panel-btn lemmings-split-mode-btn" data-mode="fan" style="flex:1; font-size:10px;">Fan</button>
                </div>
                <div id="lemmings-splitter-spread-row" class="hidden" style="margin-top:6px;">
                    <label style="font-size:10px; color:var(--text-secondary);">Spread: <span id="lemmings-splitter-spread-label" style="cursor:pointer; text-decoration:underline dotted; padding:0 2px;">180</span>&deg;</label>
                    <input type="range" id="lemmings-splitter-spread" min="10" max="360" value="180" style="width:100%; margin-top:2px;">
                </div>
                <label style="display:flex; align-items:center; gap:6px; font-size:11px; color:var(--text-secondary); cursor:pointer; margin-top:6px;">
                    <input type="checkbox" id="lemmings-splitter-spectrum"> Spectrum (rainbow)
                </label>
                <div style="margin-top:6px;">
                    <label style="font-size:10px; color:var(--text-secondary);">Beam Color</label>
                    <div id="lemmings-splitter-colors" style="display:flex; gap:4px; margin-top:4px; flex-wrap:wrap;"></div>
                </div>
                <div id="lemmings-splitter-link" class="hidden" style="margin-top:8px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.1);">
                    <div style="font-size:10px; color:orange;">Driven by gear</div>
                    <button class="panel-btn lemmings-el-disconnect" style="font-size:10px; margin-top:4px;">Disconnect</button>
                </div>
            </div>
            <div id="lemmings-peg-config" class="hidden" style="margin-top:10px; border-top:1px solid rgba(255,255,255,0.1); padding-top:8px;">
                <div style="font-size:10px; color:var(--text-secondary); margin-bottom:6px;">Peg Config</div>
                <div style="display:flex; gap:4px; margin-bottom:8px;">
                    <button class="panel-btn lemmings-role-btn" data-role="normal" style="flex:1; font-size:10px;">Normal</button>
                    <button class="panel-btn lemmings-role-btn" data-role="driver" style="flex:1; font-size:10px;">Driver</button>
                    <button class="panel-btn lemmings-role-btn" data-role="output" style="flex:1; font-size:10px;">Output</button>
                </div>
                <div id="lemmings-gear-section">
                    <label style="display:flex; align-items:center; gap:6px; font-size:11px; color:var(--text-secondary); cursor:pointer;">
                        <input type="checkbox" id="lemmings-has-gear"> Has Gear
                    </label>
                    <div id="lemmings-gear-options" class="hidden" style="margin-top:6px;">
                        <div>
                            <label style="font-size:10px; color:var(--text-secondary);">Radius: <span id="lemmings-radius-label">30</span></label>
                            <input type="range" id="lemmings-gear-radius" min="15" max="60" value="30" style="width:100%; margin-top:2px;">
                        </div>
                        <label style="display:flex; align-items:center; gap:6px; font-size:11px; color:var(--text-secondary); cursor:pointer; margin-top:6px;">
                            <input type="checkbox" id="lemmings-gear-locked"> Locked (fixed in play)
                        </label>
                    </div>
                </div>
                <div id="lemmings-peg-link" class="hidden" style="margin-top:8px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.1);">
                    <div style="font-size:10px; color:orange;">Linked to: <span id="lemmings-peg-link-name"></span></div>
                    <button class="panel-btn" id="lemmings-peg-disconnect" style="font-size:10px; margin-top:4px;">Disconnect</button>
                </div>
            </div>
            <div id="lemmings-asset-config" class="hidden" style="margin-top:10px; border-top:1px solid rgba(255,255,255,0.1); padding-top:8px;">
                <div style="font-size:10px; color:var(--text-secondary); margin-bottom:4px;">Asset Config</div>
                <div id="lemmings-asset-thumb" style="margin-bottom:6px;"></div>
                <div style="margin-top:4px;">
                    <label style="font-size:10px; color:var(--text-secondary);">Size: <span id="lemmings-asset-size-label">30</span></label>
                    <input type="range" id="lemmings-asset-size" min="10" max="200" value="30" style="width:100%; margin-top:2px;">
                </div>
                <div style="margin-top:6px;">
                    <button class="panel-btn" id="lemmings-asset-clear" style="font-size:10px;">Remove Asset</button>
                </div>
            </div>
        `;

        // Tool buttons
        body.querySelectorAll('.blueprint-tool').forEach(btn => {
            btn.addEventListener('click', () => selectTool(btn.dataset.tool));
        });

        // Scramble / Reset
        document.getElementById('lemmings-scramble').addEventListener('click', scrambleAll);
        document.getElementById('lemmings-reset').addEventListener('click', resetAll);

        // Show elements toggle
        document.getElementById('lemmings-show-elements').addEventListener('change', (e) => {
            showElements = e.target.checked;
            render();
        });

        // Mirror config
        const lockedCb = document.getElementById('lemmings-mirror-locked');
        lockedCb.addEventListener('change', () => {
            if (selectedElement && selectedType === 'mirror') {
                selectedElement.locked = lockedCb.checked;
                render();
            }
        });
        const lengthSlider = document.getElementById('lemmings-mirror-length');
        lengthSlider.addEventListener('input', () => {
            if (selectedElement && selectedType === 'mirror') {
                selectedElement.length = parseInt(lengthSlider.value);
                render();
            }
        });

        // Filter config
        const filterLengthSlider = document.getElementById('lemmings-filter-length');
        filterLengthSlider.addEventListener('input', () => {
            if (selectedElement && selectedType === 'filter') {
                selectedElement.length = parseInt(filterLengthSlider.value);
                render();
            }
        });

        // Splitter config
        const splitterCountSlider = document.getElementById('lemmings-splitter-count');
        splitterCountSlider.addEventListener('input', () => {
            if (selectedElement && selectedType === 'splitter') {
                selectedElement.splits = parseInt(splitterCountSlider.value);
                document.getElementById('lemmings-splitter-count-label').textContent = splitterCountSlider.value;
                render();
            }
        });

        // Splitter mode buttons
        body.querySelectorAll('.lemmings-split-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!selectedElement || selectedType !== 'splitter') return;
                selectedElement.splitMode = btn.dataset.mode;
                updateSplitterConfig();
                render();
            });
        });

        // Splitter spectrum checkbox
        document.getElementById('lemmings-splitter-spectrum').addEventListener('change', (e) => {
            if (!selectedElement || selectedType !== 'splitter') return;
            selectedElement.spectrum = e.target.checked;
            render();
        });

        // Splitter spread slider
        document.getElementById('lemmings-splitter-spread').addEventListener('input', (e) => {
            if (!selectedElement || selectedType !== 'splitter') return;
            selectedElement.spread = parseInt(e.target.value);
            document.getElementById('lemmings-splitter-spread-label').textContent = e.target.value;
            render();
        });

        // Click spread label to type value
        document.getElementById('lemmings-splitter-spread-label').addEventListener('click', () => {
            if (!selectedElement || selectedType !== 'splitter') return;
            const label = document.getElementById('lemmings-splitter-spread-label');
            const current = selectedElement.spread || 180;
            const input = document.createElement('input');
            input.type = 'number';
            input.min = '10';
            input.max = '360';
            input.value = current;
            input.style.cssText = 'width:40px; font-size:10px; background:#222; color:#fff; border:1px solid #555; padding:1px 3px; text-align:center;';
            label.replaceWith(input);
            input.focus();
            input.select();
            const commit = () => {
                let val = parseInt(input.value) || 180;
                val = Math.max(10, Math.min(360, val));
                selectedElement.spread = val;
                const newLabel = document.createElement('span');
                newLabel.id = 'lemmings-splitter-spread-label';
                newLabel.style.cssText = 'cursor:pointer; text-decoration:underline dotted; padding:0 2px;';
                newLabel.textContent = val;
                input.replaceWith(newLabel);
                document.getElementById('lemmings-splitter-spread').value = val;
                // Re-bind click
                newLabel.addEventListener('click', () => document.getElementById('lemmings-splitter-spread-label').click());
                render();
            };
            input.addEventListener('blur', commit);
            input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') input.blur(); });
        });

        // Peg role buttons
        body.querySelectorAll('.lemmings-role-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!selectedElement || selectedType !== 'peg' || scrambled) return;
                const newRole = btn.dataset.role;
                if (newRole === 'driver' || newRole === 'output') {
                    pegs.forEach(p => { if (p.role === newRole && p !== selectedElement) p.role = 'normal'; });
                }
                selectedElement.role = newRole;
                updatePegConfig();
                render();
            });
        });

        // Has gear checkbox
        document.getElementById('lemmings-has-gear').addEventListener('change', (e) => {
            if (!selectedElement || selectedType !== 'peg' || scrambled) return;
            selectedElement.hasGear = e.target.checked;
            if (e.target.checked && !selectedElement.gearRadius) {
                selectedElement.gearRadius = DEFAULT_GEAR_RADIUS;
            }
            updatePegConfig();
            render();
        });

        // Gear radius slider
        document.getElementById('lemmings-gear-radius').addEventListener('input', (e) => {
            if (!selectedElement || selectedType !== 'peg' || scrambled) return;
            selectedElement.gearRadius = parseInt(e.target.value);
            document.getElementById('lemmings-radius-label').textContent = e.target.value;
            render();
        });

        // Gear locked checkbox
        document.getElementById('lemmings-gear-locked').addEventListener('change', (e) => {
            if (!selectedElement || selectedType !== 'peg' || scrambled) return;
            selectedElement.gearLocked = e.target.checked;
            render();
        });

        // Asset size slider
        document.getElementById('lemmings-asset-size').addEventListener('input', (e) => {
            if (!selectedElement || scrambled) return;
            selectedElement.imageSize = parseInt(e.target.value);
            document.getElementById('lemmings-asset-size-label').textContent = e.target.value;
            render();
        });

        // Remove asset button
        document.getElementById('lemmings-asset-clear').addEventListener('click', () => {
            if (!selectedElement || scrambled) return;
            delete selectedElement.image;
            delete selectedElement.imageSize;
            updateAssetConfig();
            render();
        });

        document.getElementById('lemmings-peg-disconnect').addEventListener('click', () => {
            if (!selectedElement || selectedType !== 'peg' || !selectedElement.linkedElementId) return;
            const lists = { source: sources, mirror: mirrors, filter: filters, splitter: splitters };
            const arr = lists[selectedElement.linkedElementType];
            if (arr) {
                const el = arr.find(e => e.id === selectedElement.linkedElementId);
                if (el) delete el.linkedPegId;
            }
            delete selectedElement.linkedElementId;
            delete selectedElement.linkedElementType;
            updateConfigPanels();
            render();
        });

        // Element disconnect buttons (source, mirror, filter, splitter)
        body.querySelectorAll('.lemmings-el-disconnect').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!selectedElement || !selectedElement.linkedPegId) return;
                disconnectElement(selectedElement);
            });
        });

        // Close button
        const closeBtn = document.getElementById('lemmings-tools-close');
        if (closeBtn) closeBtn.addEventListener('click', () => {
            const p = document.getElementById('lemmings-tools-panel');
            if (p) p.classList.add('hidden');
        });

        updateInfo();
    }

    function hideToolset() {
        const panel = document.getElementById('lemmings-tools-panel');
        if (panel) panel.classList.add('hidden');
    }

    function selectTool(tool) {
        if (activeTool === tool && tool !== 'select') {
            activeTool = 'select';
        } else {
            activeTool = tool;
        }
        wallFirstPoint = null;
        connectPendingPeg = null;
        const body = document.getElementById('lemmings-tools-body');
        if (body) {
            body.querySelectorAll('.blueprint-tool').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tool === activeTool);
            });
        }
        render();
    }

    function updateInfo() {
        const el = document.getElementById('lemmings-info');
        if (el) {
            const gearCount = pegs.filter(p => p.hasGear).length;
            el.textContent = `Src:${sources.length} Mir:${mirrors.length} Fil:${filters.length} Spl:${splitters.length} Tgt:${targets.length} | Peg:${pegs.length} Gear:${gearCount}`;
        }
        const status = document.getElementById('lemmings-status');
        if (status) {
            if (scrambled) {
                const prismaticSolved = targets.length === 0 || hitTargets.size === targets.length;
                const clockworkSolved = checkClockworkSolved();
                if (prismaticSolved && clockworkSolved) {
                    status.textContent = 'SOLVED!';
                    status.style.color = '#00e5ff';
                } else {
                    const parts = [];
                    if (targets.length > 0) parts.push('Targets: ' + hitTargets.size + '/' + targets.length);
                    if (gearPool.length > 0) parts.push('Pool: ' + gearPool.length + ' gear' + (gearPool.length !== 1 ? 's' : ''));
                    status.textContent = parts.join(' | ') || 'Working...';
                    status.style.color = 'var(--text-secondary)';
                }
            } else {
                status.textContent = '';
            }
        }
        updateConfigPanels();
    }

    function updateConfigPanels() {
        updateSourceConfig();
        updateMirrorConfig();
        updateFilterConfig();
        updateTargetConfig();
        updateSplitterConfig();
        updatePegConfig();
        updateAssetConfig();
    }

    function updateSourceConfig() {
        const cfg = document.getElementById('lemmings-source-config');
        if (!cfg) return;
        if (selectedType === 'source' && selectedElement && !scrambled) {
            cfg.classList.remove('hidden');
            populateColorSwatches('lemmings-source-colors', selectedElement.color, true, (color) => {
                selectedElement.color = color;
                updateSourceConfig();
                render();
            });
            updateElementLinkDiv('source', selectedElement);
        } else {
            cfg.classList.add('hidden');
        }
    }

    function updateTargetConfig() {
        const cfg = document.getElementById('lemmings-target-config');
        if (!cfg) return;
        if (selectedType === 'target' && selectedElement && !scrambled) {
            cfg.classList.remove('hidden');
            populateColorSwatches('lemmings-target-colors', selectedElement.color, true, (color) => {
                selectedElement.color = color;
                updateTargetConfig();
                render();
            });
        } else {
            cfg.classList.add('hidden');
        }
    }

    function updateAssetConfig() {
        const cfg = document.getElementById('lemmings-asset-config');
        if (!cfg) return;
        if (selectedElement && selectedElement.image && !scrambled) {
            cfg.classList.remove('hidden');
            const thumb = document.getElementById('lemmings-asset-thumb');
            if (thumb) {
                thumb.innerHTML = `<img src="${selectedElement.image}" style="width:32px; height:32px; object-fit:contain; border:1px solid #555; border-radius:3px;">`;
            }
            const size = selectedElement.imageSize || 30;
            const slider = document.getElementById('lemmings-asset-size');
            const label = document.getElementById('lemmings-asset-size-label');
            if (slider) slider.value = size;
            if (label) label.textContent = size;
        } else {
            cfg.classList.add('hidden');
        }
    }

    function updateMirrorConfig() {
        const cfg = document.getElementById('lemmings-mirror-config');
        if (!cfg) return;
        if (selectedType === 'mirror' && selectedElement && !scrambled) {
            cfg.classList.remove('hidden');
            const lockedCb = document.getElementById('lemmings-mirror-locked');
            const lengthSlider = document.getElementById('lemmings-mirror-length');
            if (lockedCb) lockedCb.checked = selectedElement.locked;
            if (lengthSlider) lengthSlider.value = selectedElement.length;
            populateColorSwatches('lemmings-mirror-colors', selectedElement.color, true, (color) => {
                selectedElement.color = color;
                updateMirrorConfig();
                render();
            });
            updateElementLinkDiv('mirror', selectedElement);
        } else {
            cfg.classList.add('hidden');
        }
    }

    function updateFilterConfig() {
        const cfg = document.getElementById('lemmings-filter-config');
        if (!cfg) return;
        if (selectedType === 'filter' && selectedElement && !scrambled) {
            cfg.classList.remove('hidden');
            const lengthSlider = document.getElementById('lemmings-filter-length');
            if (lengthSlider) lengthSlider.value = selectedElement.length;
            populateColorSwatches('lemmings-filter-colors', selectedElement.color, false, (color) => {
                selectedElement.color = color;
                updateFilterConfig();
                render();
            });
            updateElementLinkDiv('filter', selectedElement);
        } else {
            cfg.classList.add('hidden');
        }
    }

    function updateSplitterConfig() {
        const cfg = document.getElementById('lemmings-splitter-config');
        if (!cfg) return;
        if (selectedType === 'splitter' && selectedElement && !scrambled) {
            cfg.classList.remove('hidden');
            const slider = document.getElementById('lemmings-splitter-count');
            const label = document.getElementById('lemmings-splitter-count-label');
            if (slider) slider.value = selectedElement.splits || 2;
            if (label) label.textContent = selectedElement.splits || 2;

            const mode = selectedElement.splitMode || 'full';
            cfg.querySelectorAll('.lemmings-split-mode-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.mode === mode);
            });

            const spectrumCb = document.getElementById('lemmings-splitter-spectrum');
            if (spectrumCb) spectrumCb.checked = !!selectedElement.spectrum;

            const spreadRow = document.getElementById('lemmings-splitter-spread-row');
            if (mode === 'fan') {
                spreadRow.classList.remove('hidden');
                const spread = selectedElement.spread || 180;
                const spreadSlider = document.getElementById('lemmings-splitter-spread');
                const spreadLabel = document.getElementById('lemmings-splitter-spread-label');
                if (spreadSlider) spreadSlider.value = spread;
                if (spreadLabel) spreadLabel.textContent = spread;
            } else {
                spreadRow.classList.add('hidden');
            }

            populateColorSwatches('lemmings-splitter-colors', selectedElement.color, true, (color) => {
                selectedElement.color = color;
                updateSplitterConfig();
                render();
            });
            updateElementLinkDiv('splitter', selectedElement);
        } else {
            cfg.classList.add('hidden');
        }
    }

    function updatePegConfig() {
        const cfg = document.getElementById('lemmings-peg-config');
        if (!cfg) return;
        if (selectedType === 'peg' && selectedElement && !scrambled) {
            cfg.classList.remove('hidden');
            cfg.querySelectorAll('.lemmings-role-btn').forEach(btn => {
                const isActive = btn.dataset.role === selectedElement.role;
                btn.style.background = isActive ? 'var(--accent-rust)' : '';
                btn.style.color = isActive ? '#fff' : '';
            });
            const hasGearCb = document.getElementById('lemmings-has-gear');
            if (hasGearCb) hasGearCb.checked = selectedElement.hasGear;
            const gearOpts = document.getElementById('lemmings-gear-options');
            if (gearOpts) {
                if (selectedElement.hasGear) {
                    gearOpts.classList.remove('hidden');
                    const slider = document.getElementById('lemmings-gear-radius');
                    const label = document.getElementById('lemmings-radius-label');
                    if (slider) slider.value = selectedElement.gearRadius || DEFAULT_GEAR_RADIUS;
                    if (label) label.textContent = selectedElement.gearRadius || DEFAULT_GEAR_RADIUS;
                    const lockedCb = document.getElementById('lemmings-gear-locked');
                    if (lockedCb) lockedCb.checked = selectedElement.gearLocked;
                } else {
                    gearOpts.classList.add('hidden');
                }
            }
            // Linked element info
            const linkDiv = document.getElementById('lemmings-peg-link');
            if (linkDiv) {
                if (selectedElement.linkedElementId) {
                    linkDiv.classList.remove('hidden');
                    const nameEl = document.getElementById('lemmings-peg-link-name');
                    if (nameEl) nameEl.textContent = (selectedElement.linkedElementType || '').charAt(0).toUpperCase() + (selectedElement.linkedElementType || '').slice(1);
                } else {
                    linkDiv.classList.add('hidden');
                }
            }
        } else {
            cfg.classList.add('hidden');
        }
    }

    function updateElementLinkDiv(type, element) {
        const linkDiv = document.getElementById('lemmings-' + type + '-link');
        if (!linkDiv) return;
        if (element && element.linkedPegId) {
            linkDiv.classList.remove('hidden');
        } else {
            linkDiv.classList.add('hidden');
        }
    }

    function disconnectElement(element) {
        if (!element || !element.linkedPegId) return;
        const peg = pegs.find(p => p.id === element.linkedPegId);
        if (peg) {
            delete peg.linkedElementId;
            delete peg.linkedElementType;
        }
        delete element.linkedPegId;
        updateConfigPanels();
        render();
    }

    function populateColorSwatches(containerId, currentColor, allowNone, onChange) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';

        if (allowNone) {
            const noneBtn = document.createElement('button');
            noneBtn.style.cssText = 'width:22px; height:22px; border-radius:50%; border:2px solid ' + (!currentColor ? '#00e5ff' : '#555') + '; background:transparent; cursor:pointer; font-size:9px; color:#888; display:flex; align-items:center; justify-content:center;';
            noneBtn.innerHTML = '&mdash;';
            noneBtn.title = 'No color';
            noneBtn.addEventListener('click', () => onChange(null));
            container.appendChild(noneBtn);
        }

        for (const color of COLOR_PRESETS) {
            const btn = document.createElement('button');
            const isActive = color === currentColor;
            btn.style.cssText = 'width:22px; height:22px; border-radius:50%; border:2px solid ' + (isActive ? '#fff' : '#333') + '; background:' + color + '; cursor:pointer;';
            btn.addEventListener('click', () => onChange(color));
            container.appendChild(btn);
        }
    }

    // ========== ELEMENT CRUD ==========
    function _genId(prefix) {
        return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 4);
    }

    function addSource(x, y, angle) {
        const src = { id: _genId('src'), x, y, angle: angle || 0 };
        sources.push(src);
        updateInfo();
        return src;
    }

    function addMirror(x, y, angle, length, locked) {
        const mir = { id: _genId('mir'), x, y, angle: angle !== undefined ? angle : Math.PI / 4, length: length || MIRROR_DEFAULT_LENGTH, locked: !!locked, color: null };
        mirrors.push(mir);
        updateInfo();
        return mir;
    }

    function addTarget(x, y) {
        const tgt = { id: _genId('tgt'), x, y };
        targets.push(tgt);
        updateInfo();
        return tgt;
    }

    function addWall(x1, y1, x2, y2) {
        const wall = { id: _genId('wall'), x1, y1, x2, y2 };
        walls.push(wall);
        updateInfo();
        return wall;
    }

    function addFilter(x, y, angle, length, color) {
        const fil = { id: _genId('fil'), x, y, angle: angle !== undefined ? angle : Math.PI / 4, length: length || FILTER_DEFAULT_LENGTH, color: color || '#ff3333' };
        filters.push(fil);
        updateInfo();
        return fil;
    }

    function addSplitter(x, y, splits, angle) {
        const spl = { id: _genId('spl'), x, y, splits: splits || 2, angle: angle || 0 };
        splitters.push(spl);
        updateInfo();
        return spl;
    }

    function addPeg(x, y, role, hasGear, gearRadius, gearLocked) {
        const peg = {
            id: _genId('peg'), x, y,
            role: role || 'normal',
            hasGear: hasGear !== undefined ? hasGear : true,
            gearRadius: gearRadius || DEFAULT_GEAR_RADIUS,
            gearLocked: !!gearLocked
        };
        pegs.push(peg);
        updateInfo();
        return peg;
    }

    function deletePrismaticElement(type, element) {
        if (type === 'source') sources = sources.filter(s => s !== element);
        else if (type === 'mirror') mirrors = mirrors.filter(m => m !== element);
        else if (type === 'target') targets = targets.filter(t => t !== element);
        else if (type === 'wall') walls = walls.filter(w => w !== element);
        else if (type === 'filter') filters = filters.filter(f => f !== element);
        else if (type === 'splitter') splitters = splitters.filter(s => s !== element);
        if (selectedElement === element) {
            selectedElement = null;
            selectedType = null;
        }
        updateInfo();
    }

    function deletePeg(peg) {
        pegs = pegs.filter(p => p !== peg);
        if (selectedElement === peg) {
            selectedElement = null;
            selectedType = null;
        }
        updateInfo();
    }

    // ========== GEOMETRY UTILS ==========
    function mirrorToSegment(m) {
        const halfLen = m.length / 2;
        const ca = Math.cos(m.angle), sa = Math.sin(m.angle);
        return {
            x1: m.x - ca * halfLen, y1: m.y - sa * halfLen,
            x2: m.x + ca * halfLen, y2: m.y + sa * halfLen
        };
    }

    function filterToSegment(f) {
        const halfLen = f.length / 2;
        const ca = Math.cos(f.angle), sa = Math.sin(f.angle);
        return {
            x1: f.x - ca * halfLen, y1: f.y - sa * halfLen,
            x2: f.x + ca * halfLen, y2: f.y + sa * halfLen
        };
    }

    function getMirrorNormal(m) {
        return { x: -Math.sin(m.angle), y: Math.cos(m.angle) };
    }

    function reflectDir(dx, dy, nx, ny) {
        const dot = dx * nx + dy * ny;
        return { x: dx - 2 * dot * nx, y: dy - 2 * dot * ny };
    }

    function raySegmentIntersect(ox, oy, dx, dy, p1x, p1y, p2x, p2y) {
        const ex = p2x - p1x, ey = p2y - p1y;
        const denom = dx * ey - dy * ex;
        if (Math.abs(denom) < 1e-10) return null;
        const t = ((p1x - ox) * ey - (p1y - oy) * ex) / denom;
        const u = ((p1x - ox) * dy - (p1y - oy) * dx) / denom;
        if (t < 0.001 || u < 0.0 || u > 1.0) return null;
        return { t, x: ox + t * dx, y: oy + t * dy };
    }

    function rayCircleIntersect(ox, oy, dx, dy, cx, cy, r) {
        const fx = ox - cx, fy = oy - cy;
        const a = dx * dx + dy * dy;
        const b = 2 * (fx * dx + fy * dy);
        const c = fx * fx + fy * fy - r * r;
        let disc = b * b - 4 * a * c;
        if (disc < 0) return null;
        disc = Math.sqrt(disc);
        const t1 = (-b - disc) / (2 * a);
        const t2 = (-b + disc) / (2 * a);
        const t = t1 > 0.001 ? t1 : (t2 > 0.001 ? t2 : -1);
        if (t < 0) return null;
        return { t, x: ox + t * dx, y: oy + t * dy };
    }

    function pointToSegmentDist(px, py, ax, ay, bx, by) {
        const ddx = bx - ax, ddy = by - ay;
        const lenSq = ddx * ddx + ddy * ddy;
        if (lenSq === 0) return Math.hypot(px - ax, py - ay);
        let t = ((px - ax) * ddx + (py - ay) * ddy) / lenSq;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(px - (ax + t * ddx), py - (ay + t * ddy));
    }

    function dist(ax, ay, bx, by) {
        return Math.hypot(ax - bx, ay - by);
    }

    function hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    }

    function getToothCount(radius) {
        return Math.max(8, Math.round(2 * Math.PI * radius / TOOTH_SPACING));
    }

    // ========== BEAM TRACING ==========
    function traceAllBeams() {
        beamSegments = [];
        hitTargets = new Set();
        const tgtRadius = TARGET_RADIUS / viewport.zoom;
        const splRadius = SPLITTER_RADIUS / viewport.zoom;

        // Each source starts a beam; splitters add more beams to the queue
        const beamQueue = [];
        for (const src of sources) {
            beamQueue.push({ ox: src.x, oy: src.y, dx: Math.cos(src.angle), dy: Math.sin(src.angle), color: src.color || BEAM_COLOR, bounces: 0 });
        }

        while (beamQueue.length > 0) {
            const beam = beamQueue.shift();
            let rayOx = beam.ox, rayOy = beam.oy;
            let rayDx = beam.dx, rayDy = beam.dy;
            let bounces = beam.bounces;
            let currentColor = beam.color;

            while (bounces < MAX_BOUNCES) {
                let nearest = null;
                let nearestDist = MAX_BEAM_LENGTH;
                let nearestType = null;
                let nearestElement = null;

                // Test mirrors
                for (const mir of mirrors) {
                    const seg = mirrorToSegment(mir);
                    const hit = raySegmentIntersect(rayOx, rayOy, rayDx, rayDy, seg.x1, seg.y1, seg.x2, seg.y2);
                    if (hit && hit.t < nearestDist) {
                        nearest = hit;
                        nearestDist = hit.t;
                        nearestType = 'mirror';
                        nearestElement = mir;
                    }
                }

                // Test filters
                for (const fil of filters) {
                    const seg = filterToSegment(fil);
                    const hit = raySegmentIntersect(rayOx, rayOy, rayDx, rayDy, seg.x1, seg.y1, seg.x2, seg.y2);
                    if (hit && hit.t < nearestDist) {
                        nearest = hit;
                        nearestDist = hit.t;
                        nearestType = 'filter';
                        nearestElement = fil;
                    }
                }

                // Test walls
                for (const wall of walls) {
                    const hit = raySegmentIntersect(rayOx, rayOy, rayDx, rayDy, wall.x1, wall.y1, wall.x2, wall.y2);
                    if (hit && hit.t < nearestDist) {
                        nearest = hit;
                        nearestDist = hit.t;
                        nearestType = 'wall';
                        nearestElement = wall;
                    }
                }

                // Test targets
                for (const tgt of targets) {
                    const hit = rayCircleIntersect(rayOx, rayOy, rayDx, rayDy, tgt.x, tgt.y, tgtRadius);
                    if (hit && hit.t < nearestDist) {
                        nearest = hit;
                        nearestDist = hit.t;
                        nearestType = 'target';
                        nearestElement = tgt;
                    }
                }

                // Test splitters
                for (const spl of splitters) {
                    const hit = rayCircleIntersect(rayOx, rayOy, rayDx, rayDy, spl.x, spl.y, splRadius);
                    if (hit && hit.t < nearestDist) {
                        nearest = hit;
                        nearestDist = hit.t;
                        nearestType = 'splitter';
                        nearestElement = spl;
                    }
                }

                if (!nearest) {
                    beamSegments.push({
                        x1: rayOx, y1: rayOy,
                        x2: rayOx + rayDx * MAX_BEAM_LENGTH,
                        y2: rayOy + rayDy * MAX_BEAM_LENGTH,
                        hitType: 'none',
                        color: currentColor
                    });
                    break;
                }

                beamSegments.push({
                    x1: rayOx, y1: rayOy,
                    x2: nearest.x, y2: nearest.y,
                    hitType: nearestType,
                    color: currentColor
                });

                if (nearestType === 'wall') break;

                if (nearestType === 'target') {
                    if (!nearestElement.color || nearestElement.color === currentColor) {
                        hitTargets.add(nearestElement.id);
                    }
                    break;
                }

                if (nearestType === 'filter') {
                    if (nearestElement.color) currentColor = nearestElement.color;
                    rayOx = nearest.x;
                    rayOy = nearest.y;
                    bounces++;
                    continue;
                }

                if (nearestType === 'mirror') {
                    const normal = getMirrorNormal(nearestElement);
                    const ref = reflectDir(rayDx, rayDy, normal.x, normal.y);
                    rayDx = ref.x;
                    rayDy = ref.y;
                    rayOx = nearest.x;
                    rayOy = nearest.y;
                    if (nearestElement.color) currentColor = nearestElement.color;
                    bounces++;
                    continue;
                }

                if (nearestType === 'splitter') {
                    const spl = nearestElement;
                    const numSplits = spl.splits || 2;
                    const baseAngle = spl.angle || 0;
                    const mode = spl.splitMode || 'full';
                    const isSpectrum = !!spl.spectrum;

                    for (let i = 0; i < numSplits; i++) {
                        let outAngle;
                        if (mode === 'fan') {
                            const spreadRad = ((spl.spread || 180) * Math.PI) / 180;
                            if (numSplits === 1) {
                                outAngle = baseAngle;
                            } else {
                                outAngle = baseAngle - spreadRad / 2 + (i / (numSplits - 1)) * spreadRad;
                            }
                        } else {
                            outAngle = baseAngle + i * ((Math.PI * 2) / numSplits);
                        }
                        let beamColor;
                        if (isSpectrum) {
                            beamColor = SPECTRUM_COLORS[i % SPECTRUM_COLORS.length];
                        } else {
                            beamColor = spl.color || currentColor;
                        }
                        beamQueue.push({
                            ox: spl.x + Math.cos(outAngle) * (splRadius + 1),
                            oy: spl.y + Math.sin(outAngle) * (splRadius + 1),
                            dx: Math.cos(outAngle),
                            dy: Math.sin(outAngle),
                            color: beamColor,
                            bounces: bounces + 1
                        });
                    }
                    break;
                }
            }
        }
    }

    // ========== CLOCKWORK MESH GRAPH ==========
    function buildMeshGraph() {
        const adj = {};
        for (const p of pegs) adj[p.id] = [];

        for (let i = 0; i < pegs.length; i++) {
            const a = pegs[i];
            if (!a.hasGear) continue;
            for (let j = i + 1; j < pegs.length; j++) {
                const b = pegs[j];
                if (!b.hasGear) continue;
                const d = dist(a.x, a.y, b.x, b.y);
                const meshDist = a.gearRadius + b.gearRadius;
                if (Math.abs(d - meshDist) < MESH_TOLERANCE) {
                    adj[a.id].push(b.id);
                    adj[b.id].push(a.id);
                }
            }
        }
        return adj;
    }

    function findChain() {
        const driver = pegs.find(p => p.role === 'driver' && p.hasGear);
        if (!driver) return new Set();

        const adj = buildMeshGraph();
        const visited = new Set();
        const queue = [driver.id];
        visited.add(driver.id);

        while (queue.length > 0) {
            const current = queue.shift();
            for (const neighbor of (adj[current] || [])) {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    queue.push(neighbor);
                }
            }
        }
        return visited;
    }

    function calculateRotations() {
        gearRotations = {};
        connectedPegs = new Set();
        const driver = pegs.find(p => p.role === 'driver' && p.hasGear);
        if (!driver) return;

        const adj = buildMeshGraph();
        const visited = new Set();
        const queue = [driver.id];
        visited.add(driver.id);
        gearRotations[driver.id] = spinPhase;
        connectedPegs.add(driver.id);

        while (queue.length > 0) {
            const currentId = queue.shift();
            const current = pegs.find(p => p.id === currentId);
            if (!current) continue;

            for (const neighborId of (adj[currentId] || [])) {
                if (visited.has(neighborId)) continue;
                visited.add(neighborId);
                queue.push(neighborId);
                connectedPegs.add(neighborId);

                const neighbor = pegs.find(p => p.id === neighborId);
                if (!neighbor) continue;

                const parentAngle = gearRotations[currentId];
                gearRotations[neighborId] = -parentAngle * (current.gearRadius / neighbor.gearRadius);
            }
        }

        // Apply gear rotation to linked elements
        for (const peg of pegs) {
            if (!peg.linkedElementId || gearRotations[peg.id] === undefined) continue;
            const lists = { source: sources, mirror: mirrors, filter: filters, splitter: splitters };
            const arr = lists[peg.linkedElementType];
            if (!arr) continue;
            const el = arr.find(e => e.id === peg.linkedElementId);
            if (el) el.angle = gearRotations[peg.id];
        }
    }

    // ========== SOLVE CHECKS ==========
    function checkPrismaticSolved() {
        if (targets.length === 0) return true;
        return hitTargets.size === targets.length;
    }

    function checkClockworkSolved() {
        if (pegs.length === 0) return true;
        if (gearPool.length > 0) return false;
        const output = pegs.find(p => p.role === 'output');
        if (!output || !output.hasGear) return true; // no output configured = not a clockwork puzzle
        const chain = findChain();
        return chain.has(output.id);
    }

    function checkSolved() {
        if (!scrambled) return false;
        return checkPrismaticSolved() && checkClockworkSolved();
    }

    // ========== SCRAMBLE / RESET ==========
    function scrambleAll() {
        // Scramble mirrors
        const movableMirrors = mirrors.filter(m => !m.locked);
        if (movableMirrors.length > 0) {
            originalAngles = movableMirrors.map(m => ({ id: m.id, angle: m.angle }));
        }

        // Scramble gears
        const movableGears = pegs.filter(p => p.hasGear && !p.gearLocked);
        if (movableGears.length > 0) {
            originalPlacements = movableGears.map(p => ({ pegId: p.id, gearRadius: p.gearRadius }));
            gearPool = [];
            for (const p of movableGears) {
                gearPool.push({ radius: p.gearRadius, index: gearPool.length });
                p.hasGear = false;
            }
            for (let i = gearPool.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                const tmp = gearPool[i];
                gearPool[i] = gearPool[j];
                gearPool[j] = tmp;
            }
            gearPool.forEach((g, i) => g.index = i);
        }

        if (movableMirrors.length === 0 && movableGears.length === 0) return;

        scrambled = true;

        // Randomize mirror angles
        if (movableMirrors.length > 0) {
            let attempts = 0;
            do {
                for (const mir of movableMirrors) {
                    mir.angle = Math.random() * Math.PI;
                }
                traceAllBeams();
                attempts++;
            } while (checkSolved() && attempts < 30);
        }

        solvedFlash = null;
        draggingPoolGear = null;
        startAnimLoop();
        updateInfo();
        render();
    }

    function resetAll() {
        if (originalAngles) {
            for (const orig of originalAngles) {
                const mir = mirrors.find(m => m.id === orig.id);
                if (mir) mir.angle = orig.angle;
            }
            originalAngles = null;
        }
        if (originalPlacements) {
            for (const orig of originalPlacements) {
                const peg = pegs.find(p => p.id === orig.pegId);
                if (peg) {
                    peg.hasGear = true;
                    peg.gearRadius = orig.gearRadius;
                }
            }
            originalPlacements = null;
        }
        scrambled = false;
        gearPool = [];
        draggingPoolGear = null;
        solvedFlash = null;
        traceAllBeams();
        updateInfo();
        render();
    }

    // ========== HIT TESTING ==========
    function hitTest(mx, my) {
        const zr = 1 / viewport.zoom;

        // Sources
        for (const src of sources) {
            if (dist(mx, my, src.x, src.y) < (SOURCE_RADIUS + 4) * zr) {
                return { type: 'source', element: src };
            }
        }

        // Targets
        for (const tgt of targets) {
            if (dist(mx, my, tgt.x, tgt.y) < (TARGET_RADIUS + 4) * zr) {
                return { type: 'target', element: tgt };
            }
        }

        // Splitters
        for (const spl of splitters) {
            if (dist(mx, my, spl.x, spl.y) < (SPLITTER_RADIUS + 4) * zr) {
                return { type: 'splitter', element: spl };
            }
        }

        // Mirror centers
        for (const mir of mirrors) {
            if (dist(mx, my, mir.x, mir.y) < 10 * zr) {
                return { type: 'mirror', element: mir };
            }
        }

        // Filter centers
        for (const fil of filters) {
            if (dist(mx, my, fil.x, fil.y) < 10 * zr) {
                return { type: 'filter', element: fil };
            }
        }

        // Pegs / Gears
        for (const peg of pegs) {
            const hitRadius = peg.hasGear ? (peg.gearRadius + TOOTH_HEIGHT / 2) * zr : (PEG_RADIUS + 6) * zr;
            if (dist(mx, my, peg.x, peg.y) < hitRadius) {
                return { type: 'peg', element: peg };
            }
        }

        // Mirror rotation handle
        if (selectedElement && selectedType === 'mirror') {
            const seg = mirrorToSegment(selectedElement);
            if (dist(mx, my, seg.x2, seg.y2) < 8 * zr) {
                return { type: 'mirror-rotate', element: selectedElement };
            }
        }

        // Filter rotation handle
        if (selectedElement && selectedType === 'filter') {
            const seg = filterToSegment(selectedElement);
            if (dist(mx, my, seg.x2, seg.y2) < 8 * zr) {
                return { type: 'filter-rotate', element: selectedElement };
            }
        }

        // Splitter rotation handle
        if (selectedElement && selectedType === 'splitter') {
            const sAngle = selectedElement.angle || 0;
            const sHandleR = SPLITTER_RADIUS * 2.5 / viewport.zoom;
            const shx = selectedElement.x + Math.cos(sAngle) * sHandleR;
            const shy = selectedElement.y + Math.sin(sAngle) * sHandleR;
            if (dist(mx, my, shx, shy) < 8 * zr) {
                return { type: 'splitter-rotate', element: selectedElement };
            }
        }

        // Source direction handle
        if (selectedElement && selectedType === 'source') {
            const arrowLen = SOURCE_RADIUS * 2 / viewport.zoom;
            const ax = selectedElement.x + Math.cos(selectedElement.angle) * arrowLen;
            const ay = selectedElement.y + Math.sin(selectedElement.angle) * arrowLen;
            if (dist(mx, my, ax, ay) < 8 * zr) {
                return { type: 'source-rotate', element: selectedElement };
            }
        }

        // Mirror line segments
        for (const mir of mirrors) {
            const seg = mirrorToSegment(mir);
            if (pointToSegmentDist(mx, my, seg.x1, seg.y1, seg.x2, seg.y2) < 6 * zr) {
                return { type: 'mirror', element: mir };
            }
        }

        // Filter line segments
        for (const fil of filters) {
            const seg = filterToSegment(fil);
            if (pointToSegmentDist(mx, my, seg.x1, seg.y1, seg.x2, seg.y2) < 6 * zr) {
                return { type: 'filter', element: fil };
            }
        }

        // Wall endpoints
        for (const wall of walls) {
            if (dist(mx, my, wall.x1, wall.y1) < 8 * zr) {
                return { type: 'wall-endpoint', element: wall, endpoint: 1 };
            }
            if (dist(mx, my, wall.x2, wall.y2) < 8 * zr) {
                return { type: 'wall-endpoint', element: wall, endpoint: 2 };
            }
        }

        // Wall segments
        for (const wall of walls) {
            if (pointToSegmentDist(mx, my, wall.x1, wall.y1, wall.x2, wall.y2) < 6 * zr) {
                return { type: 'wall', element: wall };
            }
        }

        return null;
    }

    function hitTestPool(screenX, screenY) {
        if (!scrambled || gearPool.length === 0) return null;
        const poolY = canvas.height - POOL_HEIGHT;
        if (screenY < poolY) return null;

        const spacing = Math.min(100, (canvas.width - 40) / gearPool.length);
        const startX = 20 + spacing / 2;

        for (let i = 0; i < gearPool.length; i++) {
            const gx = startX + i * spacing;
            const gy = poolY + POOL_HEIGHT / 2;
            const gr = gearPool[i].radius * 0.6;
            if (dist(screenX, screenY, gx, gy) < gr + 10) {
                return i;
            }
        }
        return null;
    }

    function findSnapPeg(screenX, screenY) {
        for (const peg of pegs) {
            if (peg.hasGear) continue;
            const pegScreenX = peg.x * viewport.zoom + viewport.offsetX;
            const pegScreenY = peg.y * viewport.zoom + viewport.offsetY;
            if (dist(screenX, screenY, pegScreenX, pegScreenY) < SNAP_DISTANCE * viewport.zoom) {
                return peg;
            }
        }
        return null;
    }

    // ========== ANIMATION LOOP ==========
    function animLoop() {
        spinPhase += SPIN_SPEED;
        pulsePhase = (Date.now() % 2000) / 2000 * Math.PI * 2;
        render();
        animFrameId = requestAnimationFrame(animLoop);
    }

    function startAnimLoop() {
        if (animFrameId) return;
        animFrameId = requestAnimationFrame(animLoop);
    }

    function stopAnimLoop() {
        if (animFrameId) {
            cancelAnimationFrame(animFrameId);
            animFrameId = null;
        }
    }

    // ========== RENDER ==========
    function render() {
        if (!ctx) return;

        traceAllBeams();
        calculateRotations();

        ctx.fillStyle = GRID_BG;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.translate(viewport.offsetX, viewport.offsetY);
        ctx.scale(viewport.zoom, viewport.zoom);

        drawGrid();

        // Walls
        for (const wall of walls) {
            drawWall(wall, selectedElement === wall);
        }

        // Filters (before beams)
        for (const fil of filters) {
            drawFilter(fil, selectedElement === fil);
        }

        // Mesh lines between gears
        if (showElements) drawMeshLines();

        // Beams
        if (showElements) drawBeams();

        // Mirrors
        for (const mir of mirrors) {
            drawMirror(mir, selectedElement === mir);
        }

        // Sources
        for (const src of sources) {
            drawSource(src, selectedElement === src);
        }

        // Targets
        for (const tgt of targets) {
            drawTarget(tgt, hitTargets.has(tgt.id));
        }

        // Splitters
        for (const spl of splitters) {
            drawSplitter(spl, selectedElement === spl);
        }

        // Pegs and gears
        for (const peg of pegs) {
            if (peg.hasGear) {
                const rotation = gearRotations[peg.id] || 0;
                const isConnected = connectedPegs.has(peg.id);
                const isSelected = selectedElement === peg;
                drawGear(peg.x, peg.y, peg.gearRadius, rotation, peg.role, isConnected, isSelected, peg.gearLocked);
                drawElementImage(peg, peg.gearRadius * 2, rotation);
            } else {
                drawEmptyPeg(peg, selectedElement === peg);
                drawElementImage(peg, PEG_RADIUS * 4);
            }
        }

        // Connection lines between linked gears and elements
        for (const peg of pegs) {
            if (!peg.linkedElementId) continue;
            const lists = { source: sources, mirror: mirrors, filter: filters, splitter: splitters };
            const arr = lists[peg.linkedElementType];
            if (!arr) continue;
            const el = arr.find(e => e.id === peg.linkedElementId);
            if (!el) continue;
            ctx.beginPath();
            ctx.moveTo(peg.x, peg.y);
            ctx.lineTo(el.x, el.y);
            ctx.strokeStyle = 'rgba(255, 165, 0, 0.5)';
            ctx.lineWidth = 2 / viewport.zoom;
            ctx.setLineDash([6 / viewport.zoom, 4 / viewport.zoom]);
            ctx.stroke();
            ctx.setLineDash([]);
            // Small diamond at midpoint
            const mx = (peg.x + el.x) / 2, my = (peg.y + el.y) / 2;
            const ds = 5 / viewport.zoom;
            ctx.beginPath();
            ctx.moveTo(mx, my - ds);
            ctx.lineTo(mx + ds, my);
            ctx.lineTo(mx, my + ds);
            ctx.lineTo(mx - ds, my);
            ctx.closePath();
            ctx.fillStyle = 'rgba(255, 165, 0, 0.8)';
            ctx.fill();
        }

        // Connect tool: highlight pending peg
        if (connectPendingPeg) {
            ctx.beginPath();
            ctx.arc(connectPendingPeg.x, connectPendingPeg.y, (connectPendingPeg.gearRadius || 30) + 6 / viewport.zoom, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 165, 0, 0.8)';
            ctx.lineWidth = 2.5 / viewport.zoom;
            ctx.setLineDash([4 / viewport.zoom, 4 / viewport.zoom]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Wall preview line
        if (wallFirstPoint && activeTool === 'wall') {
            ctx.beginPath();
            ctx.moveTo(wallFirstPoint.x, wallFirstPoint.y);
            ctx.lineTo(mouseWorld.x, mouseWorld.y);
            ctx.strokeStyle = 'rgba(100, 100, 120, 0.5)';
            ctx.lineWidth = 3 / viewport.zoom;
            ctx.setLineDash([6 / viewport.zoom, 4 / viewport.zoom]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        ctx.restore();

        // Pool area (screen space)
        if (scrambled && gearPool.length > 0) {
            drawPool();
        }

        // Dragging pool gear
        if (draggingPoolGear) {
            drawDraggingGear();
            drawSnapPreview();
        }

        // Solved flash overlay
        if (solvedFlash) {
            const elapsed = performance.now() - solvedFlash.start;
            const t = elapsed / solvedFlash.duration;
            if (t < 1) {
                let alpha;
                if (t < 0.1) alpha = t / 0.1 * 0.6;
                else if (t < 0.3) alpha = 0.6 - (t - 0.1) / 0.2 * 0.35;
                else alpha = 0.25 * (1 - (t - 0.3) / 0.7);
                ctx.fillStyle = t < 0.15
                    ? 'rgba(255, 255, 255, ' + alpha + ')'
                    : 'rgba(0, 229, 255, ' + alpha + ')';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                const textAlpha = t < 0.15 ? 1 : Math.max(0, 1 - (t - 0.15) / 0.85);
                ctx.save();
                ctx.fillStyle = 'rgba(255, 255, 255, ' + textAlpha + ')';
                ctx.font = 'bold 48px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.shadowColor = '#00e5ff';
                ctx.shadowBlur = 20;
                ctx.fillText('SOLVED', canvas.width / 2, canvas.height / 2);
                ctx.restore();
            } else {
                solvedFlash = null;
            }
        }
    }

    function drawGrid() {
        const invZoom = 1 / viewport.zoom;
        const startX = Math.floor((-viewport.offsetX * invZoom) / GRID_SIZE) * GRID_SIZE;
        const startY = Math.floor((-viewport.offsetY * invZoom) / GRID_SIZE) * GRID_SIZE;
        const endX = startX + (canvas.width * invZoom) + GRID_SIZE;
        const endY = startY + (canvas.height * invZoom) + GRID_SIZE;

        ctx.strokeStyle = GRID_COLOR;
        ctx.lineWidth = 1 / viewport.zoom;
        ctx.beginPath();
        for (let x = startX; x <= endX; x += GRID_SIZE) {
            ctx.moveTo(x, startY);
            ctx.lineTo(x, endY);
        }
        for (let y = startY; y <= endY; y += GRID_SIZE) {
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
        }
        ctx.stroke();
    }

    function drawBeams() {
        for (const seg of beamSegments) {
            const color = seg.color || BEAM_COLOR;

            ctx.beginPath();
            ctx.moveTo(seg.x1, seg.y1);
            ctx.lineTo(seg.x2, seg.y2);
            ctx.strokeStyle = hexToRgba(color, 0.3);
            ctx.lineWidth = 6 / viewport.zoom;
            ctx.shadowColor = color;
            ctx.shadowBlur = 12 / viewport.zoom;
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(seg.x1, seg.y1);
            ctx.lineTo(seg.x2, seg.y2);
            ctx.strokeStyle = color;
            ctx.lineWidth = 2 / viewport.zoom;
            ctx.shadowColor = color;
            ctx.shadowBlur = 6 / viewport.zoom;
            ctx.stroke();

            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
        }
    }

    const _elementImgCache = {};
    function _resolveImage(src) {
        const preloaded = (typeof Preloader !== 'undefined' && Preloader.getImage) ? Preloader.getImage(src) : null;
        if (preloaded) return preloaded;
        if (_elementImgCache[src]) return _elementImgCache[src].complete ? _elementImgCache[src] : null;
        const img = new Image();
        img.onload = () => render();
        img.src = src;
        _elementImgCache[src] = img;
        return null;
    }

    function drawElementImage(element, defaultSize, rotationOverride) {
        if (!element.image) return;
        const img = _resolveImage(element.image);
        if (!img) return;
        const s = (element.imageSize || defaultSize) / viewport.zoom;
        const rot = rotationOverride !== undefined ? rotationOverride : (element.angle || 0);
        ctx.save();
        ctx.translate(element.x, element.y);
        if (rot) ctx.rotate(rot);
        ctx.drawImage(img, -s / 2, -s / 2, s, s);
        ctx.restore();
    }

    function drawSource(src, isSelected) {
        const r = SOURCE_RADIUS / viewport.zoom;
        if (showElements) {
            ctx.beginPath();
            ctx.arc(src.x, src.y, r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 200, 50, 0.9)';
            ctx.fill();
            ctx.strokeStyle = '#ffa500';
            ctx.lineWidth = 2 / viewport.zoom;
            ctx.stroke();

            const arrowLen = r * 2;
            const ax = src.x + Math.cos(src.angle) * arrowLen;
            const ay = src.y + Math.sin(src.angle) * arrowLen;
            ctx.beginPath();
            ctx.moveTo(src.x, src.y);
            ctx.lineTo(ax, ay);
            ctx.strokeStyle = '#ffa500';
            ctx.lineWidth = 2.5 / viewport.zoom;
            ctx.stroke();

            const tipLen = 6 / viewport.zoom;
            const tipAngle = 0.5;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(ax - Math.cos(src.angle - tipAngle) * tipLen, ay - Math.sin(src.angle - tipAngle) * tipLen);
            ctx.moveTo(ax, ay);
            ctx.lineTo(ax - Math.cos(src.angle + tipAngle) * tipLen, ay - Math.sin(src.angle + tipAngle) * tipLen);
            ctx.stroke();
        }

        drawElementImage(src, SOURCE_RADIUS * 2);

        if (isSelected) {
            ctx.beginPath();
            ctx.arc(src.x, src.y, r + 5 / viewport.zoom, 0, Math.PI * 2);
            ctx.strokeStyle = '#00e5ff';
            ctx.lineWidth = 2 / viewport.zoom;
            ctx.stroke();
        }
    }

    function drawMirror(mir, isSelected) {
        const seg = mirrorToSegment(mir);
        if (showElements) {
            const lw = mir.locked ? 3 : 4;

            ctx.beginPath();
            ctx.moveTo(seg.x1, seg.y1);
            ctx.lineTo(seg.x2, seg.y2);
            ctx.strokeStyle = mir.locked ? 'rgba(150, 150, 180, 0.8)' : 'rgba(200, 220, 255, 0.95)';
            ctx.lineWidth = lw / viewport.zoom;
            if (!mir.locked) {
                ctx.shadowColor = '#88aaff';
                ctx.shadowBlur = 4 / viewport.zoom;
            }
            ctx.stroke();
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;

            ctx.beginPath();
            ctx.arc(mir.x, mir.y, 3 / viewport.zoom, 0, Math.PI * 2);
            ctx.fillStyle = mir.locked ? '#888' : '#aaccff';
            ctx.fill();

            if (mir.color) {
                ctx.beginPath();
                ctx.arc(mir.x, mir.y, 7 / viewport.zoom, 0, Math.PI * 2);
                ctx.strokeStyle = mir.color;
                ctx.lineWidth = 2 / viewport.zoom;
                ctx.globalAlpha = 0.8;
                ctx.stroke();
                ctx.globalAlpha = 1.0;
            }

            if (mir.locked) {
                const s = 4 / viewport.zoom;
                ctx.beginPath();
                ctx.moveTo(mir.x - s, mir.y - s);
                ctx.lineTo(mir.x + s, mir.y + s);
                ctx.moveTo(mir.x + s, mir.y - s);
                ctx.lineTo(mir.x - s, mir.y + s);
                ctx.strokeStyle = 'rgba(255, 100, 100, 0.6)';
                ctx.lineWidth = 1.5 / viewport.zoom;
                ctx.stroke();
            }
        }

        drawElementImage(mir, 30);

        if (isSelected) {
            ctx.beginPath();
            ctx.moveTo(seg.x1, seg.y1);
            ctx.lineTo(seg.x2, seg.y2);
            ctx.strokeStyle = 'rgba(0, 229, 255, 0.3)';
            ctx.lineWidth = 8 / viewport.zoom;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(seg.x2, seg.y2, 6 / viewport.zoom, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 165, 0, 0.7)';
            ctx.fill();
            ctx.strokeStyle = '#ffa500';
            ctx.lineWidth = 1.5 / viewport.zoom;
            ctx.stroke();
        }
    }

    function drawFilter(fil, isSelected) {
        const seg = filterToSegment(fil);
        if (showElements) {
            const color = fil.color || '#ff3333';

            ctx.beginPath();
            ctx.moveTo(seg.x1, seg.y1);
            ctx.lineTo(seg.x2, seg.y2);
            ctx.strokeStyle = color;
            ctx.lineWidth = 10 / viewport.zoom;
            ctx.globalAlpha = 0.12;
            ctx.stroke();
            ctx.globalAlpha = 1.0;

            ctx.beginPath();
            ctx.moveTo(seg.x1, seg.y1);
            ctx.lineTo(seg.x2, seg.y2);
            ctx.strokeStyle = color;
            ctx.lineWidth = 3 / viewport.zoom;
            ctx.setLineDash([5 / viewport.zoom, 4 / viewport.zoom]);
            ctx.globalAlpha = 0.7;
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1.0;

            const s = 5 / viewport.zoom;
            ctx.beginPath();
            ctx.moveTo(fil.x, fil.y - s);
            ctx.lineTo(fil.x + s, fil.y);
            ctx.lineTo(fil.x, fil.y + s);
            ctx.lineTo(fil.x - s, fil.y);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.9;
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1 / viewport.zoom;
            ctx.globalAlpha = 0.4;
            ctx.stroke();
            ctx.globalAlpha = 1.0;
        }

        drawElementImage(fil, 30);

        if (isSelected) {
            ctx.beginPath();
            ctx.moveTo(seg.x1, seg.y1);
            ctx.lineTo(seg.x2, seg.y2);
            ctx.strokeStyle = 'rgba(0, 229, 255, 0.3)';
            ctx.lineWidth = 10 / viewport.zoom;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(seg.x2, seg.y2, 6 / viewport.zoom, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 165, 0, 0.7)';
            ctx.fill();
            ctx.strokeStyle = '#ffa500';
            ctx.lineWidth = 1.5 / viewport.zoom;
            ctx.stroke();
        }
    }

    function drawSplitter(spl, isSelected) {
        const r = SPLITTER_RADIUS / viewport.zoom;
        if (showElements) {
            const numSplits = spl.splits || 2;

            // Outer ring
            ctx.beginPath();
            ctx.arc(spl.x, spl.y, r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(180, 100, 255, 0.3)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(180, 100, 255, 0.9)';
            ctx.lineWidth = 2 / viewport.zoom;
            ctx.stroke();

            // Draw split lines radiating from center
            const baseAngle = spl.angle || 0;
            const mode = spl.splitMode || 'full';
            for (let i = 0; i < numSplits; i++) {
                let a;
                if (mode === 'fan') {
                    const spreadRad = ((spl.spread || 180) * Math.PI) / 180;
                    a = numSplits === 1 ? baseAngle : baseAngle - spreadRad / 2 + (i / (numSplits - 1)) * spreadRad;
                } else {
                    a = baseAngle + i * ((Math.PI * 2) / numSplits);
                }
                ctx.beginPath();
                ctx.moveTo(spl.x, spl.y);
                ctx.lineTo(spl.x + Math.cos(a) * r * 0.8, spl.y + Math.sin(a) * r * 0.8);
                ctx.strokeStyle = spl.spectrum ? SPECTRUM_COLORS[i % SPECTRUM_COLORS.length] : 'rgba(200, 150, 255, 0.7)';
                ctx.lineWidth = 1.5 / viewport.zoom;
                ctx.stroke();
            }

            // Center dot
            ctx.beginPath();
            ctx.arc(spl.x, spl.y, 2 / viewport.zoom, 0, Math.PI * 2);
            ctx.fillStyle = '#b864ff';
            ctx.fill();

            // Split count label
            ctx.font = (8 / viewport.zoom) + 'px monospace';
            ctx.fillStyle = 'rgba(200, 150, 255, 0.8)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText('x' + (spl.splits || 2), spl.x, spl.y + r + 3 / viewport.zoom);
        }

        drawElementImage(spl, SPLITTER_RADIUS * 2);

        if (isSelected) {
            ctx.beginPath();
            ctx.arc(spl.x, spl.y, r + 5 / viewport.zoom, 0, Math.PI * 2);
            ctx.strokeStyle = '#00e5ff';
            ctx.lineWidth = 2 / viewport.zoom;
            ctx.stroke();

            // Rotation handle line + dot
            const sAngle = spl.angle || 0;
            const handleR = SPLITTER_RADIUS * 2.5 / viewport.zoom;
            const hx = spl.x + Math.cos(sAngle) * handleR;
            const hy = spl.y + Math.sin(sAngle) * handleR;
            ctx.beginPath();
            ctx.moveTo(spl.x, spl.y);
            ctx.lineTo(hx, hy);
            ctx.strokeStyle = 'rgba(180, 100, 255, 0.5)';
            ctx.lineWidth = 1.5 / viewport.zoom;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(hx, hy, 5 / viewport.zoom, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 165, 0, 0.7)';
            ctx.fill();
            ctx.strokeStyle = '#ffa500';
            ctx.lineWidth = 1.5 / viewport.zoom;
            ctx.stroke();
        }
    }

    function drawTarget(tgt, isHit) {
        const r = TARGET_RADIUS / viewport.zoom;
        if (showElements) {
            const reqColor = tgt.color || null;
            const unhitColor = reqColor || 'rgba(255, 80, 80, 0.8)';
            const unhitFaint = reqColor ? (reqColor + '66') : 'rgba(255, 80, 80, 0.4)';
            const unhitDot = reqColor || 'rgba(255, 80, 80, 0.6)';

            ctx.beginPath();
            ctx.arc(tgt.x, tgt.y, r, 0, Math.PI * 2);
            ctx.strokeStyle = isHit ? '#00ff80' : unhitColor;
            ctx.lineWidth = 2.5 / viewport.zoom;
            if (isHit) {
                ctx.shadowColor = '#00ff80';
                ctx.shadowBlur = 10 / viewport.zoom;
            }
            ctx.stroke();
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;

            ctx.beginPath();
            ctx.arc(tgt.x, tgt.y, r * 0.6, 0, Math.PI * 2);
            ctx.strokeStyle = isHit ? 'rgba(0, 255, 128, 0.5)' : unhitFaint;
            ctx.lineWidth = 1 / viewport.zoom;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(tgt.x, tgt.y, 3 / viewport.zoom, 0, Math.PI * 2);
            ctx.fillStyle = isHit ? '#00ff80' : unhitDot;
            ctx.fill();
        }

        drawElementImage(tgt, TARGET_RADIUS * 2);

        if (selectedElement === tgt) {
            ctx.beginPath();
            ctx.arc(tgt.x, tgt.y, r + 5 / viewport.zoom, 0, Math.PI * 2);
            ctx.strokeStyle = '#00e5ff';
            ctx.lineWidth = 2 / viewport.zoom;
            ctx.stroke();
        }
    }

    function drawWall(wall, isSelected) {
        if (showElements) {
            ctx.beginPath();
            ctx.moveTo(wall.x1, wall.y1);
            ctx.lineTo(wall.x2, wall.y2);
            ctx.strokeStyle = isSelected ? 'rgba(150, 150, 170, 0.95)' : 'rgba(100, 100, 120, 0.9)';
            ctx.lineWidth = 5 / viewport.zoom;
            ctx.lineCap = 'round';
            ctx.stroke();

            [{ x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 }].forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 3 / viewport.zoom, 0, Math.PI * 2);
                ctx.fillStyle = isSelected ? 'rgba(150, 150, 170, 0.9)' : 'rgba(100, 100, 120, 0.8)';
                ctx.fill();
            });
        }

        if (isSelected) {
            ctx.beginPath();
            ctx.moveTo(wall.x1, wall.y1);
            ctx.lineTo(wall.x2, wall.y2);
            ctx.strokeStyle = 'rgba(0, 229, 255, 0.25)';
            ctx.lineWidth = 10 / viewport.zoom;
            ctx.stroke();
        }
    }

    // ========== CLOCKWORK DRAWING ==========
    function drawMeshLines() {
        if (pegs.length === 0) return;
        const adj = buildMeshGraph();
        const drawn = new Set();
        ctx.setLineDash([3 / viewport.zoom, 3 / viewport.zoom]);
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1 / viewport.zoom;

        for (const peg of pegs) {
            if (!peg.hasGear) continue;
            for (const nId of (adj[peg.id] || [])) {
                const key = [peg.id, nId].sort().join('-');
                if (drawn.has(key)) continue;
                drawn.add(key);
                const neighbor = pegs.find(p => p.id === nId);
                if (!neighbor) continue;
                ctx.beginPath();
                ctx.moveTo(peg.x, peg.y);
                ctx.lineTo(neighbor.x, neighbor.y);
                ctx.stroke();
            }
        }
        ctx.setLineDash([]);
    }

    function drawGear(cx, cy, radius, rotation, role, isConnected, isSelected, isLocked) {
        const outerR = radius + TOOTH_HEIGHT / 2;
        const zr = 1 / viewport.zoom;

        if (showElements) {
            const toothCount = getToothCount(radius);
            const innerR = radius - TOOTH_HEIGHT / 2;
            const angleStep = (2 * Math.PI) / (toothCount * 2);

            let bodyColor, strokeColor;
            if (role === 'driver') {
                bodyColor = GEAR_COLORS.driverBody;
                strokeColor = GEAR_COLORS.driverStroke;
            } else if (role === 'output') {
                bodyColor = GEAR_COLORS.outputBody;
                strokeColor = GEAR_COLORS.outputStroke;
            } else if (isConnected) {
                bodyColor = GEAR_COLORS.connectedBody;
                strokeColor = GEAR_COLORS.connectedStroke;
            } else {
                bodyColor = GEAR_COLORS.disconnectedBody;
                strokeColor = GEAR_COLORS.disconnectedStroke;
            }

            ctx.beginPath();
            for (let i = 0; i < toothCount * 2; i++) {
                const angle = rotation + i * angleStep;
                const r = (i % 2 === 0) ? outerR : innerR;
                const x = cx + Math.cos(angle) * r;
                const y = cy + Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fillStyle = bodyColor;
            ctx.fill();
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 1.5 * zr;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(cx, cy, innerR - 2 * zr, 0, Math.PI * 2);
            ctx.fillStyle = bodyColor;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(cx, cy, 6 * zr, 0, Math.PI * 2);
            ctx.fillStyle = strokeColor;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(cx, cy, 2.5 * zr, 0, Math.PI * 2);
            ctx.fillStyle = GRID_BG;
            ctx.fill();

            if (radius > 25) {
                const spokeCount = radius > 40 ? 6 : 4;
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = 2 * zr;
                for (let i = 0; i < spokeCount; i++) {
                    const angle = rotation + (i / spokeCount) * Math.PI * 2;
                    ctx.beginPath();
                    ctx.moveTo(cx + Math.cos(angle) * 7 * zr, cy + Math.sin(angle) * 7 * zr);
                    ctx.lineTo(cx + Math.cos(angle) * (innerR - 4 * zr), cy + Math.sin(angle) * (innerR - 4 * zr));
                    ctx.stroke();
                }
            }

            if (isLocked) {
                const s = 4 * zr;
                ctx.beginPath();
                ctx.moveTo(cx - s, cy - s);
                ctx.lineTo(cx + s, cy + s);
                ctx.moveTo(cx + s, cy - s);
                ctx.lineTo(cx - s, cy + s);
                ctx.strokeStyle = 'rgba(255, 100, 100, 0.6)';
                ctx.lineWidth = 1.5 * zr;
                ctx.stroke();
            }
        }

        if (isSelected) {
            ctx.beginPath();
            ctx.arc(cx, cy, outerR + 4 * zr, 0, Math.PI * 2);
            ctx.strokeStyle = '#00e5ff';
            ctx.lineWidth = 2 * zr;
            ctx.stroke();
        }
    }

    function drawEmptyPeg(peg, isSelected) {
        const zr = 1 / viewport.zoom;
        const r = PEG_RADIUS * zr;

        if (showElements) {
            ctx.beginPath();
            ctx.arc(peg.x, peg.y, r, 0, Math.PI * 2);
            ctx.fillStyle = '#333';
            ctx.fill();

            let ringColor = GEAR_COLORS.normalPeg;
            if (peg.role === 'driver') ringColor = GEAR_COLORS.driverPeg;
            else if (peg.role === 'output') ringColor = GEAR_COLORS.outputPeg;

            ctx.beginPath();
            ctx.arc(peg.x, peg.y, r + 3 * zr, 0, Math.PI * 2);
            ctx.strokeStyle = ringColor;
            ctx.lineWidth = 2 * zr;
            ctx.globalAlpha = 0.6;
            ctx.stroke();
            ctx.globalAlpha = 1.0;

            if (peg.role !== 'normal') {
                ctx.font = (9 / viewport.zoom) + 'px monospace';
                ctx.fillStyle = ringColor;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.globalAlpha = 0.7;
                ctx.fillText(peg.role === 'driver' ? 'D' : 'O', peg.x, peg.y + r + 6 * zr);
                ctx.globalAlpha = 1.0;
            }
        }

        if (isSelected) {
            ctx.beginPath();
            ctx.arc(peg.x, peg.y, r + 8 * zr, 0, Math.PI * 2);
            ctx.strokeStyle = '#00e5ff';
            ctx.lineWidth = 2 * zr;
            ctx.stroke();
        }
    }

    function drawPool() {
        if (gearPool.length === 0) return;
        const poolY = canvas.height - POOL_HEIGHT;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, poolY, canvas.width, POOL_HEIGHT);
        ctx.beginPath();
        ctx.moveTo(0, poolY);
        ctx.lineTo(canvas.width, poolY);
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = '10px monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('GEAR POOL', 8, poolY + 4);

        const spacing = Math.min(100, (canvas.width - 40) / gearPool.length);
        const startX = 20 + spacing / 2;

        for (let i = 0; i < gearPool.length; i++) {
            const gx = startX + i * spacing;
            const gy = poolY + POOL_HEIGHT / 2 + 4;
            const gr = gearPool[i].radius;
            const scale = 0.6;
            const toothCount = getToothCount(gr);
            const innerR = (gr - TOOTH_HEIGHT / 2) * scale;
            const outerR = (gr + TOOTH_HEIGHT / 2) * scale;
            const angleStep = (2 * Math.PI) / (toothCount * 2);

            ctx.beginPath();
            for (let t = 0; t < toothCount * 2; t++) {
                const angle = t * angleStep;
                const r = (t % 2 === 0) ? outerR : innerR;
                const px = gx + Math.cos(angle) * r;
                const py = gy + Math.sin(angle) * r;
                if (t === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fillStyle = GEAR_COLORS.poolBody;
            ctx.fill();
            ctx.strokeStyle = GEAR_COLORS.poolStroke;
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(gx, gy, 2, 0, Math.PI * 2);
            ctx.fillStyle = '#333';
            ctx.fill();

            ctx.font = '9px monospace';
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText('r' + gr, gx, gy + outerR + 4);
        }
    }

    function drawDraggingGear() {
        if (!draggingPoolGear) return;
        const gr = draggingPoolGear.radius;
        const toothCount = getToothCount(gr);
        const innerR = gr - TOOTH_HEIGHT / 2;
        const outerR = gr + TOOTH_HEIGHT / 2;
        const angleStep = (2 * Math.PI) / (toothCount * 2);

        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        for (let i = 0; i < toothCount * 2; i++) {
            const angle = i * angleStep;
            const r = (i % 2 === 0) ? outerR : innerR;
            const x = draggingPoolGear.x + Math.cos(angle) * r;
            const y = draggingPoolGear.y + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = GEAR_COLORS.poolBody;
        ctx.fill();
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(draggingPoolGear.x, draggingPoolGear.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#333';
        ctx.fill();
        ctx.restore();
    }

    function drawSnapPreview() {
        if (!draggingPoolGear) return;
        const snapPeg = findSnapPeg(draggingPoolGear.x, draggingPoolGear.y);
        if (!snapPeg) return;

        const screenX = snapPeg.x * viewport.zoom + viewport.offsetX;
        const screenY = snapPeg.y * viewport.zoom + viewport.offsetY;
        ctx.beginPath();
        ctx.arc(screenX, screenY, draggingPoolGear.radius + 8, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // ========== MOUSE HANDLERS ==========
    function _onMouseDown(e) { if (e.button === 0) handleMouseDown(e); }
    function _onMouseMove(e) { handleMouseMove(e); }
    function _onMouseUp(e) { if (e.button === 0) handleMouseUp(e); }
    function _onWheel(e) {
        e.preventDefault();
        if (scrambled && gearPool.length > 0) return;
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const oldZoom = viewport.zoom;
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        viewport.zoom = Math.max(0.2, Math.min(5, viewport.zoom * delta));
        viewport.offsetX = mx - (mx - viewport.offsetX) * (viewport.zoom / oldZoom);
        viewport.offsetY = my - (my - viewport.offsetY) * (viewport.zoom / oldZoom);
        render();
    }
    function _onContextMenu(e) {
        e.preventDefault();
        selectTool('select');
    }

    function toWorld(e) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left - viewport.offsetX) / viewport.zoom,
            y: (e.clientY - rect.top - viewport.offsetY) / viewport.zoom
        };
    }

    function toScreen(e) {
        const rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function handleMouseDown(e) {
        const { x: mx, y: my } = toWorld(e);
        const screen = toScreen(e);

        // Scrambled mode
        if (scrambled) {
            // Check gear pool first
            const poolIdx = hitTestPool(screen.x, screen.y);
            if (poolIdx !== null) {
                const gear = gearPool[poolIdx];
                draggingPoolGear = { radius: gear.radius, poolIndex: poolIdx, x: screen.x, y: screen.y };
                return;
            }

            // Pick up unlocked placed gear
            const hit = hitTest(mx, my);
            if (hit && hit.type === 'peg' && hit.element.hasGear && !hit.element.gearLocked) {
                gearPool.push({ radius: hit.element.gearRadius, index: gearPool.length });
                hit.element.hasGear = false;
                updateInfo();
                render();
                return;
            }

            // Rotate movable mirrors
            if (hit && (hit.type === 'mirror' || hit.type === 'mirror-rotate') && !hit.element.locked) {
                const angleToMouse = Math.atan2(my - hit.element.y, mx - hit.element.x);
                rotating = {
                    element: hit.element,
                    type: 'mirror',
                    startAngle: angleToMouse,
                    startElementAngle: hit.element.angle
                };
            }
            return;
        }

        // Placement tools
        if (activeTool === 'source') { addSource(mx, my, 0); render(); return; }
        if (activeTool === 'mirror') { addMirror(mx, my); render(); return; }
        if (activeTool === 'target') { addTarget(mx, my); render(); return; }
        if (activeTool === 'filter') { addFilter(mx, my); render(); return; }
        if (activeTool === 'splitter') { addSplitter(mx, my); render(); return; }
        if (activeTool === 'peg') {
            const peg = addPeg(mx, my);
            selectedElement = peg;
            selectedType = 'peg';
            updatePegConfig();
            render();
            return;
        }

        if (activeTool === 'wall') {
            if (!wallFirstPoint) {
                wallFirstPoint = { x: mx, y: my };
            } else {
                addWall(wallFirstPoint.x, wallFirstPoint.y, mx, my);
                wallFirstPoint = null;
            }
            render();
            return;
        }

        if (activeTool === 'gear') {
            const hit = hitTest(mx, my);
            if (hit && hit.type === 'peg') {
                hit.element.hasGear = !hit.element.hasGear;
                if (hit.element.hasGear && !hit.element.gearRadius) {
                    hit.element.gearRadius = DEFAULT_GEAR_RADIUS;
                }
                selectedElement = hit.element;
                selectedType = 'peg';
                updateInfo();
                updatePegConfig();
                render();
            }
            return;
        }

        if (activeTool === 'delete') {
            const hit = hitTest(mx, my);
            if (hit && hit.type !== 'mirror-rotate' && hit.type !== 'source-rotate' && hit.type !== 'wall-endpoint' && hit.type !== 'filter-rotate' && hit.type !== 'splitter-rotate') {
                if (hit.type === 'peg') {
                    deletePeg(hit.element);
                } else {
                    deletePrismaticElement(hit.type, hit.element);
                }
            }
            render();
            return;
        }

        if (activeTool === 'asset') {
            const hit = hitTest(mx, my);
            if (hit && hit.type !== 'mirror-rotate' && hit.type !== 'source-rotate' && hit.type !== 'wall-endpoint' && hit.type !== 'filter-rotate' && hit.type !== 'splitter-rotate') {
                const el = hit.element;
                const assets = typeof PuzzleAssetLibrary !== 'undefined' ? PuzzleAssetLibrary.getAll() : [];
                RadialWheel.open(assets, e.clientX, e.clientY, (assetId) => {
                    const asset = PuzzleAssetLibrary.getAsset(assetId);
                    if (asset) {
                        el.image = asset.image;
                        selectedElement = el;
                        selectedType = hit.type;
                        updateConfigPanels();
                        render();
                    }
                }, { emptyText: 'No puzzle assets' });
            }
            return;
        }

        if (activeTool === 'connect') {
            const hit = hitTest(mx, my);
            if (!hit) { connectPendingPeg = null; return; }
            const t = hit.type;
            if (!connectPendingPeg) {
                // First click: must be a peg with a gear
                if (t === 'peg' && hit.element.hasGear) {
                    connectPendingPeg = hit.element;
                    selectedElement = hit.element;
                    selectedType = 'peg';
                    updateConfigPanels();
                    render();
                }
            } else {
                // Second click: must be a rotatable element (not the same peg)
                const rotatable = ['source', 'mirror', 'filter', 'splitter'];
                if (rotatable.includes(t)) {
                    connectPendingPeg.linkedElementId = hit.element.id;
                    connectPendingPeg.linkedElementType = t;
                    hit.element.linkedPegId = connectPendingPeg.id;
                    selectedElement = hit.element;
                    selectedType = t;
                    connectPendingPeg = null;
                    updateConfigPanels();
                    render();
                } else if (t === 'peg' && hit.element.hasGear) {
                    // Clicked another gear — restart with this one
                    connectPendingPeg = hit.element;
                    selectedElement = hit.element;
                    selectedType = 'peg';
                    updateConfigPanels();
                    render();
                } else {
                    connectPendingPeg = null;
                }
            }
            return;
        }

        // Select tool
        const hit = hitTest(mx, my);
        if (hit) {
            if (hit.type === 'mirror-rotate') {
                const angleToMouse = Math.atan2(my - hit.element.y, mx - hit.element.x);
                rotating = { element: hit.element, type: 'mirror', startAngle: angleToMouse, startElementAngle: hit.element.angle };
                return;
            }
            if (hit.type === 'filter-rotate') {
                const angleToMouse = Math.atan2(my - hit.element.y, mx - hit.element.x);
                rotating = { element: hit.element, type: 'filter', startAngle: angleToMouse, startElementAngle: hit.element.angle };
                return;
            }
            if (hit.type === 'source-rotate') {
                const angleToMouse = Math.atan2(my - hit.element.y, mx - hit.element.x);
                rotating = { element: hit.element, type: 'source', startAngle: angleToMouse, startElementAngle: hit.element.angle };
                return;
            }
            if (hit.type === 'splitter-rotate') {
                const angleToMouse = Math.atan2(my - hit.element.y, mx - hit.element.x);
                rotating = { element: hit.element, type: 'splitter', startAngle: angleToMouse, startElementAngle: hit.element.angle || 0 };
                return;
            }
            if (hit.type === 'wall-endpoint') {
                dragging = {
                    element: hit.element, type: 'wall-endpoint', endpoint: hit.endpoint,
                    startMouseX: mx, startMouseY: my,
                    startX: hit.endpoint === 1 ? hit.element.x1 : hit.element.x2,
                    startY: hit.endpoint === 1 ? hit.element.y1 : hit.element.y2
                };
                return;
            }

            selectedType = hit.type;
            selectedElement = hit.element;

            if (hit.type === 'wall') {
                dragging = {
                    element: hit.element, type: 'wall',
                    startMouseX: mx, startMouseY: my,
                    startX1: hit.element.x1, startY1: hit.element.y1,
                    startX2: hit.element.x2, startY2: hit.element.y2
                };
            } else {
                dragging = {
                    element: hit.element, type: hit.type,
                    startMouseX: mx, startMouseY: my,
                    startX: hit.element.x, startY: hit.element.y
                };
            }
            updateConfigPanels();
            render();
        } else {
            selectedElement = null;
            selectedType = null;
            updateConfigPanels();
            canvas._panStart = { mx: e.clientX, my: e.clientY, ox: viewport.offsetX, oy: viewport.offsetY };
            render();
        }
    }

    function handleMouseMove(e) {
        const { x: mx, y: my } = toWorld(e);
        const screen = toScreen(e);
        mouseWorld.x = mx;
        mouseWorld.y = my;

        // Dragging pool gear
        if (draggingPoolGear) {
            draggingPoolGear.x = screen.x;
            draggingPoolGear.y = screen.y;
            render();
            return;
        }

        if (rotating) {
            const currentAngle = Math.atan2(my - rotating.element.y, mx - rotating.element.x);
            const delta = currentAngle - rotating.startAngle;
            rotating.element.angle = rotating.startElementAngle + delta;
            render();
            return;
        }

        if (dragging) {
            const ddx = mx - dragging.startMouseX;
            const ddy = my - dragging.startMouseY;

            if (dragging.type === 'wall-endpoint') {
                if (dragging.endpoint === 1) {
                    dragging.element.x1 = dragging.startX + ddx;
                    dragging.element.y1 = dragging.startY + ddy;
                } else {
                    dragging.element.x2 = dragging.startX + ddx;
                    dragging.element.y2 = dragging.startY + ddy;
                }
            } else if (dragging.type === 'wall') {
                dragging.element.x1 = dragging.startX1 + ddx;
                dragging.element.y1 = dragging.startY1 + ddy;
                dragging.element.x2 = dragging.startX2 + ddx;
                dragging.element.y2 = dragging.startY2 + ddy;
            } else {
                dragging.element.x = dragging.startX + ddx;
                dragging.element.y = dragging.startY + ddy;
            }
            render();
            return;
        }

        // Panning
        if (canvas._panStart) {
            viewport.offsetX = canvas._panStart.ox + (e.clientX - canvas._panStart.mx);
            viewport.offsetY = canvas._panStart.oy + (e.clientY - canvas._panStart.my);
            render();
            return;
        }

        // Wall preview
        if (wallFirstPoint && activeTool === 'wall') {
            render();
        }
    }

    function handleMouseUp(e) {
        // Dropping pool gear
        if (draggingPoolGear) {
            const snapPeg = findSnapPeg(draggingPoolGear.x, draggingPoolGear.y);
            if (snapPeg) {
                snapPeg.hasGear = true;
                snapPeg.gearRadius = draggingPoolGear.radius;
                gearPool.splice(draggingPoolGear.poolIndex, 1);
                gearPool.forEach((g, i) => g.index = i);

                if (checkSolved()) {
                    solvedFlash = { start: performance.now(), duration: 1500 };
                }
            }
            draggingPoolGear = null;
            updateInfo();
            render();
            return;
        }

        if (rotating) {
            rotating = null;
            if (scrambled && checkSolved()) {
                solvedFlash = { start: performance.now(), duration: 1500 };
            }
            updateInfo();
        }
        dragging = null;
        if (canvas) canvas._panStart = null;
    }

    // ========== SAVE / LOAD ==========
    function saveCurrentLemming() {
        if (!currentLemmingId) return;
        const lem = lemmings.find(l => l.id === currentLemmingId);
        if (!lem) return;
        lem.sources = sources.map(s => ({ ...s }));
        lem.mirrors = mirrors.map(m => ({ ...m }));
        lem.targets = targets.map(t => ({ ...t }));
        lem.walls = walls.map(w => ({ ...w }));
        lem.filters = filters.map(f => ({ ...f }));
        lem.splitters = splitters.map(s => ({ ...s }));
        lem.pegs = pegs.map(p => ({ ...p }));
    }

    function switchLemming(id) {
        saveCurrentLemming();
        const lem = lemmings.find(l => l.id === id);
        if (!lem) return;
        currentLemmingId = lem.id;
        sources = (lem.sources || []).map(s => ({ ...s }));
        mirrors = (lem.mirrors || []).map(m => ({ ...m }));
        targets = (lem.targets || []).map(t => ({ ...t }));
        walls = (lem.walls || []).map(w => ({ ...w }));
        filters = (lem.filters || []).map(f => ({ ...f }));
        splitters = (lem.splitters || []).map(s => ({ ...s }));
        pegs = (lem.pegs || []).map(p => ({ ...p }));
        selectedElement = null;
        selectedType = null;
        scrambled = false;
        originalAngles = null;
        originalPlacements = null;
        gearPool = [];
        draggingPoolGear = null;
        solvedFlash = null;
        wallFirstPoint = null;
        updateInfo();
        render();
    }

    function createLemming(name) {
        const id = 'lemmings_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        lemmings.push({ id, name: name || 'Untitled', sources: [], mirrors: [], targets: [], walls: [], filters: [], splitters: [], pegs: [] });
        switchLemming(id);
        return id;
    }

    function deleteLemming(id) {
        lemmings = lemmings.filter(l => l.id !== id);
        if (currentLemmingId === id) {
            if (lemmings.length > 0) {
                switchLemming(lemmings[0].id);
            } else {
                currentLemmingId = null;
                sources = []; mirrors = []; targets = []; walls = []; filters = []; splitters = []; pegs = [];
                render();
            }
        }
        updateInfo();
    }

    function getLemmingsData() {
        saveCurrentLemming();
        return {
            lemmings: lemmings.map(lem => ({
                ...lem,
                sources: (lem.sources || []).map(s => ({ ...s })),
                mirrors: (lem.mirrors || []).map(m => ({ ...m })),
                targets: (lem.targets || []).map(t => ({ ...t })),
                walls: (lem.walls || []).map(w => ({ ...w })),
                filters: (lem.filters || []).map(f => ({ ...f })),
                splitters: (lem.splitters || []).map(s => ({ ...s })),
                pegs: (lem.pegs || []).map(p => ({ ...p }))
            }))
        };
    }

    function loadLemmingsData(data) {
        if (!data) return;

        // Support loading old separate prismatic/clockwork data
        if (data.prismatics || data.clockworks) {
            lemmings = [];
            const prismatics = data.prismatics || [];
            const clockworks = data.clockworks || [];

            // Merge: pair up by index, or create separate entries
            const maxLen = Math.max(prismatics.length, clockworks.length);
            for (let i = 0; i < maxLen; i++) {
                const p = prismatics[i];
                const c = clockworks[i];
                const id = 'lemmings_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
                lemmings.push({
                    id,
                    name: (p ? p.name : null) || (c ? c.name : null) || 'Migrated',
                    sources: p ? (p.sources || []).map(s => ({ ...s })) : [],
                    mirrors: p ? (p.mirrors || []).map(m => ({ ...m })) : [],
                    targets: p ? (p.targets || []).map(t => ({ ...t })) : [],
                    walls: p ? (p.walls || []).map(w => ({ ...w })) : [],
                    filters: p ? (p.filters || []).map(f => ({ ...f })) : [],
                    splitters: [],
                    pegs: c ? (c.pegs || []).map(pg => ({ ...pg })) : []
                });
            }
        } else {
            lemmings = (data.lemmings || []).map(lem => ({
                ...lem,
                sources: (lem.sources || []).map(s => ({ ...s })),
                mirrors: (lem.mirrors || []).map(m => ({ ...m })),
                targets: (lem.targets || []).map(t => ({ ...t })),
                walls: (lem.walls || []).map(w => ({ ...w })),
                filters: (lem.filters || []).map(f => ({ ...f })),
                splitters: (lem.splitters || []).map(s => ({ ...s })),
                pegs: (lem.pegs || []).map(p => ({ ...p }))
            }));
        }

        if (lemmings.length > 0 && active) {
            switchLemming(lemmings[0].id);
        }
    }

    function getAllLemmings() { return lemmings; }
    function getCurrentLemmingId() { return currentLemmingId; }

    function refreshSidebarList() {
        if (typeof Toolbar !== 'undefined' && Toolbar.refreshLemmingsList) {
            Toolbar.refreshLemmingsList();
        }
    }

    return {
        activate, deactivate, isActive,
        getLemmingsData, loadLemmingsData,
        getAllLemmings, getCurrentLemmingId,
        switchLemming, createLemming, deleteLemming,
        refreshSidebarList
    };
})();
