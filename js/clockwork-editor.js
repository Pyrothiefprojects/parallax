const ClockworkEditor = (() => {
    // ========== STATE ==========
    let active = false;
    let canvas = null, ctx = null;
    let viewport = { offsetX: 0, offsetY: 0, zoom: 1.0 };
    let activeTool = 'select'; // 'select' | 'peg' | 'gear' | 'delete'
    let clockworks = [];            // [{ id, name, pegs }]
    let currentClockworkId = null;
    let pegs = [];                  // [{ id, x, y, role, hasGear, gearRadius, gearLocked }]
    let selectedElement = null;     // peg reference
    let dragging = null;            // { element, startMouseX/Y, startX/Y }
    let scrambled = false;
    let originalPlacements = null;  // [{ pegId, gearRadius }]
    let gearPool = [];              // [{ radius, index }] available gears during scramble
    let draggingPoolGear = null;    // { radius, index, x, y }
    let spinPhase = 0;
    let gearRotations = {};         // { pegId: angle }
    let connectedPegs = new Set();
    let solvedFlash = null;
    let animFrameId = null;
    let pulsePhase = 0;

    const GRID_SIZE = 40;
    const GRID_BG = '#1a1a2e';
    const GRID_COLOR = 'rgba(255,255,255,0.04)';
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

    const COLORS = {
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
                deletePeg(selectedElement);
                selectedElement = null;
                render();
            }
        }
        if (e.key === 'Escape') {
            selectedElement = null;
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
        if (typeof PrismaticEditor !== 'undefined' && PrismaticEditor.isActive()) PrismaticEditor.deactivate();

        active = true;
        const gameCanvas = document.getElementById('game-canvas');
        const bpCanvas = document.getElementById('blueprint-canvas');
        if (gameCanvas) gameCanvas.classList.add('hidden');
        if (bpCanvas) bpCanvas.classList.remove('hidden');

        initCanvas();
        showToolset();
        document.addEventListener('keydown', _onKeyDown);

        if (clockworks.length === 0) {
            createClockwork('Untitled');
        }
        if (!currentClockworkId && clockworks.length > 0) {
            switchClockwork(clockworks[0].id);
        }
        startAnimLoop();
        render();
    }

    function deactivate() {
        if (!active) return;
        active = false;
        saveCurrentClockwork();

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
        dragging = null;
        draggingPoolGear = null;
        activeTool = 'select';

        if (typeof Canvas !== 'undefined') Canvas.resize();
    }

    function isActive() { return active; }

    // ========== TOOLSET UI ==========
    function showToolset() {
        const panel = document.getElementById('clockwork-tools-panel');
        if (panel) panel.classList.remove('hidden');
        const body = document.getElementById('clockwork-tools-body');
        if (!body) return;

        body.innerHTML = `
            <div class="blueprint-tool-grid" style="grid-template-columns: repeat(2, 1fr);">
                <button class="blueprint-tool active" data-tool="select" title="Select">
                    <span class="tool-icon">&#10022;</span>
                    <span class="tool-label">Select</span>
                </button>
                <button class="blueprint-tool" data-tool="peg" title="Place Peg">
                    <span class="tool-icon">&#8857;</span>
                    <span class="tool-label">Peg</span>
                </button>
                <button class="blueprint-tool" data-tool="gear" title="Add/Remove Gear">
                    <span class="tool-icon">&#9881;</span>
                    <span class="tool-label">Gear</span>
                </button>
                <button class="blueprint-tool" data-tool="delete" title="Delete">
                    <span class="tool-icon">&#10005;</span>
                    <span class="tool-label">Delete</span>
                </button>
            </div>
            <div style="margin-top:10px; display:flex; gap:6px; flex-wrap:wrap;">
                <button class="panel-btn clockwork-scramble-btn" id="clockwork-scramble">Scramble</button>
                <button class="panel-btn clockwork-reset-btn" id="clockwork-reset">Reset</button>
            </div>
            <div style="margin-top:8px; font-size:11px; color:var(--text-secondary);">
                <span id="clockwork-info">Pegs: 0 | Gears: 0</span>
            </div>
            <div style="margin-top:6px; font-size:10px; color:var(--text-secondary);" id="clockwork-status"></div>
            <div id="clockwork-peg-config" class="hidden" style="margin-top:10px; border-top:1px solid rgba(255,255,255,0.1); padding-top:8px;">
                <div style="font-size:10px; color:var(--text-secondary); margin-bottom:6px;">Peg Config</div>
                <div style="display:flex; gap:4px; margin-bottom:8px;">
                    <button class="panel-btn clockwork-role-btn" data-role="normal" style="flex:1; font-size:10px;">Normal</button>
                    <button class="panel-btn clockwork-role-btn" data-role="driver" style="flex:1; font-size:10px;">Driver</button>
                    <button class="panel-btn clockwork-role-btn" data-role="output" style="flex:1; font-size:10px;">Output</button>
                </div>
                <div id="clockwork-gear-section">
                    <label style="display:flex; align-items:center; gap:6px; font-size:11px; color:var(--text-secondary); cursor:pointer;">
                        <input type="checkbox" id="clockwork-has-gear"> Has Gear
                    </label>
                    <div id="clockwork-gear-options" class="hidden" style="margin-top:6px;">
                        <div>
                            <label style="font-size:10px; color:var(--text-secondary);">Radius: <span id="clockwork-radius-label">30</span></label>
                            <input type="range" id="clockwork-gear-radius" min="15" max="60" value="30" style="width:100%; margin-top:2px;">
                        </div>
                        <label style="display:flex; align-items:center; gap:6px; font-size:11px; color:var(--text-secondary); cursor:pointer; margin-top:6px;">
                            <input type="checkbox" id="clockwork-gear-locked"> Locked (fixed in play)
                        </label>
                    </div>
                </div>
            </div>
        `;

        // Tool buttons
        body.querySelectorAll('.blueprint-tool').forEach(btn => {
            btn.addEventListener('click', () => selectTool(btn.dataset.tool));
        });

        // Scramble / Reset
        document.getElementById('clockwork-scramble').addEventListener('click', scramble);
        document.getElementById('clockwork-reset').addEventListener('click', reset);

        // Role buttons
        body.querySelectorAll('.clockwork-role-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!selectedElement || scrambled) return;
                // If setting driver/output, clear any existing one with that role
                const newRole = btn.dataset.role;
                if (newRole === 'driver' || newRole === 'output') {
                    pegs.forEach(p => { if (p.role === newRole && p !== selectedElement) p.role = 'normal'; });
                }
                selectedElement.role = newRole;
                updateConfigPanel();
                render();
            });
        });

        // Has gear checkbox
        document.getElementById('clockwork-has-gear').addEventListener('change', (e) => {
            if (!selectedElement || scrambled) return;
            selectedElement.hasGear = e.target.checked;
            if (e.target.checked && !selectedElement.gearRadius) {
                selectedElement.gearRadius = DEFAULT_GEAR_RADIUS;
            }
            updateConfigPanel();
            render();
        });

        // Gear radius slider
        document.getElementById('clockwork-gear-radius').addEventListener('input', (e) => {
            if (!selectedElement || scrambled) return;
            selectedElement.gearRadius = parseInt(e.target.value);
            document.getElementById('clockwork-radius-label').textContent = e.target.value;
            render();
        });

        // Gear locked checkbox
        document.getElementById('clockwork-gear-locked').addEventListener('change', (e) => {
            if (!selectedElement || scrambled) return;
            selectedElement.gearLocked = e.target.checked;
            render();
        });

        // Close button
        const closeBtn = document.getElementById('clockwork-tools-close');
        if (closeBtn) closeBtn.addEventListener('click', () => {
            const p = document.getElementById('clockwork-tools-panel');
            if (p) p.classList.add('hidden');
        });

        updateInfo();
    }

    function hideToolset() {
        const panel = document.getElementById('clockwork-tools-panel');
        if (panel) panel.classList.add('hidden');
    }

    function selectTool(tool) {
        if (activeTool === tool && tool !== 'select') {
            activeTool = 'select';
        } else {
            activeTool = tool;
        }
        const body = document.getElementById('clockwork-tools-body');
        if (body) {
            body.querySelectorAll('.blueprint-tool').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tool === activeTool);
            });
        }
        render();
    }

    function updateInfo() {
        const el = document.getElementById('clockwork-info');
        const gearCount = pegs.filter(p => p.hasGear).length;
        if (el) el.textContent = 'Pegs: ' + pegs.length + ' | Gears: ' + gearCount;

        const status = document.getElementById('clockwork-status');
        if (status) {
            if (scrambled) {
                const solved = checkSolved();
                if (solved) {
                    status.textContent = 'SOLVED!';
                    status.style.color = '#00e5ff';
                } else {
                    status.textContent = 'Pool: ' + gearPool.length + ' gear' + (gearPool.length !== 1 ? 's' : '') + ' remaining';
                    status.style.color = gearPool.length > 0 ? 'var(--accent-rust)' : 'var(--text-secondary)';
                }
            } else {
                const chain = findChain();
                const driver = pegs.find(p => p.role === 'driver' && p.hasGear);
                const output = pegs.find(p => p.role === 'output');
                if (driver && output && chain.has(output.id)) {
                    status.textContent = 'Chain connected';
                    status.style.color = '#4CAF50';
                } else if (driver && output) {
                    status.textContent = 'Chain broken';
                    status.style.color = 'var(--text-secondary)';
                } else {
                    status.textContent = '';
                }
            }
        }
        updateConfigPanel();
    }

    function updateConfigPanel() {
        const cfg = document.getElementById('clockwork-peg-config');
        if (!cfg) return;
        if (selectedElement && !scrambled) {
            cfg.classList.remove('hidden');
            // Role buttons
            cfg.querySelectorAll('.clockwork-role-btn').forEach(btn => {
                const isActive = btn.dataset.role === selectedElement.role;
                btn.style.background = isActive ? 'var(--accent-rust)' : '';
                btn.style.color = isActive ? '#fff' : '';
            });
            // Has gear
            const hasGearCb = document.getElementById('clockwork-has-gear');
            if (hasGearCb) hasGearCb.checked = selectedElement.hasGear;
            // Gear options
            const gearOpts = document.getElementById('clockwork-gear-options');
            if (gearOpts) {
                if (selectedElement.hasGear) {
                    gearOpts.classList.remove('hidden');
                    const slider = document.getElementById('clockwork-gear-radius');
                    const label = document.getElementById('clockwork-radius-label');
                    if (slider) slider.value = selectedElement.gearRadius || DEFAULT_GEAR_RADIUS;
                    if (label) label.textContent = selectedElement.gearRadius || DEFAULT_GEAR_RADIUS;
                    const lockedCb = document.getElementById('clockwork-gear-locked');
                    if (lockedCb) lockedCb.checked = selectedElement.gearLocked;
                } else {
                    gearOpts.classList.add('hidden');
                }
            }
        } else {
            cfg.classList.add('hidden');
        }
    }

    // ========== PEG CRUD ==========
    function _genId(prefix) {
        return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 4);
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

    function deletePeg(peg) {
        pegs = pegs.filter(p => p !== peg);
        if (selectedElement === peg) selectedElement = null;
        updateInfo();
    }

    // ========== GEOMETRY ==========
    function dist(ax, ay, bx, by) {
        return Math.hypot(ax - bx, ay - by);
    }

    function getToothCount(radius) {
        return Math.max(8, Math.round(2 * Math.PI * radius / TOOTH_SPACING));
    }

    // ========== MESH GRAPH ==========
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

                // Opposite direction, scaled by gear ratio
                const parentAngle = gearRotations[currentId];
                gearRotations[neighborId] = -parentAngle * (current.gearRadius / neighbor.gearRadius);
            }
        }
    }

    // ========== SOLVE CHECK ==========
    function checkSolved() {
        if (!scrambled) return false;
        if (gearPool.length > 0) return false;
        const output = pegs.find(p => p.role === 'output');
        if (!output || !output.hasGear) return false;
        const chain = findChain();
        return chain.has(output.id);
    }

    // ========== SCRAMBLE / RESET ==========
    function scramble() {
        const movable = pegs.filter(p => p.hasGear && !p.gearLocked);
        if (movable.length === 0) return;

        // Need at least driver and output
        const driver = pegs.find(p => p.role === 'driver' && p.hasGear);
        const output = pegs.find(p => p.role === 'output');
        if (!driver || !output) return;

        // Save original placements
        originalPlacements = movable.map(p => ({ pegId: p.id, gearRadius: p.gearRadius }));
        scrambled = true;

        // Remove gears from pegs → pool
        gearPool = [];
        for (const p of movable) {
            gearPool.push({ radius: p.gearRadius, index: gearPool.length });
            p.hasGear = false;
        }

        // Shuffle pool for variety
        for (let i = gearPool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = gearPool[i];
            gearPool[i] = gearPool[j];
            gearPool[j] = tmp;
        }
        // Re-index after shuffle
        gearPool.forEach((g, i) => g.index = i);

        solvedFlash = null;
        draggingPoolGear = null;
        startAnimLoop();
        updateInfo();
        render();
    }

    function reset() {
        if (!originalPlacements) return;
        for (const orig of originalPlacements) {
            const peg = pegs.find(p => p.id === orig.pegId);
            if (peg) {
                peg.hasGear = true;
                peg.gearRadius = orig.gearRadius;
            }
        }
        originalPlacements = null;
        scrambled = false;
        gearPool = [];
        draggingPoolGear = null;
        solvedFlash = null;
        updateInfo();
        render();
    }

    // ========== HIT TESTING ==========
    function hitTestPeg(mx, my) {
        const zr = 1 / viewport.zoom;
        for (const peg of pegs) {
            const hitRadius = peg.hasGear ? (peg.gearRadius + TOOTH_HEIGHT / 2) * zr : (PEG_RADIUS + 6) * zr;
            if (dist(mx, my, peg.x, peg.y) < hitRadius) {
                return peg;
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
            const gr = gearPool[i].radius * 0.6; // scaled down in pool
            if (dist(screenX, screenY, gx, gy) < gr + 10) {
                return i;
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

        calculateRotations();

        ctx.fillStyle = GRID_BG;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.translate(viewport.offsetX, viewport.offsetY);
        ctx.scale(viewport.zoom, viewport.zoom);

        drawGrid();

        // Mesh lines between meshing gears
        drawMeshLines();

        // Pegs and gears
        for (const peg of pegs) {
            if (peg.hasGear) {
                const rotation = gearRotations[peg.id] || 0;
                const isConnected = connectedPegs.has(peg.id);
                const isSelected = selectedElement === peg;
                drawGear(peg.x, peg.y, peg.gearRadius, rotation, peg.role, isConnected, isSelected, peg.gearLocked);
            } else {
                drawEmptyPeg(peg, selectedElement === peg);
            }
        }

        ctx.restore();

        // Pool area (screen space)
        if (scrambled) {
            drawPool();
        }

        // Dragging pool gear follows cursor
        if (draggingPoolGear) {
            drawDraggingGear();
        }

        // Snap preview
        if (draggingPoolGear) {
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

    function drawMeshLines() {
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
        const toothCount = getToothCount(radius);
        const innerR = radius - TOOTH_HEIGHT / 2;
        const outerR = radius + TOOTH_HEIGHT / 2;
        const angleStep = (2 * Math.PI) / (toothCount * 2);
        const zr = 1 / viewport.zoom;

        // Gear colors
        let bodyColor, strokeColor;
        if (role === 'driver') {
            bodyColor = COLORS.driverBody;
            strokeColor = COLORS.driverStroke;
        } else if (role === 'output') {
            bodyColor = COLORS.outputBody;
            strokeColor = COLORS.outputStroke;
        } else if (isConnected) {
            bodyColor = COLORS.connectedBody;
            strokeColor = COLORS.connectedStroke;
        } else {
            bodyColor = COLORS.disconnectedBody;
            strokeColor = COLORS.disconnectedStroke;
        }

        // Gear tooth path
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

        // Inner body circle
        ctx.beginPath();
        ctx.arc(cx, cy, innerR - 2 * zr, 0, Math.PI * 2);
        ctx.fillStyle = bodyColor;
        ctx.fill();

        // Center hub
        ctx.beginPath();
        ctx.arc(cx, cy, 6 * zr, 0, Math.PI * 2);
        ctx.fillStyle = strokeColor;
        ctx.fill();

        // Axle hole
        ctx.beginPath();
        ctx.arc(cx, cy, 2.5 * zr, 0, Math.PI * 2);
        ctx.fillStyle = GRID_BG;
        ctx.fill();

        // Spokes (for larger gears)
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

        // Locked X indicator
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

        // Selection ring
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

        // Peg body
        ctx.beginPath();
        ctx.arc(peg.x, peg.y, r, 0, Math.PI * 2);
        ctx.fillStyle = '#333';
        ctx.fill();

        // Role-colored ring
        let ringColor = COLORS.normalPeg;
        if (peg.role === 'driver') ringColor = COLORS.driverPeg;
        else if (peg.role === 'output') ringColor = COLORS.outputPeg;

        ctx.beginPath();
        ctx.arc(peg.x, peg.y, r + 3 * zr, 0, Math.PI * 2);
        ctx.strokeStyle = ringColor;
        ctx.lineWidth = 2 * zr;
        ctx.globalAlpha = 0.6;
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        // Role label
        if (peg.role !== 'normal') {
            ctx.font = (9 / viewport.zoom) + 'px monospace';
            ctx.fillStyle = ringColor;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.globalAlpha = 0.7;
            ctx.fillText(peg.role === 'driver' ? 'D' : 'O', peg.x, peg.y + r + 6 * zr);
            ctx.globalAlpha = 1.0;
        }

        // Selection ring
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

        // Pool background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, poolY, canvas.width, POOL_HEIGHT);

        // Separator line
        ctx.beginPath();
        ctx.moveTo(0, poolY);
        ctx.lineTo(canvas.width, poolY);
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Pool label
        ctx.font = '10px monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('GEAR POOL', 8, poolY + 4);

        // Draw pool gears
        const spacing = Math.min(100, (canvas.width - 40) / gearPool.length);
        const startX = 20 + spacing / 2;

        for (let i = 0; i < gearPool.length; i++) {
            const gx = startX + i * spacing;
            const gy = poolY + POOL_HEIGHT / 2 + 4;
            const gr = gearPool[i].radius;
            const scale = 0.6;
            const toothCount = getToothCount(gr);

            // Draw mini gear
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
            ctx.fillStyle = COLORS.poolBody;
            ctx.fill();
            ctx.strokeStyle = COLORS.poolStroke;
            ctx.lineWidth = 1;
            ctx.stroke();

            // Center
            ctx.beginPath();
            ctx.arc(gx, gy, 2, 0, Math.PI * 2);
            ctx.fillStyle = '#333';
            ctx.fill();

            // Radius label
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
        ctx.fillStyle = COLORS.poolBody;
        ctx.fill();
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Center
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

        // Draw a highlight ring on the snap target peg
        const screenX = snapPeg.x * viewport.zoom + viewport.offsetX;
        const screenY = snapPeg.y * viewport.zoom + viewport.offsetY;
        ctx.beginPath();
        ctx.arc(screenX, screenY, draggingPoolGear.radius + 8, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    function findSnapPeg(screenX, screenY) {
        // Convert screen to world
        const wx = (screenX - viewport.offsetX) / viewport.zoom;
        const wy = (screenY - viewport.offsetY) / viewport.zoom;

        for (const peg of pegs) {
            if (peg.hasGear) continue; // Only snap to empty pegs
            const pegScreenX = peg.x * viewport.zoom + viewport.offsetX;
            const pegScreenY = peg.y * viewport.zoom + viewport.offsetY;
            if (dist(screenX, screenY, pegScreenX, pegScreenY) < SNAP_DISTANCE * viewport.zoom) {
                return peg;
            }
        }
        return null;
    }

    // ========== MOUSE HANDLERS ==========
    function _onMouseDown(e) { if (e.button === 0) handleMouseDown(e); }
    function _onMouseMove(e) { handleMouseMove(e); }
    function _onMouseUp(e) { if (e.button === 0) handleMouseUp(e); }
    function _onWheel(e) {
        e.preventDefault();
        if (scrambled) return; // No zoom during scramble (pool is screen-space)
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

        // Scrambled mode: interact with pool and pegs
        if (scrambled) {
            // Check pool first
            const poolIdx = hitTestPool(screen.x, screen.y);
            if (poolIdx !== null) {
                const gear = gearPool[poolIdx];
                draggingPoolGear = { radius: gear.radius, poolIndex: poolIdx, x: screen.x, y: screen.y };
                return;
            }

            // Check if clicking on an unlocked placed gear to pick it back up
            const hitPeg = hitTestPeg(mx, my);
            if (hitPeg && hitPeg.hasGear && !hitPeg.gearLocked) {
                // Pick up gear back to pool
                gearPool.push({ radius: hitPeg.gearRadius, index: gearPool.length });
                hitPeg.hasGear = false;
                updateInfo();
                render();
            }
            return;
        }

        // Editor mode
        if (activeTool === 'peg') {
            const peg = addPeg(mx, my);
            selectedElement = peg;
            updateConfigPanel();
            render();
            return;
        }

        if (activeTool === 'gear') {
            const hitPeg = hitTestPeg(mx, my);
            if (hitPeg) {
                hitPeg.hasGear = !hitPeg.hasGear;
                if (hitPeg.hasGear && !hitPeg.gearRadius) {
                    hitPeg.gearRadius = DEFAULT_GEAR_RADIUS;
                }
                selectedElement = hitPeg;
                updateInfo();
                updateConfigPanel();
                render();
            }
            return;
        }

        if (activeTool === 'delete') {
            const hitPeg = hitTestPeg(mx, my);
            if (hitPeg) {
                deletePeg(hitPeg);
            }
            render();
            return;
        }

        // Select tool
        const hitPeg = hitTestPeg(mx, my);
        if (hitPeg) {
            selectedElement = hitPeg;
            dragging = {
                element: hitPeg,
                startMouseX: mx, startMouseY: my,
                startX: hitPeg.x, startY: hitPeg.y
            };
            updateConfigPanel();
            render();
        } else {
            selectedElement = null;
            updateConfigPanel();
            // Start panning
            canvas._panStart = { mx: e.clientX, my: e.clientY, ox: viewport.offsetX, oy: viewport.offsetY };
            render();
        }
    }

    function handleMouseMove(e) {
        const { x: mx, y: my } = toWorld(e);
        const screen = toScreen(e);

        // Dragging pool gear
        if (draggingPoolGear) {
            draggingPoolGear.x = screen.x;
            draggingPoolGear.y = screen.y;
            render();
            return;
        }

        // Dragging peg
        if (dragging) {
            const ddx = mx - dragging.startMouseX;
            const ddy = my - dragging.startMouseY;
            dragging.element.x = dragging.startX + ddx;
            dragging.element.y = dragging.startY + ddy;
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
    }

    function handleMouseUp(e) {
        const screen = toScreen(e);

        // Dropping pool gear
        if (draggingPoolGear) {
            const snapPeg = findSnapPeg(draggingPoolGear.x, draggingPoolGear.y);
            if (snapPeg) {
                // Place gear on peg
                snapPeg.hasGear = true;
                snapPeg.gearRadius = draggingPoolGear.radius;
                // Remove from pool
                gearPool.splice(draggingPoolGear.poolIndex, 1);
                gearPool.forEach((g, i) => g.index = i);

                // Check solved
                if (checkSolved()) {
                    solvedFlash = { start: performance.now(), duration: 1500 };
                }
            }
            draggingPoolGear = null;
            updateInfo();
            render();
            return;
        }

        dragging = null;
        if (canvas) canvas._panStart = null;
    }

    // ========== SAVE / LOAD ==========
    function saveCurrentClockwork() {
        if (!currentClockworkId) return;
        const cw = clockworks.find(c => c.id === currentClockworkId);
        if (!cw) return;
        cw.pegs = pegs.map(p => ({ ...p }));
    }

    function switchClockwork(id) {
        saveCurrentClockwork();
        const cw = clockworks.find(c => c.id === id);
        if (!cw) return;
        currentClockworkId = cw.id;
        pegs = (cw.pegs || []).map(p => ({ ...p }));
        selectedElement = null;
        scrambled = false;
        originalPlacements = null;
        gearPool = [];
        draggingPoolGear = null;
        solvedFlash = null;
        updateInfo();
        render();
    }

    function createClockwork(name) {
        const id = 'clockwork_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        clockworks.push({ id, name: name || 'Untitled', pegs: [] });
        switchClockwork(id);
        return id;
    }

    function deleteClockwork(id) {
        clockworks = clockworks.filter(c => c.id !== id);
        if (currentClockworkId === id) {
            if (clockworks.length > 0) {
                switchClockwork(clockworks[0].id);
            } else {
                currentClockworkId = null;
                pegs = [];
                render();
            }
        }
        updateInfo();
    }

    function getClockworkData() {
        saveCurrentClockwork();
        return {
            clockworks: clockworks.map(cw => ({
                ...cw,
                pegs: (cw.pegs || []).map(p => ({ ...p }))
            }))
        };
    }

    function loadClockworkData(data) {
        if (!data) return;
        clockworks = (data.clockworks || []).map(cw => ({
            ...cw,
            pegs: (cw.pegs || []).map(p => ({ ...p }))
        }));
        if (clockworks.length > 0 && active) {
            switchClockwork(clockworks[0].id);
        }
    }

    function getAllClockworks() { return clockworks; }
    function getCurrentClockworkId() { return currentClockworkId; }

    function refreshSidebarList() {
        if (typeof Toolbar !== 'undefined' && Toolbar.refreshClockworkList) {
            Toolbar.refreshClockworkList();
        }
    }

    return {
        activate, deactivate, isActive,
        getClockworkData, loadClockworkData,
        getAllClockworks, getCurrentClockworkId,
        switchClockwork, createClockwork, deleteClockwork,
        refreshSidebarList
    };
})();
