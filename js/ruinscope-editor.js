const RuinscopeEditor = (() => {
    // ========== STATE ==========
    let active = false;
    let canvas = null, ctx = null;
    let viewport = { offsetX: 0, offsetY: 0, zoom: 1.0 };
    let activeTool = 'select'; // 'select' | 'node' | 'connect' | 'delete'
    let ruinscopes = [];           // [{ id, name, nodes, edges }]
    let currentRuinscopeId = null;
    let nodes = [];                // [{ id, x, y, label }]
    let edges = [];                // [{ from: nodeId, to: nodeId }]
    let selectedNode = null;
    let draggingNode = null;       // { node, startMouseX, startMouseY, startX, startY }
    let connectingFrom = null;     // nodeId — first node of a connection draw
    let mouseWorld = { x: 0, y: 0 }; // current mouse in world coords
    let originalPositions = null;  // [{ id, x, y }] saved before scramble
    let scrambled = false;
    let swapFirst = null;          // nodeId — first node selected for swap in scrambled mode
    let animatingSwap = null;      // { nodeA, nodeB, startA, startB, endA, endB, start, duration }
    let pulsePhase = 0;
    let animFrameId = null;
    let solvedFlash = null; // { start, duration } — white flash when puzzle is solved
    let solveMode = 'untangle';  // 'untangle' | 'exact' | 'starchart'
    let swapRule = 'free';       // 'free' | 'adjacent'
    let invalidSwapFlash = null; // { nodeId, start, duration } — red flash on rejected swap
    let targetPositionalEdges = null; // starchart mode: Set of "posIdx-posIdx" strings (target pattern)

    const NODE_RADIUS = 14;
    const GRID_SIZE = 40;
    const GRID_BG = '#1a1a2e';
    const GRID_COLOR = 'rgba(255,255,255,0.04)';

    // ========== KEY HANDLER ==========
    function _onKeyDown(e) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (selectedNode) {
                deleteNode(selectedNode);
                selectedNode = null;
                render();
            }
        }
        if (e.key === 'Escape') {
            connectingFrom = null;
            swapFirst = null;
            selectedNode = null;
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
        // Mutual exclusion
        if (typeof IdeogramEditor !== 'undefined' && IdeogramEditor.isActive()) IdeogramEditor.deactivate();
        if (typeof BlueprintEditor !== 'undefined' && BlueprintEditor.isActive()) BlueprintEditor.deactivate();

        active = true;
        const gameCanvas = document.getElementById('game-canvas');
        const bpCanvas = document.getElementById('blueprint-canvas');
        if (gameCanvas) gameCanvas.classList.add('hidden');
        if (bpCanvas) bpCanvas.classList.remove('hidden');

        initCanvas();
        showToolset();
        document.addEventListener('keydown', _onKeyDown);

        if (ruinscopes.length === 0) {
            createRuinscope('Untitled');
        }
        if (!currentRuinscopeId && ruinscopes.length > 0) {
            switchRuinscope(ruinscopes[0].id);
        }
        render();
    }

    function deactivate() {
        if (!active) return;
        active = false;
        saveCurrentRuinscope();

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

        selectedNode = null;
        draggingNode = null;
        connectingFrom = null;
        swapFirst = null;
        activeTool = 'select';

        if (typeof Canvas !== 'undefined') Canvas.resize();
    }

    function isActive() { return active; }

    // ========== TOOLSET UI ==========
    function showToolset() {
        const panel = document.getElementById('ruinscope-tools-panel');
        if (panel) panel.classList.remove('hidden');
        const body = document.getElementById('ruinscope-tools-body');
        if (!body) return;

        body.innerHTML = `
            <div class="blueprint-tool-grid">
                <button class="blueprint-tool active" data-tool="select" title="Select">
                    <span class="tool-icon">✦</span>
                    <span class="tool-label">Select</span>
                </button>
                <button class="blueprint-tool" data-tool="node" title="Add Node">
                    <span class="tool-icon">⬤</span>
                    <span class="tool-label">Node</span>
                </button>
                <button class="blueprint-tool" data-tool="connect" title="Connect">
                    <span class="tool-icon">⟋</span>
                    <span class="tool-label">Connect</span>
                </button>
                <button class="blueprint-tool" data-tool="delete" title="Delete">
                    <span class="tool-icon">✕</span>
                    <span class="tool-label">Delete</span>
                </button>
            </div>
            <div style="margin-top:10px; display:flex; gap:6px; flex-wrap:wrap;">
                <button class="panel-btn ruinscope-scramble-btn" id="ruinscope-scramble">Scramble</button>
                <button class="panel-btn ruinscope-reset-btn" id="ruinscope-reset">Reset</button>
            </div>
            <div style="margin-top:8px; font-size:11px; color:var(--text-secondary);">
                <span id="ruinscope-info">Nodes: 0 | Edges: 0</span>
            </div>
            <div style="margin-top:6px; font-size:10px; color:var(--text-secondary);" id="ruinscope-status"></div>
            <div style="margin-top:10px; border-top:1px solid rgba(255,255,255,0.1); padding-top:8px;">
                <div style="font-size:10px; color:var(--text-secondary); margin-bottom:4px;">Solve Mode</div>
                <div style="display:flex; gap:4px; flex-wrap:wrap;">
                    <button class="panel-btn ruinscope-rule-btn ${solveMode === 'untangle' ? 'active' : ''}" data-solve="untangle">Untangle</button>
                    <button class="panel-btn ruinscope-rule-btn ${solveMode === 'exact' ? 'active' : ''}" data-solve="exact">Exact</button>
                    <button class="panel-btn ruinscope-rule-btn ${solveMode === 'starchart' ? 'active' : ''}" data-solve="starchart">Starchart</button>
                </div>
                <div style="font-size:10px; color:var(--text-secondary); margin-top:6px; margin-bottom:4px;">Swap Rule</div>
                <div style="display:flex; gap:4px;">
                    <button class="panel-btn ruinscope-rule-btn ${swapRule === 'free' ? 'active' : ''}" data-swap="free">Free</button>
                    <button class="panel-btn ruinscope-rule-btn ${swapRule === 'adjacent' ? 'active' : ''}" data-swap="adjacent">Adjacent</button>
                </div>
            </div>
        `;

        // Tool buttons
        body.querySelectorAll('.blueprint-tool').forEach(btn => {
            btn.addEventListener('click', () => selectTool(btn.dataset.tool));
        });

        // Scramble / Reset
        document.getElementById('ruinscope-scramble').addEventListener('click', scrambleNodes);
        document.getElementById('ruinscope-reset').addEventListener('click', resetNodes);

        // Rule toggles
        body.querySelectorAll('[data-solve]').forEach(btn => {
            btn.addEventListener('click', () => {
                solveMode = btn.dataset.solve;
                body.querySelectorAll('[data-solve]').forEach(b => b.classList.toggle('active', b.dataset.solve === solveMode));
                updateInfo();
            });
        });
        body.querySelectorAll('[data-swap]').forEach(btn => {
            btn.addEventListener('click', () => {
                swapRule = btn.dataset.swap;
                body.querySelectorAll('[data-swap]').forEach(b => b.classList.toggle('active', b.dataset.swap === swapRule));
            });
        });

        // Close button
        const closeBtn = document.getElementById('ruinscope-tools-close');
        if (closeBtn) closeBtn.addEventListener('click', () => {
            const panel = document.getElementById('ruinscope-tools-panel');
            if (panel) panel.classList.add('hidden');
        });

        updateInfo();
    }

    function hideToolset() {
        const panel = document.getElementById('ruinscope-tools-panel');
        if (panel) panel.classList.add('hidden');
    }

    function selectTool(tool) {
        if (activeTool === tool && tool !== 'select') {
            activeTool = 'select';
        } else {
            activeTool = tool;
        }
        connectingFrom = null;
        swapFirst = null;
        const body = document.getElementById('ruinscope-tools-body');
        if (body) {
            body.querySelectorAll('.blueprint-tool').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tool === activeTool);
            });
        }
        render();
    }

    function updateInfo() {
        const el = document.getElementById('ruinscope-info');
        if (el) el.textContent = `Nodes: ${nodes.length} | Edges: ${edges.length}`;
        const status = document.getElementById('ruinscope-status');
        if (status) {
            if (scrambled) {
                if (solveMode === 'starchart') {
                    const { matched, total } = countMatchingPositionalEdges();
                    if (matched === total && total > 0) {
                        status.textContent = 'SOLVED!';
                        status.style.color = '#00e5ff';
                    } else {
                        status.textContent = `Pattern: ${matched}/${total} edges`;
                        status.style.color = matched > 0 ? 'var(--text-secondary)' : 'var(--accent-rust)';
                    }
                } else if (solveMode === 'exact') {
                    const crossings = countCrossings();
                    const home = originalPositions ? originalPositions.filter(orig => isNodeHome(orig.id)).length : 0;
                    const total = originalPositions ? originalPositions.length : 0;
                    if (home === total && total > 0) {
                        status.textContent = 'SOLVED!';
                        status.style.color = '#00e5ff';
                    } else {
                        status.textContent = `Nodes home: ${home}/${total}` + (crossings > 0 ? ` | Crossings: ${crossings}` : ' | Lines clear');
                        status.style.color = crossings > 0 ? 'var(--accent-rust)' : 'var(--text-secondary)';
                    }
                } else {
                    const crossings = countCrossings();
                    if (crossings === 0) {
                        status.textContent = 'SOLVED!';
                        status.style.color = '#00e5ff';
                    } else {
                        status.textContent = `Crossings: ${crossings}`;
                        status.style.color = 'var(--accent-rust)';
                    }
                }
            } else {
                status.textContent = '';
            }
        }
    }

    // ========== NODE / EDGE OPERATIONS ==========
    function addNode(x, y) {
        const id = 'node_' + Date.now() + '_' + Math.random().toString(36).slice(2, 4);
        const node = { id, x, y, label: '' };
        nodes.push(node);
        updateInfo();
        return node;
    }

    function deleteNode(nodeId) {
        nodes = nodes.filter(n => n.id !== nodeId);
        edges = edges.filter(e => e.from !== nodeId && e.to !== nodeId);
        if (selectedNode === nodeId) selectedNode = null;
        updateInfo();
    }

    function addEdge(fromId, toId) {
        if (fromId === toId) return;
        // Don't add duplicate
        if (edges.some(e => (e.from === fromId && e.to === toId) || (e.from === toId && e.to === fromId))) return;
        edges.push({ from: fromId, to: toId });
        updateInfo();
    }

    function deleteEdge(fromId, toId) {
        edges = edges.filter(e => !((e.from === fromId && e.to === toId) || (e.from === toId && e.to === fromId)));
        updateInfo();
    }

    function getNode(id) {
        return nodes.find(n => n.id === id);
    }

    function hitTestNode(mx, my) {
        const r = NODE_RADIUS / viewport.zoom;
        for (let i = nodes.length - 1; i >= 0; i--) {
            const n = nodes[i];
            const dx = mx - n.x, dy = my - n.y;
            if (dx * dx + dy * dy <= (r + 4) * (r + 4)) return n;
        }
        return null;
    }

    function hitTestEdge(mx, my) {
        const threshold = 6 / viewport.zoom;
        for (const e of edges) {
            const a = getNode(e.from), b = getNode(e.to);
            if (!a || !b) continue;
            const dist = pointToSegmentDist(mx, my, a.x, a.y, b.x, b.y);
            if (dist < threshold) return e;
        }
        return null;
    }

    function pointToSegmentDist(px, py, ax, ay, bx, by) {
        const dx = bx - ax, dy = by - ay;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return Math.hypot(px - ax, py - ay);
        let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    }

    // ========== LINE INTERSECTION ==========
    function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
        const dABx = bx - ax, dABy = by - ay;
        const dCDx = dx - cx, dCDy = dy - cy;
        const denom = dABx * dCDy - dABy * dCDx;
        if (Math.abs(denom) < 1e-10) return false;
        const t = ((cx - ax) * dCDy - (cy - ay) * dCDx) / denom;
        const u = ((cx - ax) * dABy - (cy - ay) * dABx) / denom;
        return t > 0.001 && t < 0.999 && u > 0.001 && u < 0.999;
    }

    function edgeCrossesAny(edge) {
        const a = getNode(edge.from), b = getNode(edge.to);
        if (!a || !b) return false;
        for (const other of edges) {
            if (other === edge) continue;
            // Skip edges sharing an endpoint
            if (other.from === edge.from || other.from === edge.to ||
                other.to === edge.from || other.to === edge.to) continue;
            const c = getNode(other.from), d = getNode(other.to);
            if (!c || !d) continue;
            if (segmentsIntersect(a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y)) return true;
        }
        return false;
    }

    function countCrossings() {
        let count = 0;
        for (let i = 0; i < edges.length; i++) {
            const a = getNode(edges[i].from), b = getNode(edges[i].to);
            if (!a || !b) continue;
            for (let j = i + 1; j < edges.length; j++) {
                if (edges[j].from === edges[i].from || edges[j].from === edges[i].to ||
                    edges[j].to === edges[i].from || edges[j].to === edges[i].to) continue;
                const c = getNode(edges[j].from), d = getNode(edges[j].to);
                if (!c || !d) continue;
                if (segmentsIntersect(a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y)) count++;
            }
        }
        return count;
    }

    // ========== SOLVE / SWAP RULES ==========
    function checkSolved() {
        if (!scrambled || !originalPositions) return false;
        if (solveMode === 'starchart') {
            return checkStarchartSolved();
        }
        if (solveMode === 'exact') {
            for (const orig of originalPositions) {
                const n = getNode(orig.id);
                if (!n) return false;
                if (Math.abs(n.x - orig.x) > 2 || Math.abs(n.y - orig.y) > 2) return false;
            }
            return true;
        }
        return countCrossings() === 0;
    }

    function isNodeHome(nodeId) {
        if (!originalPositions) return false;
        const orig = originalPositions.find(o => o.id === nodeId);
        const n = getNode(nodeId);
        if (!orig || !n) return false;
        return Math.abs(n.x - orig.x) <= 2 && Math.abs(n.y - orig.y) <= 2;
    }

    function canSwap(nodeA, nodeB) {
        if (swapRule === 'free') return true;
        return edges.some(e =>
            (e.from === nodeA.id && e.to === nodeB.id) ||
            (e.from === nodeB.id && e.to === nodeA.id)
        );
    }

    function isAdjacentTo(nodeId, targetId) {
        return edges.some(e =>
            (e.from === nodeId && e.to === targetId) ||
            (e.from === targetId && e.to === nodeId)
        );
    }

    // ========== STARCHART HELPERS ==========
    // Build a set of "posIdx-posIdx" strings representing edges mapped to positions
    function buildPositionalEdges(positionsRef) {
        const posMap = {}; // nodeId → position index
        for (let i = 0; i < positionsRef.length; i++) {
            posMap[positionsRef[i].id] = i;
        }
        // Map each edge's endpoints to the position index each node currently occupies
        const edgeSet = new Set();
        for (const e of edges) {
            const nodeA = getNode(e.from), nodeB = getNode(e.to);
            if (!nodeA || !nodeB) continue;
            // Find which position each node is currently at
            let posA = -1, posB = -1;
            for (let i = 0; i < positionsRef.length; i++) {
                const p = positionsRef[i];
                if (Math.abs(nodeA.x - p.x) <= 2 && Math.abs(nodeA.y - p.y) <= 2) posA = i;
                if (Math.abs(nodeB.x - p.x) <= 2 && Math.abs(nodeB.y - p.y) <= 2) posB = i;
            }
            if (posA >= 0 && posB >= 0) {
                const key = posA < posB ? `${posA}-${posB}` : `${posB}-${posA}`;
                edgeSet.add(key);
            }
        }
        return edgeSet;
    }

    // Build target edges using node IDs directly (before scramble, nodes are at their home positions)
    function buildTargetPositionalEdges(positionsRef) {
        const posMap = {};
        for (let i = 0; i < positionsRef.length; i++) {
            posMap[positionsRef[i].id] = i;
        }
        const edgeSet = new Set();
        for (const e of edges) {
            const a = posMap[e.from], b = posMap[e.to];
            if (a !== undefined && b !== undefined) {
                const key = a < b ? `${a}-${b}` : `${b}-${a}`;
                edgeSet.add(key);
            }
        }
        return edgeSet;
    }

    function checkStarchartSolved() {
        if (!scrambled || !originalPositions || !targetPositionalEdges) return false;
        const current = buildPositionalEdges(originalPositions);
        if (current.size !== targetPositionalEdges.size) return false;
        for (const key of targetPositionalEdges) {
            if (!current.has(key)) return false;
        }
        return true;
    }

    function countMatchingPositionalEdges() {
        if (!originalPositions || !targetPositionalEdges) return { matched: 0, total: 0 };
        const current = buildPositionalEdges(originalPositions);
        let matched = 0;
        for (const key of targetPositionalEdges) {
            if (current.has(key)) matched++;
        }
        return { matched, total: targetPositionalEdges.size };
    }

    // Check if a specific edge currently matches a target positional edge
    function isEdgePositionallyCorrect(edge) {
        if (!originalPositions || !targetPositionalEdges) return false;
        const nodeA = getNode(edge.from), nodeB = getNode(edge.to);
        if (!nodeA || !nodeB) return false;
        let posA = -1, posB = -1;
        for (let i = 0; i < originalPositions.length; i++) {
            const p = originalPositions[i];
            if (Math.abs(nodeA.x - p.x) <= 2 && Math.abs(nodeA.y - p.y) <= 2) posA = i;
            if (Math.abs(nodeB.x - p.x) <= 2 && Math.abs(nodeB.y - p.y) <= 2) posB = i;
        }
        if (posA < 0 || posB < 0) return false;
        const key = posA < posB ? `${posA}-${posB}` : `${posB}-${posA}`;
        return targetPositionalEdges.has(key);
    }

    // ========== SCRAMBLE / RESET ==========
    function scrambleNodes() {
        if (nodes.length < 3) return;
        // Save original positions
        originalPositions = nodes.map(n => ({ id: n.id, x: n.x, y: n.y }));
        scrambled = true;

        // Starchart mode: shuffle nodes between fixed positions, check pattern mismatch
        if (solveMode === 'starchart') {
            targetPositionalEdges = buildTargetPositionalEdges(originalPositions);
            const positions = originalPositions.map(p => ({ x: p.x, y: p.y }));
            let scrambleOk = false;
            let attempts = 0;
            while (attempts < 30) {
                // Fisher-Yates shuffle
                for (let i = positions.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [positions[i], positions[j]] = [positions[j], positions[i]];
                }
                for (let i = 0; i < nodes.length; i++) {
                    nodes[i].x = positions[i].x;
                    nodes[i].y = positions[i].y;
                }
                // Check that the positional edge pattern differs from target
                const current = buildPositionalEdges(originalPositions);
                if (current.size !== targetPositionalEdges.size) { scrambleOk = true; break; }
                let matches = true;
                for (const key of targetPositionalEdges) {
                    if (!current.has(key)) { matches = false; break; }
                }
                if (!matches) { scrambleOk = true; break; }
                attempts++;
            }
            // Fallback: rotate by 1 if shuffle kept producing the same pattern
            if (!scrambleOk) {
                const rotated = originalPositions.map((_, i) => originalPositions[(i + 1) % originalPositions.length]);
                for (let i = 0; i < nodes.length; i++) {
                    nodes[i].x = rotated[i].x;
                    nodes[i].y = rotated[i].y;
                }
            }

            swapFirst = null;
            solvedFlash = null;
            invalidSwapFlash = null;
            startAnimLoop();
            updateInfo();
            render();
            return;
        }

        // Compute bounding box with padding
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const n of nodes) {
            if (n.x < minX) minX = n.x;
            if (n.y < minY) minY = n.y;
            if (n.x > maxX) maxX = n.x;
            if (n.y > maxY) maxY = n.y;
        }
        const pad = Math.max(80, (maxX - minX) * 0.3, (maxY - minY) * 0.3);
        const bx0 = minX - pad, by0 = minY - pad;
        const bw = (maxX - minX) + pad * 2, bh = (maxY - minY) + pad * 2;

        // Count how many independent edge pairs exist (don't share endpoints)
        let independentPairs = 0;
        for (let i = 0; i < edges.length; i++) {
            for (let j = i + 1; j < edges.length; j++) {
                if (edges[j].from !== edges[i].from && edges[j].from !== edges[i].to &&
                    edges[j].to !== edges[i].from && edges[j].to !== edges[i].to) {
                    independentPairs++;
                }
            }
        }

        let foundCrossings = false;

        if (solveMode === 'exact' || independentPairs > 0) {
            // Try Fisher-Yates shuffle of positions first (needed for exact mode)
            const positions = nodes.map(n => ({ x: n.x, y: n.y }));
            let attempts = 0;
            while (attempts < 20) {
                for (let i = positions.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [positions[i], positions[j]] = [positions[j], positions[i]];
                }
                for (let i = 0; i < nodes.length; i++) {
                    nodes[i].x = positions[i].x;
                    nodes[i].y = positions[i].y;
                }
                if (countCrossings() > 0) { foundCrossings = true; break; }
                attempts++;
            }
        }

        // If shuffle couldn't produce crossings and we're in untangle mode,
        // use random positions within the bounding box
        if (!foundCrossings && solveMode === 'untangle') {
            let attempts = 0;
            while (attempts < 30) {
                for (const n of nodes) {
                    n.x = bx0 + Math.random() * bw;
                    n.y = by0 + Math.random() * bh;
                }
                if (countCrossings() > 0) { foundCrossings = true; break; }
                attempts++;
            }
        }

        // If exact mode shuffle couldn't produce crossings, just ensure positions differ
        if (!foundCrossings && solveMode === 'exact') {
            const positions = nodes.map(n => ({ x: n.x, y: n.y }));
            // Rotate positions by 1 and add jitter
            for (let i = 0; i < nodes.length; i++) {
                const src = positions[(i + 1) % positions.length];
                nodes[i].x = src.x + (Math.random() - 0.5) * 40;
                nodes[i].y = src.y + (Math.random() - 0.5) * 40;
            }
        }

        swapFirst = null;
        solvedFlash = null;
        invalidSwapFlash = null;
        startAnimLoop();
        updateInfo();

        // Warn if no crossings could be generated
        if (!foundCrossings && solveMode === 'untangle') {
            const status = document.getElementById('ruinscope-status');
            if (status) {
                status.textContent = 'No crossings possible — try Exact mode';
                status.style.color = 'var(--accent-orange)';
            }
        }

        render();
    }

    function resetNodes() {
        if (!originalPositions) return;
        for (const orig of originalPositions) {
            const n = getNode(orig.id);
            if (n) { n.x = orig.x; n.y = orig.y; }
        }
        originalPositions = null;
        targetPositionalEdges = null;
        scrambled = false;
        swapFirst = null;
        solvedFlash = null;
        invalidSwapFlash = null;
        stopAnimLoop();
        updateInfo();
        render();
    }

    // ========== SWAP ANIMATION ==========
    function swapNodes(nodeA, nodeB) {
        const tmpX = nodeA.x, tmpY = nodeA.y;
        animatingSwap = {
            nodeA, nodeB,
            startA: { x: nodeA.x, y: nodeA.y },
            startB: { x: nodeB.x, y: nodeB.y },
            endA: { x: nodeB.x, y: nodeB.y },
            endB: { x: tmpX, y: tmpY },
            start: performance.now(),
            duration: 200
        };
    }

    function updateSwapAnimation() {
        if (!animatingSwap) return false;
        const t = Math.min(1, (performance.now() - animatingSwap.start) / animatingSwap.duration);
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        const { nodeA, nodeB, startA, startB, endA, endB } = animatingSwap;
        nodeA.x = startA.x + (endA.x - startA.x) * ease;
        nodeA.y = startA.y + (endA.y - startA.y) * ease;
        nodeB.x = startB.x + (endB.x - startB.x) * ease;
        nodeB.y = startB.y + (endB.y - startB.y) * ease;
        if (t >= 1) {
            nodeA.x = endA.x; nodeA.y = endA.y;
            nodeB.x = endB.x; nodeB.y = endB.y;
            animatingSwap = null;
            updateInfo();
            // Check if solved
            if (checkSolved()) {
                solvedFlash = { start: performance.now(), duration: 1500 };
            }
        }
        return true;
    }

    // ========== ANIMATION LOOP ==========
    function animLoop() {
        pulsePhase = (Date.now() % 2000) / 2000 * Math.PI * 2;
        updateSwapAnimation();
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
        ctx.fillStyle = GRID_BG;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.translate(viewport.offsetX, viewport.offsetY);
        ctx.scale(viewport.zoom, viewport.zoom);

        // Grid
        drawGrid();

        // Starchart mode: draw position anchor markers (dim stars at fixed slots)
        if (scrambled && solveMode === 'starchart' && originalPositions) {
            for (const pos of originalPositions) {
                const r = 4 / viewport.zoom;
                // Small cross marker
                ctx.beginPath();
                ctx.moveTo(pos.x - r, pos.y);
                ctx.lineTo(pos.x + r, pos.y);
                ctx.moveTo(pos.x, pos.y - r);
                ctx.lineTo(pos.x, pos.y + r);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
                ctx.lineWidth = 1.5 / viewport.zoom;
                ctx.stroke();
                // Dim dot
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 2.5 / viewport.zoom, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
                ctx.fill();
            }
        }

        // Edges
        for (const edge of edges) {
            const a = getNode(edge.from), b = getNode(edge.to);
            if (!a || !b) continue;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);

            if (scrambled) {
                if (solveMode === 'starchart') {
                    // Starchart: glow if edge is in correct positional slot
                    const correct = isEdgePositionallyCorrect(edge);
                    if (correct) {
                        const pulse = 0.6 + 0.4 * Math.sin(pulsePhase);
                        ctx.strokeStyle = `rgba(0, 229, 255, ${pulse})`;
                        ctx.lineWidth = 3 / viewport.zoom;
                        ctx.shadowColor = '#00e5ff';
                        ctx.shadowBlur = 8 / viewport.zoom;
                    } else {
                        ctx.strokeStyle = 'rgba(180, 180, 220, 0.3)';
                        ctx.lineWidth = 2 / viewport.zoom;
                    }
                } else {
                    const crosses = edgeCrossesAny(edge);
                    if (crosses) {
                        ctx.strokeStyle = 'rgba(255, 80, 80, 0.8)';
                        ctx.lineWidth = 2.5 / viewport.zoom;
                    } else {
                        const pulse = 0.6 + 0.4 * Math.sin(pulsePhase);
                        ctx.strokeStyle = `rgba(0, 229, 255, ${pulse})`;
                        ctx.lineWidth = 3 / viewport.zoom;
                        ctx.shadowColor = '#00e5ff';
                        ctx.shadowBlur = 8 / viewport.zoom;
                    }
                }
            } else {
                ctx.strokeStyle = 'rgba(180, 180, 220, 0.6)';
                ctx.lineWidth = 2 / viewport.zoom;
            }
            ctx.stroke();
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
        }

        // Connection preview
        if (connectingFrom && activeTool === 'connect') {
            const fromNode = getNode(connectingFrom);
            if (fromNode) {
                ctx.beginPath();
                ctx.moveTo(fromNode.x, fromNode.y);
                ctx.lineTo(mouseWorld.x, mouseWorld.y);
                ctx.strokeStyle = 'rgba(255, 152, 0, 0.5)';
                ctx.lineWidth = 2 / viewport.zoom;
                ctx.setLineDash([6 / viewport.zoom, 4 / viewport.zoom]);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }

        // Nodes
        for (const node of nodes) {
            const r = NODE_RADIUS / viewport.zoom;

            // Adjacent-only: dim non-adjacent nodes when swapFirst is set
            let dimmed = false;
            if (scrambled && swapFirst && swapRule === 'adjacent' && node.id !== swapFirst) {
                if (!isAdjacentTo(swapFirst, node.id)) {
                    dimmed = true;
                }
            }

            // Adjacent target highlight ring
            if (scrambled && swapFirst && swapRule === 'adjacent' && node.id !== swapFirst && !dimmed) {
                ctx.beginPath();
                ctx.arc(node.x, node.y, r + 6 / viewport.zoom, 0, Math.PI * 2);
                const pulse = 0.4 + 0.3 * Math.sin(pulsePhase);
                ctx.strokeStyle = `rgba(255, 152, 0, ${pulse})`;
                ctx.lineWidth = 2 / viewport.zoom;
                ctx.setLineDash([4 / viewport.zoom, 3 / viewport.zoom]);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // Swap-first highlight
            if (scrambled && swapFirst === node.id) {
                ctx.beginPath();
                ctx.arc(node.x, node.y, r + 6 / viewport.zoom, 0, Math.PI * 2);
                ctx.strokeStyle = '#ff9800';
                ctx.lineWidth = 3 / viewport.zoom;
                ctx.stroke();
            }

            // Exact mode: home glow
            if (scrambled && solveMode === 'exact' && isNodeHome(node.id)) {
                const pulse = 0.5 + 0.5 * Math.sin(pulsePhase);
                ctx.beginPath();
                ctx.arc(node.x, node.y, r + 5 / viewport.zoom, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(0, 255, 128, ${pulse})`;
                ctx.lineWidth = 2.5 / viewport.zoom;
                ctx.shadowColor = '#00ff80';
                ctx.shadowBlur = 6 / viewport.zoom;
                ctx.stroke();
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
            }

            // Invalid swap flash
            if (invalidSwapFlash && invalidSwapFlash.nodeId === node.id) {
                const elapsed = performance.now() - invalidSwapFlash.start;
                const ft = elapsed / invalidSwapFlash.duration;
                if (ft < 1) {
                    const alpha = 0.8 * (1 - ft);
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, r + 8 / viewport.zoom, 0, Math.PI * 2);
                    ctx.strokeStyle = `rgba(255, 60, 60, ${alpha})`;
                    ctx.lineWidth = 3 / viewport.zoom;
                    ctx.stroke();
                } else {
                    invalidSwapFlash = null;
                }
            }

            // Selected highlight
            if (selectedNode === node.id && !scrambled) {
                ctx.beginPath();
                ctx.arc(node.x, node.y, r + 4 / viewport.zoom, 0, Math.PI * 2);
                ctx.strokeStyle = '#00e5ff';
                ctx.lineWidth = 2 / viewport.zoom;
                ctx.stroke();
            }

            // ConnectingFrom highlight
            if (connectingFrom === node.id) {
                ctx.beginPath();
                ctx.arc(node.x, node.y, r + 4 / viewport.zoom, 0, Math.PI * 2);
                ctx.strokeStyle = '#ff9800';
                ctx.lineWidth = 2 / viewport.zoom;
                ctx.setLineDash([4 / viewport.zoom, 3 / viewport.zoom]);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // Node body
            ctx.beginPath();
            ctx.arc(node.x, node.y, r, 0, Math.PI * 2);

            if (scrambled) {
                if (solveMode === 'starchart') {
                    // Starchart: glow if all of this node's edges are positionally correct
                    const nodeEdges = edges.filter(e => e.from === node.id || e.to === node.id);
                    const allCorrect = nodeEdges.length > 0 && nodeEdges.every(e => isEdgePositionallyCorrect(e));
                    if (allCorrect) {
                        const pulse = 0.7 + 0.3 * Math.sin(pulsePhase);
                        ctx.fillStyle = `rgba(0, 229, 255, ${pulse})`;
                    } else {
                        ctx.fillStyle = dimmed ? 'rgba(120, 120, 150, 0.5)' : 'rgba(200, 200, 240, 0.9)';
                    }
                } else if (solveMode === 'exact' && isNodeHome(node.id)) {
                    const pulse = 0.7 + 0.3 * Math.sin(pulsePhase);
                    ctx.fillStyle = `rgba(0, 255, 128, ${pulse})`;
                } else {
                    const nodeEdges = edges.filter(e => e.from === node.id || e.to === node.id);
                    const allClean = nodeEdges.length > 0 && nodeEdges.every(e => !edgeCrossesAny(e));
                    if (allClean) {
                        const pulse = 0.7 + 0.3 * Math.sin(pulsePhase);
                        ctx.fillStyle = `rgba(0, 229, 255, ${pulse})`;
                    } else {
                        ctx.fillStyle = dimmed ? 'rgba(120, 120, 150, 0.5)' : 'rgba(200, 200, 240, 0.9)';
                    }
                }
            } else {
                ctx.fillStyle = 'rgba(200, 200, 240, 0.9)';
            }
            ctx.fill();
            ctx.strokeStyle = dimmed ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 1.5 / viewport.zoom;
            ctx.stroke();

            // Label
            if (node.label) {
                ctx.fillStyle = '#fff';
                ctx.font = `${11 / viewport.zoom}px monospace`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(node.label, node.x, node.y);
            }
        }

        ctx.restore();

        // Solved flash overlay
        if (solvedFlash) {
            const elapsed = performance.now() - solvedFlash.start;
            const t = elapsed / solvedFlash.duration;
            if (t < 1) {
                // Quick white flash that fades to cyan glow then out
                let alpha;
                if (t < 0.1) {
                    alpha = t / 0.1 * 0.6; // ramp up
                } else if (t < 0.3) {
                    alpha = 0.6 - (t - 0.1) / 0.2 * 0.35; // fade to glow
                } else {
                    alpha = 0.25 * (1 - (t - 0.3) / 0.7); // fade out
                }
                ctx.fillStyle = t < 0.15
                    ? `rgba(255, 255, 255, ${alpha})`
                    : `rgba(0, 229, 255, ${alpha})`;
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // "SOLVED" text
                const textAlpha = t < 0.15 ? 1 : Math.max(0, 1 - (t - 0.15) / 0.85);
                ctx.save();
                ctx.fillStyle = `rgba(255, 255, 255, ${textAlpha})`;
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

        // Scrambled mode: swap nodes
        if (scrambled && !animatingSwap) {
            const hit = hitTestNode(mx, my);
            if (hit) {
                if (!swapFirst) {
                    swapFirst = hit.id;
                    render();
                } else if (swapFirst !== hit.id) {
                    const nodeA = getNode(swapFirst);
                    const nodeB = hit;
                    if (canSwap(nodeA, nodeB)) {
                        swapFirst = null;
                        swapNodes(nodeA, nodeB);
                    } else {
                        invalidSwapFlash = { nodeId: hit.id, start: performance.now(), duration: 400 };
                        swapFirst = null;
                        render();
                    }
                } else {
                    swapFirst = null;
                    render();
                }
            }
            return;
        }

        if (activeTool === 'node') {
            addNode(mx, my);
            render();
            return;
        }

        if (activeTool === 'connect') {
            const hit = hitTestNode(mx, my);
            if (hit) {
                if (!connectingFrom) {
                    connectingFrom = hit.id;
                } else {
                    addEdge(connectingFrom, hit.id);
                    connectingFrom = null;
                }
                render();
            }
            return;
        }

        if (activeTool === 'delete') {
            const hitN = hitTestNode(mx, my);
            if (hitN) {
                deleteNode(hitN.id);
                render();
                return;
            }
            const hitE = hitTestEdge(mx, my);
            if (hitE) {
                deleteEdge(hitE.from, hitE.to);
                render();
            }
            return;
        }

        // Select tool
        const hit = hitTestNode(mx, my);
        if (hit) {
            selectedNode = hit.id;
            draggingNode = {
                node: hit,
                startMouseX: mx, startMouseY: my,
                startX: hit.x, startY: hit.y
            };
            render();
        } else {
            selectedNode = null;
            // Start panning
            draggingNode = null;
            canvas._panStart = { mx: e.clientX, my: e.clientY, ox: viewport.offsetX, oy: viewport.offsetY };
            render();
        }
    }

    function handleMouseMove(e) {
        const { x: mx, y: my } = toWorld(e);
        mouseWorld.x = mx;
        mouseWorld.y = my;

        if (draggingNode) {
            const dx = mx - draggingNode.startMouseX;
            const dy = my - draggingNode.startMouseY;
            draggingNode.node.x = draggingNode.startX + dx;
            draggingNode.node.y = draggingNode.startY + dy;
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

        // Connection preview
        if (connectingFrom) {
            render();
        }
    }

    function handleMouseUp(e) {
        draggingNode = null;
        canvas._panStart = null;
    }

    // ========== SAVE / LOAD ==========
    function saveCurrentRuinscope() {
        if (!currentRuinscopeId) return;
        const rs = ruinscopes.find(r => r.id === currentRuinscopeId);
        if (!rs) return;
        rs.nodes = nodes.map(n => ({ ...n }));
        rs.edges = edges.map(e => ({ ...e }));
        rs.solveMode = solveMode;
        rs.swapRule = swapRule;
    }

    function switchRuinscope(id) {
        saveCurrentRuinscope();
        const rs = ruinscopes.find(r => r.id === id);
        if (!rs) return;
        currentRuinscopeId = rs.id;
        nodes = (rs.nodes || []).map(n => ({ ...n }));
        edges = (rs.edges || []).map(e => ({ ...e }));
        selectedNode = null;
        connectingFrom = null;
        swapFirst = null;
        scrambled = false;
        originalPositions = null;
        targetPositionalEdges = null;
        solveMode = rs.solveMode || 'untangle';
        swapRule = rs.swapRule || 'free';
        invalidSwapFlash = null;
        updateInfo();
        render();
    }

    function createRuinscope(name) {
        const id = 'ruinscope_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        ruinscopes.push({ id, name: name || 'Untitled', nodes: [], edges: [], solveMode: 'untangle', swapRule: 'free' });
        switchRuinscope(id);
        return id;
    }

    function deleteRuinscope(id) {
        ruinscopes = ruinscopes.filter(r => r.id !== id);
        if (currentRuinscopeId === id) {
            if (ruinscopes.length > 0) {
                switchRuinscope(ruinscopes[0].id);
            } else {
                currentRuinscopeId = null;
                nodes = [];
                edges = [];
                render();
            }
        }
        updateInfo();
    }

    function getRuinscopeData() {
        saveCurrentRuinscope();
        return { ruinscopes: ruinscopes.map(r => ({ ...r, nodes: (r.nodes || []).map(n => ({ ...n })), edges: (r.edges || []).map(e => ({ ...e })) })) };
    }

    function loadRuinscopeData(data) {
        if (!data) return;
        ruinscopes = (data.ruinscopes || []).map(r => ({
            ...r,
            nodes: (r.nodes || []).map(n => ({ ...n })),
            edges: (r.edges || []).map(e => ({ ...e }))
        }));
        if (ruinscopes.length > 0 && active) {
            switchRuinscope(ruinscopes[0].id);
        }
    }

    function getAllRuinscopes() { return ruinscopes; }
    function getCurrentRuinscopeId() { return currentRuinscopeId; }

    function refreshSidebarList() {
        if (typeof Toolbar !== 'undefined' && Toolbar.refreshRuinscopeList) {
            Toolbar.refreshRuinscopeList();
        }
    }

    return {
        activate, deactivate, isActive,
        getRuinscopeData, loadRuinscopeData,
        getAllRuinscopes, getCurrentRuinscopeId,
        switchRuinscope, createRuinscope, deleteRuinscope,
        refreshSidebarList
    };
})();
