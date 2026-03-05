const PrismaticEditor = (() => {
    // ========== STATE ==========
    let active = false;
    let canvas = null, ctx = null;
    let viewport = { offsetX: 0, offsetY: 0, zoom: 1.0 };
    let activeTool = 'select'; // 'select' | 'source' | 'mirror' | 'target' | 'wall' | 'filter' | 'delete'
    let prismatics = [];           // [{ id, name, sources, mirrors, targets, walls, filters }]
    let currentPrismaticId = null;
    let sources = [];              // [{ id, x, y, angle }]
    let mirrors = [];              // [{ id, x, y, angle, length, locked, color }]
    let targets = [];              // [{ id, x, y }]
    let walls = [];                // [{ id, x1, y1, x2, y2 }]
    let filters = [];              // [{ id, x, y, angle, length, color }]
    let selectedType = null;       // 'source' | 'mirror' | 'target' | 'wall' | 'filter' | null
    let selectedElement = null;
    let dragging = null;           // { element, type, startMouseX/Y, startX/Y }
    let rotating = null;           // { element, type, startAngle, startElementAngle }
    let wallFirstPoint = null;     // { x, y } for 2-click wall placement
    let mouseWorld = { x: 0, y: 0 };
    let originalAngles = null;     // [{ id, angle }] saved before scramble
    let scrambled = false;
    let pulsePhase = 0;
    let animFrameId = null;
    let solvedFlash = null;
    let beamSegments = [];         // [{ x1,y1, x2,y2, hitType, color }]
    let hitTargets = new Set();

    const GRID_SIZE = 40;
    const GRID_BG = '#1a1a2e';
    const GRID_COLOR = 'rgba(255,255,255,0.04)';
    const SOURCE_RADIUS = 12;
    const TARGET_RADIUS = 10;
    const MIRROR_DEFAULT_LENGTH = 60;
    const FILTER_DEFAULT_LENGTH = 50;
    const MAX_BEAM_LENGTH = 5000;
    const MAX_BOUNCES = 50;
    const BEAM_COLOR = '#00e5ff';
    const COLOR_PRESETS = ['#ff3333', '#33ff33', '#3388ff', '#ffcc00', '#ff33ff', '#ff8800', '#00e5ff'];

    // ========== KEY HANDLER ==========
    function _onKeyDown(e) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (selectedElement && !scrambled) {
                deleteElement(selectedType, selectedElement);
                selectedElement = null;
                selectedType = null;
                render();
            }
        }
        if (e.key === 'Escape') {
            wallFirstPoint = null;
            selectedElement = null;
            selectedType = null;
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

        if (prismatics.length === 0) {
            createPrismatic('Untitled');
        }
        if (!currentPrismaticId && prismatics.length > 0) {
            switchPrismatic(prismatics[0].id);
        }
        startAnimLoop();
        render();
    }

    function deactivate() {
        if (!active) return;
        active = false;
        saveCurrentPrismatic();

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
        activeTool = 'select';

        if (typeof Canvas !== 'undefined') Canvas.resize();
    }

    function isActive() { return active; }

    // ========== TOOLSET UI ==========
    function showToolset() {
        const panel = document.getElementById('prismatic-tools-panel');
        if (panel) panel.classList.remove('hidden');
        const body = document.getElementById('prismatic-tools-body');
        if (!body) return;

        body.innerHTML = `
            <div class="blueprint-tool-grid" style="grid-template-columns: repeat(3, 1fr);">
                <button class="blueprint-tool active" data-tool="select" title="Select">
                    <span class="tool-icon">&#10022;</span>
                    <span class="tool-label">Select</span>
                </button>
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
                <button class="blueprint-tool" data-tool="delete" title="Delete">
                    <span class="tool-icon">&#10005;</span>
                    <span class="tool-label">Delete</span>
                </button>
            </div>
            <div style="margin-top:10px; display:flex; gap:6px; flex-wrap:wrap;">
                <button class="panel-btn prismatic-scramble-btn" id="prismatic-scramble">Scramble</button>
                <button class="panel-btn prismatic-reset-btn" id="prismatic-reset">Reset</button>
            </div>
            <div style="margin-top:8px; font-size:11px; color:var(--text-secondary);">
                <span id="prismatic-info">Sources: 0 | Mirrors: 0 | Filters: 0 | Targets: 0</span>
            </div>
            <div style="margin-top:6px; font-size:10px; color:var(--text-secondary);" id="prismatic-status"></div>
            <div id="prismatic-mirror-config" class="hidden" style="margin-top:10px; border-top:1px solid rgba(255,255,255,0.1); padding-top:8px;">
                <div style="font-size:10px; color:var(--text-secondary); margin-bottom:4px;">Mirror Config</div>
                <label style="display:flex; align-items:center; gap:6px; font-size:11px; color:var(--text-secondary); cursor:pointer;">
                    <input type="checkbox" id="prismatic-mirror-locked"> Locked (fixed in play)
                </label>
                <div style="margin-top:6px;">
                    <label style="font-size:10px; color:var(--text-secondary);">Length</label>
                    <input type="range" id="prismatic-mirror-length" min="30" max="160" value="60" style="width:100%; margin-top:2px;">
                </div>
                <div style="margin-top:6px;">
                    <label style="font-size:10px; color:var(--text-secondary);">Beam Color</label>
                    <div id="prismatic-mirror-colors" style="display:flex; gap:4px; margin-top:4px; flex-wrap:wrap;"></div>
                </div>
            </div>
            <div id="prismatic-filter-config" class="hidden" style="margin-top:10px; border-top:1px solid rgba(255,255,255,0.1); padding-top:8px;">
                <div style="font-size:10px; color:var(--text-secondary); margin-bottom:4px;">Filter Config</div>
                <div style="margin-top:6px;">
                    <label style="font-size:10px; color:var(--text-secondary);">Length</label>
                    <input type="range" id="prismatic-filter-length" min="30" max="160" value="50" style="width:100%; margin-top:2px;">
                </div>
                <div style="margin-top:6px;">
                    <label style="font-size:10px; color:var(--text-secondary);">Color</label>
                    <div id="prismatic-filter-colors" style="display:flex; gap:4px; margin-top:4px; flex-wrap:wrap;"></div>
                </div>
            </div>
        `;

        // Tool buttons
        body.querySelectorAll('.blueprint-tool').forEach(btn => {
            btn.addEventListener('click', () => selectTool(btn.dataset.tool));
        });

        // Scramble / Reset
        document.getElementById('prismatic-scramble').addEventListener('click', scrambleMirrors);
        document.getElementById('prismatic-reset').addEventListener('click', resetMirrors);

        // Mirror config
        const lockedCb = document.getElementById('prismatic-mirror-locked');
        lockedCb.addEventListener('change', () => {
            if (selectedElement && selectedType === 'mirror') {
                selectedElement.locked = lockedCb.checked;
                render();
            }
        });
        const lengthSlider = document.getElementById('prismatic-mirror-length');
        lengthSlider.addEventListener('input', () => {
            if (selectedElement && selectedType === 'mirror') {
                selectedElement.length = parseInt(lengthSlider.value);
                render();
            }
        });

        // Filter config
        const filterLengthSlider = document.getElementById('prismatic-filter-length');
        filterLengthSlider.addEventListener('input', () => {
            if (selectedElement && selectedType === 'filter') {
                selectedElement.length = parseInt(filterLengthSlider.value);
                render();
            }
        });

        // Close button
        const closeBtn = document.getElementById('prismatic-tools-close');
        if (closeBtn) closeBtn.addEventListener('click', () => {
            const p = document.getElementById('prismatic-tools-panel');
            if (p) p.classList.add('hidden');
        });

        updateInfo();
    }

    function hideToolset() {
        const panel = document.getElementById('prismatic-tools-panel');
        if (panel) panel.classList.add('hidden');
    }

    function selectTool(tool) {
        if (activeTool === tool && tool !== 'select') {
            activeTool = 'select';
        } else {
            activeTool = tool;
        }
        wallFirstPoint = null;
        const body = document.getElementById('prismatic-tools-body');
        if (body) {
            body.querySelectorAll('.blueprint-tool').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tool === activeTool);
            });
        }
        render();
    }

    function updateInfo() {
        const el = document.getElementById('prismatic-info');
        if (el) el.textContent = `Sources: ${sources.length} | Mirrors: ${mirrors.length} | Filters: ${filters.length} | Targets: ${targets.length}`;
        const status = document.getElementById('prismatic-status');
        if (status) {
            if (scrambled) {
                const allHit = targets.length > 0 && hitTargets.size === targets.length;
                if (allHit) {
                    status.textContent = 'SOLVED!';
                    status.style.color = '#00e5ff';
                } else {
                    status.textContent = `Targets hit: ${hitTargets.size}/${targets.length}`;
                    status.style.color = hitTargets.size > 0 ? 'var(--text-secondary)' : 'var(--accent-rust)';
                }
            } else {
                status.textContent = '';
            }
        }
        updateConfigPanels();
    }

    function updateConfigPanels() {
        updateMirrorConfig();
        updateFilterConfig();
    }

    function updateMirrorConfig() {
        const cfg = document.getElementById('prismatic-mirror-config');
        if (!cfg) return;
        if (selectedType === 'mirror' && selectedElement && !scrambled) {
            cfg.classList.remove('hidden');
            const lockedCb = document.getElementById('prismatic-mirror-locked');
            const lengthSlider = document.getElementById('prismatic-mirror-length');
            if (lockedCb) lockedCb.checked = selectedElement.locked;
            if (lengthSlider) lengthSlider.value = selectedElement.length;
            populateColorSwatches('prismatic-mirror-colors', selectedElement.color, true, (color) => {
                selectedElement.color = color;
                updateMirrorConfig();
                render();
            });
        } else {
            cfg.classList.add('hidden');
        }
    }

    function updateFilterConfig() {
        const cfg = document.getElementById('prismatic-filter-config');
        if (!cfg) return;
        if (selectedType === 'filter' && selectedElement && !scrambled) {
            cfg.classList.remove('hidden');
            const lengthSlider = document.getElementById('prismatic-filter-length');
            if (lengthSlider) lengthSlider.value = selectedElement.length;
            populateColorSwatches('prismatic-filter-colors', selectedElement.color, false, (color) => {
                selectedElement.color = color;
                updateFilterConfig();
                render();
            });
        } else {
            cfg.classList.add('hidden');
        }
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

    function deleteElement(type, element) {
        if (type === 'source') sources = sources.filter(s => s !== element);
        else if (type === 'mirror') mirrors = mirrors.filter(m => m !== element);
        else if (type === 'target') targets = targets.filter(t => t !== element);
        else if (type === 'wall') walls = walls.filter(w => w !== element);
        else if (type === 'filter') filters = filters.filter(f => f !== element);
        if (selectedElement === element) {
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

    // ========== BEAM TRACING ==========
    function traceAllBeams() {
        beamSegments = [];
        hitTargets = new Set();
        const tgtRadius = TARGET_RADIUS / viewport.zoom;

        for (const src of sources) {
            let rayOx = src.x, rayOy = src.y;
            let rayDx = Math.cos(src.angle), rayDy = Math.sin(src.angle);
            let bounces = 0;
            let currentColor = BEAM_COLOR;

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

                if (!nearest) {
                    // Beam fades into void
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
                    hitTargets.add(nearestElement.id);
                    break;
                }

                if (nearestType === 'filter') {
                    // Beam passes through, color changes
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
                }
            }
        }
    }

    // ========== SOLVE CHECK ==========
    function checkSolved() {
        if (!scrambled) return false;
        if (targets.length === 0) return false;
        return hitTargets.size === targets.length;
    }

    // ========== SCRAMBLE / RESET ==========
    function scrambleMirrors() {
        const movable = mirrors.filter(m => !m.locked);
        if (movable.length === 0) return;

        // Save original angles
        originalAngles = movable.map(m => ({ id: m.id, angle: m.angle }));
        scrambled = true;

        // Randomize movable mirror angles, ensure not accidentally solved
        let attempts = 0;
        do {
            for (const mir of movable) {
                mir.angle = Math.random() * Math.PI;
            }
            traceAllBeams();
            attempts++;
        } while (checkSolved() && attempts < 30);

        solvedFlash = null;
        startAnimLoop();
        updateInfo();
        render();
    }

    function resetMirrors() {
        if (!originalAngles) return;
        for (const orig of originalAngles) {
            const mir = mirrors.find(m => m.id === orig.id);
            if (mir) mir.angle = orig.angle;
        }
        originalAngles = null;
        scrambled = false;
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

        // Mirror rotation handle (endpoint 2 of selected mirror)
        if (selectedElement && selectedType === 'mirror') {
            const seg = mirrorToSegment(selectedElement);
            if (dist(mx, my, seg.x2, seg.y2) < 8 * zr) {
                return { type: 'mirror-rotate', element: selectedElement };
            }
        }

        // Filter rotation handle (endpoint 2 of selected filter)
        if (selectedElement && selectedType === 'filter') {
            const seg = filterToSegment(selectedElement);
            if (dist(mx, my, seg.x2, seg.y2) < 8 * zr) {
                return { type: 'filter-rotate', element: selectedElement };
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

    // ========== ANIMATION LOOP ==========
    function animLoop() {
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

        // Trace beams every frame
        traceAllBeams();

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

        // Filters (draw before beams so beam renders on top)
        for (const fil of filters) {
            drawFilter(fil, selectedElement === fil);
        }

        // Beams
        drawBeams();

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

        // Solved flash overlay
        if (solvedFlash) {
            const elapsed = performance.now() - solvedFlash.start;
            const t = elapsed / solvedFlash.duration;
            if (t < 1) {
                let alpha;
                if (t < 0.1) {
                    alpha = t / 0.1 * 0.6;
                } else if (t < 0.3) {
                    alpha = 0.6 - (t - 0.1) / 0.2 * 0.35;
                } else {
                    alpha = 0.25 * (1 - (t - 0.3) / 0.7);
                }
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

            // Outer glow
            ctx.beginPath();
            ctx.moveTo(seg.x1, seg.y1);
            ctx.lineTo(seg.x2, seg.y2);
            ctx.strokeStyle = hexToRgba(color, 0.3);
            ctx.lineWidth = 6 / viewport.zoom;
            ctx.shadowColor = color;
            ctx.shadowBlur = 12 / viewport.zoom;
            ctx.stroke();

            // Core beam
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

    function drawSource(src, isSelected) {
        const r = SOURCE_RADIUS / viewport.zoom;

        // Body
        ctx.beginPath();
        ctx.arc(src.x, src.y, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 200, 50, 0.9)';
        ctx.fill();
        ctx.strokeStyle = '#ffa500';
        ctx.lineWidth = 2 / viewport.zoom;
        ctx.stroke();

        // Direction arrow
        const arrowLen = r * 2;
        const ax = src.x + Math.cos(src.angle) * arrowLen;
        const ay = src.y + Math.sin(src.angle) * arrowLen;
        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(ax, ay);
        ctx.strokeStyle = '#ffa500';
        ctx.lineWidth = 2.5 / viewport.zoom;
        ctx.stroke();

        // Arrow tip
        const tipLen = 6 / viewport.zoom;
        const tipAngle = 0.5;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - Math.cos(src.angle - tipAngle) * tipLen, ay - Math.sin(src.angle - tipAngle) * tipLen);
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - Math.cos(src.angle + tipAngle) * tipLen, ay - Math.sin(src.angle + tipAngle) * tipLen);
        ctx.stroke();

        // Selection ring
        if (isSelected) {
            ctx.beginPath();
            ctx.arc(src.x, src.y, r + 5 / viewport.zoom, 0, Math.PI * 2);
            ctx.strokeStyle = '#00e5ff';
            ctx.lineWidth = 2 / viewport.zoom;
            ctx.stroke();

            // Rotation handle at arrow tip
            ctx.beginPath();
            ctx.arc(ax, ay, 5 / viewport.zoom, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 165, 0, 0.7)';
            ctx.fill();
            ctx.strokeStyle = '#ffa500';
            ctx.lineWidth = 1.5 / viewport.zoom;
            ctx.stroke();
        }
    }

    function drawMirror(mir, isSelected) {
        const seg = mirrorToSegment(mir);
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

        // Center dot
        ctx.beginPath();
        ctx.arc(mir.x, mir.y, 3 / viewport.zoom, 0, Math.PI * 2);
        ctx.fillStyle = mir.locked ? '#888' : '#aaccff';
        ctx.fill();

        // Color indicator ring
        if (mir.color) {
            ctx.beginPath();
            ctx.arc(mir.x, mir.y, 7 / viewport.zoom, 0, Math.PI * 2);
            ctx.strokeStyle = mir.color;
            ctx.lineWidth = 2 / viewport.zoom;
            ctx.globalAlpha = 0.8;
            ctx.stroke();
            ctx.globalAlpha = 1.0;
        }

        // Locked indicator
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

        // Selection + rotation handle
        if (isSelected) {
            // Highlight
            ctx.beginPath();
            ctx.moveTo(seg.x1, seg.y1);
            ctx.lineTo(seg.x2, seg.y2);
            ctx.strokeStyle = 'rgba(0, 229, 255, 0.3)';
            ctx.lineWidth = 8 / viewport.zoom;
            ctx.stroke();

            // Rotation handle at endpoint 2
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
        const color = fil.color || '#ff3333';

        // Soft glow behind
        ctx.beginPath();
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 10 / viewport.zoom;
        ctx.globalAlpha = 0.12;
        ctx.stroke();
        ctx.globalAlpha = 1.0;

        // Dashed line in filter color
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

        // Center diamond
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

        // Selection highlight + rotation handle
        if (isSelected) {
            ctx.beginPath();
            ctx.moveTo(seg.x1, seg.y1);
            ctx.lineTo(seg.x2, seg.y2);
            ctx.strokeStyle = 'rgba(0, 229, 255, 0.3)';
            ctx.lineWidth = 10 / viewport.zoom;
            ctx.stroke();

            // Rotation handle at endpoint 2
            ctx.beginPath();
            ctx.arc(seg.x2, seg.y2, 6 / viewport.zoom, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 165, 0, 0.7)';
            ctx.fill();
            ctx.strokeStyle = '#ffa500';
            ctx.lineWidth = 1.5 / viewport.zoom;
            ctx.stroke();
        }
    }

    function drawTarget(tgt, isHit) {
        const r = TARGET_RADIUS / viewport.zoom;

        // Outer ring
        ctx.beginPath();
        ctx.arc(tgt.x, tgt.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = isHit ? '#00ff80' : 'rgba(255, 80, 80, 0.8)';
        ctx.lineWidth = 2.5 / viewport.zoom;
        if (isHit) {
            ctx.shadowColor = '#00ff80';
            ctx.shadowBlur = 10 / viewport.zoom;
        }
        ctx.stroke();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        // Middle ring
        ctx.beginPath();
        ctx.arc(tgt.x, tgt.y, r * 0.6, 0, Math.PI * 2);
        ctx.strokeStyle = isHit ? 'rgba(0, 255, 128, 0.5)' : 'rgba(255, 80, 80, 0.4)';
        ctx.lineWidth = 1 / viewport.zoom;
        ctx.stroke();

        // Inner dot
        ctx.beginPath();
        ctx.arc(tgt.x, tgt.y, 3 / viewport.zoom, 0, Math.PI * 2);
        ctx.fillStyle = isHit ? '#00ff80' : 'rgba(255, 80, 80, 0.6)';
        ctx.fill();

        // Selection ring
        if (selectedElement === tgt) {
            ctx.beginPath();
            ctx.arc(tgt.x, tgt.y, r + 5 / viewport.zoom, 0, Math.PI * 2);
            ctx.strokeStyle = '#00e5ff';
            ctx.lineWidth = 2 / viewport.zoom;
            ctx.stroke();
        }
    }

    function drawWall(wall, isSelected) {
        ctx.beginPath();
        ctx.moveTo(wall.x1, wall.y1);
        ctx.lineTo(wall.x2, wall.y2);
        ctx.strokeStyle = isSelected ? 'rgba(150, 150, 170, 0.95)' : 'rgba(100, 100, 120, 0.9)';
        ctx.lineWidth = 5 / viewport.zoom;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Endpoint dots
        [{ x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 }].forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3 / viewport.zoom, 0, Math.PI * 2);
            ctx.fillStyle = isSelected ? 'rgba(150, 150, 170, 0.9)' : 'rgba(100, 100, 120, 0.8)';
            ctx.fill();
        });

        // Selection highlight
        if (isSelected) {
            ctx.beginPath();
            ctx.moveTo(wall.x1, wall.y1);
            ctx.lineTo(wall.x2, wall.y2);
            ctx.strokeStyle = 'rgba(0, 229, 255, 0.25)';
            ctx.lineWidth = 10 / viewport.zoom;
            ctx.stroke();
        }
    }

    // ========== MOUSE HANDLERS ==========
    function _onMouseDown(e) { if (e.button === 0) handleMouseDown(e); }
    function _onMouseMove(e) { handleMouseMove(e); }
    function _onMouseUp(e) { if (e.button === 0) handleMouseUp(e); }
    function _onWheel(e) {
        e.preventDefault();
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

    function handleMouseDown(e) {
        const { x: mx, y: my } = toWorld(e);

        // Scrambled mode: only rotate movable mirrors
        if (scrambled) {
            const hit = hitTest(mx, my);
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

        if (activeTool === 'source') {
            addSource(mx, my, 0);
            render();
            return;
        }

        if (activeTool === 'mirror') {
            addMirror(mx, my);
            render();
            return;
        }

        if (activeTool === 'target') {
            addTarget(mx, my);
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

        if (activeTool === 'filter') {
            addFilter(mx, my);
            render();
            return;
        }

        if (activeTool === 'delete') {
            const hit = hitTest(mx, my);
            if (hit && hit.type !== 'mirror-rotate' && hit.type !== 'source-rotate' && hit.type !== 'wall-endpoint' && hit.type !== 'filter-rotate') {
                deleteElement(hit.type, hit.element);
            }
            render();
            return;
        }

        // Select tool
        const hit = hitTest(mx, my);
        if (hit) {
            if (hit.type === 'mirror-rotate') {
                const angleToMouse = Math.atan2(my - hit.element.y, mx - hit.element.x);
                rotating = {
                    element: hit.element,
                    type: 'mirror',
                    startAngle: angleToMouse,
                    startElementAngle: hit.element.angle
                };
                return;
            }
            if (hit.type === 'filter-rotate') {
                const angleToMouse = Math.atan2(my - hit.element.y, mx - hit.element.x);
                rotating = {
                    element: hit.element,
                    type: 'filter',
                    startAngle: angleToMouse,
                    startElementAngle: hit.element.angle
                };
                return;
            }
            if (hit.type === 'source-rotate') {
                const angleToMouse = Math.atan2(my - hit.element.y, mx - hit.element.x);
                rotating = {
                    element: hit.element,
                    type: 'source',
                    startAngle: angleToMouse,
                    startElementAngle: hit.element.angle
                };
                return;
            }
            if (hit.type === 'wall-endpoint') {
                dragging = {
                    element: hit.element,
                    type: 'wall-endpoint',
                    endpoint: hit.endpoint,
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
                    element: hit.element,
                    type: 'wall',
                    startMouseX: mx, startMouseY: my,
                    startX1: hit.element.x1, startY1: hit.element.y1,
                    startX2: hit.element.x2, startY2: hit.element.y2
                };
            } else {
                dragging = {
                    element: hit.element,
                    type: hit.type,
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
            // Start panning
            canvas._panStart = { mx: e.clientX, my: e.clientY, ox: viewport.offsetX, oy: viewport.offsetY };
            render();
        }
    }

    function handleMouseMove(e) {
        const { x: mx, y: my } = toWorld(e);
        mouseWorld.x = mx;
        mouseWorld.y = my;

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
        if (rotating) {
            rotating = null;
            if (scrambled && checkSolved()) {
                solvedFlash = { start: performance.now(), duration: 1500 };
            }
            updateInfo();
        }
        dragging = null;
        canvas._panStart = null;
    }

    // ========== SAVE / LOAD ==========
    function saveCurrentPrismatic() {
        if (!currentPrismaticId) return;
        const p = prismatics.find(r => r.id === currentPrismaticId);
        if (!p) return;
        p.sources = sources.map(s => ({ ...s }));
        p.mirrors = mirrors.map(m => ({ ...m }));
        p.targets = targets.map(t => ({ ...t }));
        p.walls = walls.map(w => ({ ...w }));
        p.filters = filters.map(f => ({ ...f }));
    }

    function switchPrismatic(id) {
        saveCurrentPrismatic();
        const p = prismatics.find(r => r.id === id);
        if (!p) return;
        currentPrismaticId = p.id;
        sources = (p.sources || []).map(s => ({ ...s }));
        mirrors = (p.mirrors || []).map(m => ({ ...m }));
        targets = (p.targets || []).map(t => ({ ...t }));
        walls = (p.walls || []).map(w => ({ ...w }));
        filters = (p.filters || []).map(f => ({ ...f }));
        selectedElement = null;
        selectedType = null;
        scrambled = false;
        originalAngles = null;
        solvedFlash = null;
        wallFirstPoint = null;
        updateInfo();
        render();
    }

    function createPrismatic(name) {
        const id = 'prismatic_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        prismatics.push({ id, name: name || 'Untitled', sources: [], mirrors: [], targets: [], walls: [], filters: [] });
        switchPrismatic(id);
        return id;
    }

    function deletePrismatic(id) {
        prismatics = prismatics.filter(r => r.id !== id);
        if (currentPrismaticId === id) {
            if (prismatics.length > 0) {
                switchPrismatic(prismatics[0].id);
            } else {
                currentPrismaticId = null;
                sources = [];
                mirrors = [];
                targets = [];
                walls = [];
                filters = [];
                render();
            }
        }
        updateInfo();
    }

    function getPrismaticData() {
        saveCurrentPrismatic();
        return {
            prismatics: prismatics.map(p => ({
                ...p,
                sources: (p.sources || []).map(s => ({ ...s })),
                mirrors: (p.mirrors || []).map(m => ({ ...m })),
                targets: (p.targets || []).map(t => ({ ...t })),
                walls: (p.walls || []).map(w => ({ ...w })),
                filters: (p.filters || []).map(f => ({ ...f }))
            }))
        };
    }

    function loadPrismaticData(data) {
        if (!data) return;
        prismatics = (data.prismatics || []).map(p => ({
            ...p,
            sources: (p.sources || []).map(s => ({ ...s })),
            mirrors: (p.mirrors || []).map(m => ({ ...m })),
            targets: (p.targets || []).map(t => ({ ...t })),
            walls: (p.walls || []).map(w => ({ ...w })),
            filters: (p.filters || []).map(f => ({ ...f }))
        }));
        if (prismatics.length > 0 && active) {
            switchPrismatic(prismatics[0].id);
        }
    }

    function getAllPrismatics() { return prismatics; }
    function getCurrentPrismaticId() { return currentPrismaticId; }

    function refreshSidebarList() {
        if (typeof Toolbar !== 'undefined' && Toolbar.refreshPrismaticList) {
            Toolbar.refreshPrismaticList();
        }
    }

    return {
        activate, deactivate, isActive,
        getPrismaticData, loadPrismaticData,
        getAllPrismatics, getCurrentPrismaticId,
        switchPrismatic, createPrismatic, deletePrismatic,
        refreshSidebarList
    };
})();
