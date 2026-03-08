const BlueprintEditor = (() => {
    // ========== STATE ==========
    let active = false;
    let blueprintElements = [];
    let selectedElement = null;
    let activeTool = 'select';
    let drawing = null;
    let popoverEl = null;
    let viewport = { offsetX: 0, offsetY: 0, zoom: 1.0 };
    let blueprintMetadata = { created: Date.now(), modified: Date.now() };
    let itemWheelOpen = false;
    let pendingItemPlacement = null; // { x, y } for item placement after selection
    let draggingItem = null; // { element, startMouseX, startMouseY, startElemX, startElemY }
    let panning = null; // { startX, startY, origOffsetX, origOffsetY } for middle-click pan
    let scrollbarDrag = null; // { axis: 'h'|'v', startMouse, startOffset }

    // ========== CONSTANTS ==========
    const GRID_SIZE = 40;
    const GRID_COLOR = '#332820';
    const GRID_BG = '#0a0a0a';

    // ========== CANVAS MANAGEMENT ==========
    let blueprintCanvas = null;
    let ctx = null;
    let toolsetEl = null;
    let toolsPanelDrag = null;

    function initCanvas() {
        blueprintCanvas = document.getElementById('blueprint-canvas');
        if (!blueprintCanvas) {
            console.error('Blueprint canvas not found');
            return false;
        }
        ctx = blueprintCanvas.getContext('2d');

        // Resize to match viewport
        const parent = blueprintCanvas.parentElement;
        blueprintCanvas.width = parent.clientWidth;
        blueprintCanvas.height = parent.clientHeight;

        // Bind mouse events
        blueprintCanvas.addEventListener('mousedown', handleMouseDown);
        blueprintCanvas.addEventListener('mousemove', handleMouseMove);
        blueprintCanvas.addEventListener('mouseup', handleMouseUp);
        blueprintCanvas.addEventListener('wheel', handleWheel, { passive: false });

        return true;
    }

    // ========== ACTIVATION / DEACTIVATION ==========
    function activate() {
        if (active) return;
        active = true;

        // Hide main canvas, show blueprint canvas
        document.getElementById('game-canvas').classList.add('hidden');
        document.getElementById('blueprint-canvas').classList.remove('hidden');

        // Initialize canvas if needed
        if (!blueprintCanvas) {
            if (!initCanvas()) return;
        }

        // Resize canvas
        const parent = blueprintCanvas.parentElement;
        blueprintCanvas.width = parent.clientWidth;
        blueprintCanvas.height = parent.clientHeight;

        // Show toolset
        showToolset();

        // Render
        renderBlueprint();
    }

    function deactivate() {
        if (!active) return;
        active = false;

        // Show main canvas, hide blueprint canvas
        document.getElementById('blueprint-canvas').classList.add('hidden');
        document.getElementById('game-canvas').classList.remove('hidden');

        // Hide toolset
        hideToolset();

        // Close popover
        closeConfigPopover();

        // Restore main canvas (resize recalculates dimensions after unhiding)
        if (typeof Canvas !== 'undefined') {
            Canvas.resize();
        }
    }

    function isActive() {
        return active;
    }

    // ========== GRID RENDERING ==========
    function renderGrid() {
        ctx.fillStyle = GRID_BG;
        ctx.fillRect(0, 0, blueprintCanvas.width, blueprintCanvas.height);

        const z = viewport.zoom;
        const gs = GRID_SIZE * z;
        const ox = viewport.offsetX % gs;
        const oy = viewport.offsetY % gs;

        ctx.strokeStyle = GRID_COLOR;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);

        // Vertical lines
        for (let x = ox; x < blueprintCanvas.width; x += gs) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, blueprintCanvas.height);
            ctx.stroke();
        }

        // Horizontal lines
        for (let y = oy; y < blueprintCanvas.height; y += gs) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(blueprintCanvas.width, y);
            ctx.stroke();
        }

        ctx.setLineDash([]);
    }

    // Convert screen (canvas pixel) coords to world coords
    function screenToWorld(sx, sy) {
        return {
            x: (sx - viewport.offsetX) / viewport.zoom,
            y: (sy - viewport.offsetY) / viewport.zoom
        };
    }

    function snapToGrid(value) {
        return Math.round(value / GRID_SIZE) * GRID_SIZE;
    }

    function snapRectToGrid(x, y, width, height) {
        return {
            x: snapToGrid(x),
            y: snapToGrid(y),
            width: Math.max(GRID_SIZE, snapToGrid(width)),
            height: Math.max(GRID_SIZE, snapToGrid(height))
        };
    }

    // ========== ELEMENT RENDERING ==========
    function renderBlueprint() {
        if (!ctx) return;

        renderGrid();

        ctx.save();
        ctx.translate(viewport.offsetX, viewport.offsetY);
        ctx.scale(viewport.zoom, viewport.zoom);

        // Render all elements
        blueprintElements.forEach(el => renderElement(el));

        // Render drawing preview
        if (drawing) {
            renderDrawingPreview();
        }

        ctx.restore();

        // Scrollbars (screen space)
        renderScrollbars();

        // Zoom label
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(Math.round(viewport.zoom * 100) + '%', blueprintCanvas.width - 8, blueprintCanvas.height - 8);
        ctx.textAlign = 'left';
    }

    function renderElement(element) {
        const isSelected = element === selectedElement;
        const x = element.x;
        const y = element.y;

        // Perspective tool renders as X
        if (element.type === 'perspective') {
            ctx.strokeStyle = isSelected ? '#00e5ff' : '#ffffff';
            ctx.lineWidth = isSelected ? 3 : 2;

            // Draw X
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + element.width, y + element.height);
            ctx.moveTo(x + element.width, y);
            ctx.lineTo(x, y + element.height);
            ctx.stroke();

            // Label
            if (element.label) {
                ctx.fillStyle = '#f5f5f5';
                ctx.font = '12px sans-serif';
                ctx.fillText(element.label, x + 8, y - 8);
            }
            return;
        }

        // Items render with their image
        if (element.type === 'item') {
            // Get item image
            let itemImage = null;
            if (element.itemId && typeof InventoryEditor !== 'undefined') {
                const item = InventoryEditor.getItem(element.itemId);
                if (item && item.image) {
                    itemImage = item.image;
                }
            }

            if (itemImage) {
                // Draw image
                const img = new Image();
                img.src = itemImage;
                if (img.complete) {
                    ctx.drawImage(img, x, y, element.width, element.height);
                } else {
                    img.onload = () => {
                        renderBlueprint();
                    };
                    // Draw placeholder while loading
                    ctx.fillStyle = element.color || '#ff6b35';
                    ctx.fillRect(x, y, element.width, element.height);
                }
            } else {
                // Fallback: colored square if no image
                ctx.fillStyle = element.color || '#ff6b35';
                ctx.fillRect(x, y, element.width, element.height);
            }

            // Border
            ctx.strokeStyle = isSelected ? '#00e5ff' : '#ffffff';
            ctx.lineWidth = isSelected ? 3 : 2;
            ctx.strokeRect(x, y, element.width, element.height);

            // Label below
            if (element.label) {
                ctx.fillStyle = '#f5f5f5';
                ctx.font = '10px sans-serif';
                ctx.fillText(element.label, x, y + element.height + 12);
            }
            return;
        }

        // Doors and windows get filled, rooms/assets stay transparent
        const shouldFill = element.type === 'door';

        if (shouldFill) {
            ctx.fillStyle = element.color || getElementColor(element.type);
            ctx.fillRect(x, y, element.width, element.height);
        }

        // Border
        ctx.strokeStyle = isSelected ? '#00e5ff' : (element.color || getElementColor(element.type));
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.strokeRect(x, y, element.width, element.height);

        // Label
        if (element.label) {
            ctx.fillStyle = '#f5f5f5';
            ctx.font = '12px sans-serif';
            ctx.fillText(element.label, x + 8, y + 20);
        }

        // Type indicator
        ctx.fillStyle = '#a89080';
        ctx.font = '10px sans-serif';
        ctx.fillText(element.type, x + 8, y + element.height - 8);
    }

    function renderDrawingPreview() {
        const x = Math.min(drawing.startX, drawing.currentX);
        const y = Math.min(drawing.startY, drawing.currentY);
        const w = Math.abs(drawing.currentX - drawing.startX);
        const h = Math.abs(drawing.currentY - drawing.startY);

        ctx.strokeStyle = '#ff6b35';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);
    }

    function getElementColor(type) {
        switch (type) {
            case 'room': return '#ffffff';
            case 'door': return 'rgba(128, 128, 128, 0.5)';
            case 'window': return '#cccccc';
            case 'asset': return '#999999';
            case 'perspective': return '#ffffff';
            default: return '#ffffff';
        }
    }

    // ========== TOOLSET UI ==========
    function showToolset() {
        const panel = document.getElementById('blueprint-tools-panel');
        const body = document.getElementById('blueprint-tools-body');

        if (!panel || !body) return;

        body.innerHTML = `
            <div class="blueprint-tool-grid">
                <button class="blueprint-tool" data-tool="room" title="Room">
                    <span class="tool-icon">□</span>
                    <span class="tool-label">Room</span>
                </button>
                <button class="blueprint-tool" data-tool="door" title="Door">
                    <span class="tool-icon">■</span>
                    <span class="tool-label">Door</span>
                </button>
                <button class="blueprint-tool" data-tool="window" title="Window">
                    <span class="tool-icon">▭</span>
                    <span class="tool-label">Window</span>
                </button>
                <button class="blueprint-tool" data-tool="asset" title="Asset">
                    <span class="tool-icon">▢</span>
                    <span class="tool-label">Asset</span>
                </button>
                <button class="blueprint-tool" data-tool="perspective" title="Perspective">
                    <span class="tool-icon">✕</span>
                    <span class="tool-label">Perspective</span>
                </button>
                <button class="blueprint-tool" data-tool="item" title="Item">
                    <span class="tool-icon">◆</span>
                    <span class="tool-label">Item</span>
                </button>
            </div>
            <div style="margin-top:8px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.1);">
                <label style="font-size:10px; color:var(--text-secondary);">Zoom: <span id="blueprint-zoom-label">${Math.round(viewport.zoom * 100)}%</span></label>
                <input type="range" id="blueprint-zoom-slider" min="0.2" max="4" step="0.05" value="${viewport.zoom}" style="width:100%; margin-top:2px;">
                <button class="panel-btn" id="blueprint-zoom-reset" style="font-size:10px; width:100%; margin-top:4px;">Reset View</button>
            </div>
        `;

        // Wire tool buttons
        body.querySelectorAll('.blueprint-tool').forEach(btn => {
            btn.addEventListener('click', () => selectTool(btn.dataset.tool));
        });

        // Wire zoom slider
        const zoomSlider = document.getElementById('blueprint-zoom-slider');
        if (zoomSlider) {
            zoomSlider.addEventListener('input', (e) => {
                const cw = blueprintCanvas.width / 2;
                const ch = blueprintCanvas.height / 2;
                const oldZoom = viewport.zoom;
                viewport.zoom = parseFloat(e.target.value);
                viewport.offsetX = cw - (cw - viewport.offsetX) * (viewport.zoom / oldZoom);
                viewport.offsetY = ch - (ch - viewport.offsetY) * (viewport.zoom / oldZoom);
                document.getElementById('blueprint-zoom-label').textContent = Math.round(viewport.zoom * 100) + '%';
                renderBlueprint();
            });
        }

        // Wire reset button
        const resetBtn = document.getElementById('blueprint-zoom-reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                viewport.zoom = 1.0;
                viewport.offsetX = 0;
                viewport.offsetY = 0;
                updateZoomSlider();
                renderBlueprint();
            });
        }

        // Wire close button
        const closeBtn = document.getElementById('blueprint-tools-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', hideToolset);
        }

        // Wire drag functionality
        const header = panel.querySelector('.float-panel-header');
        if (header) {
            header.addEventListener('mousedown', (e) => {
                if (e.target === closeBtn) return;
                const rect = panel.getBoundingClientRect();
                toolsPanelDrag = {
                    startX: e.clientX,
                    startY: e.clientY,
                    origLeft: rect.left,
                    origTop: rect.top
                };
                // Convert from right-positioned to left-positioned for dragging
                panel.style.right = 'auto';
                panel.style.left = rect.left + 'px';
                panel.style.top = rect.top + 'px';
                e.preventDefault();
            });
        }

        // Global mouse handlers for dragging (added once)
        if (!window.blueprintToolsDragHandlersAdded) {
            document.addEventListener('mousemove', (e) => {
                if (!toolsPanelDrag) return;
                const panel = document.getElementById('blueprint-tools-panel');
                if (!panel) return;
                const dx = e.clientX - toolsPanelDrag.startX;
                const dy = e.clientY - toolsPanelDrag.startY;
                panel.style.left = (toolsPanelDrag.origLeft + dx) + 'px';
                panel.style.top = (toolsPanelDrag.origTop + dy) + 'px';
            });
            document.addEventListener('mouseup', () => {
                toolsPanelDrag = null;
            });
            window.blueprintToolsDragHandlersAdded = true;
        }

        panel.classList.remove('hidden');
        toolsetEl = body; // Store reference for selectTool
    }

    function hideToolset() {
        const panel = document.getElementById('blueprint-tools-panel');
        if (panel) {
            panel.classList.add('hidden');
        }
        toolsetEl = null;
    }

    function selectTool(toolName) {
        // Toggle behavior: if clicking the same tool, deselect and go to select mode
        if (activeTool === toolName) {
            activeTool = 'select';
            if (toolsetEl) {
                toolsetEl.querySelectorAll('.blueprint-tool').forEach(btn => {
                    btn.classList.remove('active');
                });
            }
        } else {
            activeTool = toolName;
            if (toolsetEl) {
                toolsetEl.querySelectorAll('.blueprint-tool').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.tool === toolName);
                });
            }
        }
    }

    // ========== ITEM RADIAL WHEEL ==========
    function openItemRadialWheel(clientX, clientY, gridX, gridY) {
        const items = typeof InventoryEditor !== 'undefined' ? InventoryEditor.getAllItems() : [];
        closeItemRadialWheel();
        pendingItemPlacement = { x: gridX, y: gridY };
        RadialWheel.open(items, clientX, clientY, (itemId) => {
            itemWheelOpen = false;
            handleItemSelection(itemId);
        }, {
            emptyText: 'No items available',
            onClose() { itemWheelOpen = false; pendingItemPlacement = null; }
        });
        itemWheelOpen = true;
    }

    function closeItemRadialWheel() {
        RadialWheel.close();
        itemWheelOpen = false;
        pendingItemPlacement = null;
    }

    function handleItemSelection(itemId) {
        if (!pendingItemPlacement) {
            closeItemRadialWheel();
            return;
        }

        const { x, y } = pendingItemPlacement;
        const element = createBlueprintElement(
            'item',
            x,
            y,
            GRID_SIZE,
            GRID_SIZE
        );
        element.itemId = itemId;

        // Get item to set label and color
        if (typeof InventoryEditor !== 'undefined') {
            const item = InventoryEditor.getItem(itemId);
            if (item) {
                element.label = item.name;
                element.color = item.color || '#ff6b35';
            }
        }

        blueprintElements.push(element);
        selectElement(element);
        renderBlueprint();
        refreshListView();
        closeItemRadialWheel();
    }

    // ========== MOUSE INTERACTION ==========
    function handleMouseDown(e) {
        if (!active) return;

        // Middle-click pan
        if (e.button === 1) {
            e.preventDefault();
            panning = { startX: e.clientX, startY: e.clientY, origOffsetX: viewport.offsetX, origOffsetY: viewport.offsetY };
            return;
        }

        const rect = blueprintCanvas.getBoundingClientRect();
        const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        const world = screenToWorld(screen.x, screen.y);
        const startX = world.x;
        const startY = world.y;

        // Item tool: open radial wheel at click position
        if (activeTool === 'item') {
            const gridX = snapToGrid(startX);
            const gridY = snapToGrid(startY);
            openItemRadialWheel(e.clientX, e.clientY, gridX, gridY);
            return;
        }

        // Skip hit testing when placing perspective or assets (allows placement inside rooms)
        if (activeTool === 'perspective') {
            const element = createBlueprintElement(
                activeTool,
                snapToGrid(startX),
                snapToGrid(startY),
                GRID_SIZE,
                GRID_SIZE
            );
            blueprintElements.push(element);
            selectElement(element);
            renderBlueprint();
            refreshListView();
            return;
        }

        // For drawing tools (room, door, window, asset), start drawing without hit testing
        if (activeTool === 'room' || activeTool === 'asset' || activeTool === 'door' || activeTool === 'window') {
            // Deselect current selection when starting a new draw
            if (selectedElement) {
                deselectElement();
            }

            drawing = {
                tool: activeTool,
                startX: snapToGrid(startX),
                startY: snapToGrid(startY),
                currentX: snapToGrid(startX),
                currentY: snapToGrid(startY)
            };
            return;
        }

        // Check if clicking existing element
        const hitElement = hitTestElement(startX, startY);
        if (hitElement) {
            // If clicking already-selected item, start drag instead of re-selecting
            if (hitElement === selectedElement && hitElement.type === 'item') {
                draggingItem = {
                    element: hitElement,
                    startMouseX: startX,
                    startMouseY: startY,
                    startElemX: hitElement.x,
                    startElemY: hitElement.y
                };
                closeConfigPopover(); // Close popover during drag
            } else {
                selectElement(hitElement);
            }
            return;
        }

        // Deselect if clicking empty space
        if (selectedElement) {
            deselectElement();
        }
    }

    function handleMouseMove(e) {
        if (!active) return;

        // Middle-click pan
        if (panning) {
            viewport.offsetX = panning.origOffsetX + (e.clientX - panning.startX);
            viewport.offsetY = panning.origOffsetY + (e.clientY - panning.startY);
            renderBlueprint();
            return;
        }

        // Handle item dragging
        if (draggingItem) {
            const rect = blueprintCanvas.getBoundingClientRect();
            const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
            const currentX = world.x;
            const currentY = world.y;

            const deltaX = currentX - draggingItem.startMouseX;
            const deltaY = currentY - draggingItem.startMouseY;

            // Update item position (grid-snapped)
            draggingItem.element.x = snapToGrid(draggingItem.startElemX + deltaX);
            draggingItem.element.y = snapToGrid(draggingItem.startElemY + deltaY);

            renderBlueprint();
            return;
        }

        if (!drawing) return;

        const rect = blueprintCanvas.getBoundingClientRect();
        const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
        const currentX = snapToGrid(world.x);
        const currentY = snapToGrid(world.y);

        drawing.currentX = currentX;
        drawing.currentY = currentY;

        renderBlueprint();
    }

    function handleMouseUp(e) {
        if (!active) return;
        if (panning) { panning = null; return; }
        // Handle item drag end
        if (draggingItem) {
            draggingItem = null;
            renderBlueprint();
            refreshListView(); // Update list if item moved between rooms
            if (selectedElement) {
                showConfigPopover(selectedElement); // Reopen popover at new position
            }
            return;
        }

        if (!drawing) return;

        const width = Math.abs(drawing.currentX - drawing.startX);
        const height = Math.abs(drawing.currentY - drawing.startY);

        // Minimum size check
        if (width >= GRID_SIZE && height >= GRID_SIZE) {
            const element = createBlueprintElement(
                drawing.tool,
                Math.min(drawing.startX, drawing.currentX),
                Math.min(drawing.startY, drawing.currentY),
                width,
                height
            );
            blueprintElements.push(element);
            selectElement(element);
            refreshListView();
        }

        drawing = null;
        renderBlueprint();
    }

    function handleWheel(e) {
        if (!active) return;
        e.preventDefault();

        if (e.ctrlKey || e.metaKey) {
            // Zoom
            const rect = blueprintCanvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const oldZoom = viewport.zoom;
            const delta = e.deltaY > 0 ? -0.05 : 0.05;
            viewport.zoom = Math.max(0.2, Math.min(4, viewport.zoom + delta));
            // Zoom toward mouse position
            viewport.offsetX = mx - (mx - viewport.offsetX) * (viewport.zoom / oldZoom);
            viewport.offsetY = my - (my - viewport.offsetY) * (viewport.zoom / oldZoom);
            updateZoomSlider();
        } else {
            // Pan
            viewport.offsetX -= e.deltaX;
            viewport.offsetY -= e.deltaY;
        }
        renderBlueprint();
    }

    function updateZoomSlider() {
        const slider = document.getElementById('blueprint-zoom-slider');
        const label = document.getElementById('blueprint-zoom-label');
        if (slider) slider.value = viewport.zoom;
        if (label) label.textContent = Math.round(viewport.zoom * 100) + '%';
    }

    // ========== SCROLLBARS ==========
    function getContentBounds() {
        if (blueprintElements.length === 0) return { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const el of blueprintElements) {
            minX = Math.min(minX, el.x);
            minY = Math.min(minY, el.y);
            maxX = Math.max(maxX, el.x + el.width);
            maxY = Math.max(maxY, el.y + el.height);
        }
        const pad = 400;
        return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
    }

    function renderScrollbars() {
        const bounds = getContentBounds();
        const z = viewport.zoom;
        const cw = blueprintCanvas.width;
        const ch = blueprintCanvas.height;
        const totalW = (bounds.maxX - bounds.minX) * z;
        const totalH = (bounds.maxY - bounds.minY) * z;
        const barSize = 6;
        const margin = 2;

        // Horizontal scrollbar
        if (totalW > cw) {
            const viewLeft = -viewport.offsetX + bounds.minX * z;
            const thumbW = Math.max(30, (cw / totalW) * (cw - margin * 2));
            const trackW = cw - margin * 2;
            const thumbX = margin + (viewLeft / totalW) * trackW;

            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            ctx.fillRect(margin, ch - barSize - margin, trackW, barSize);
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            ctx.fillRect(Math.max(margin, Math.min(thumbX, margin + trackW - thumbW)), ch - barSize - margin, thumbW, barSize);
        }

        // Vertical scrollbar
        if (totalH > ch) {
            const viewTop = -viewport.offsetY + bounds.minY * z;
            const thumbH = Math.max(30, (ch / totalH) * (ch - margin * 2));
            const trackH = ch - margin * 2;
            const thumbY = margin + (viewTop / totalH) * trackH;

            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            ctx.fillRect(cw - barSize - margin, margin, barSize, trackH);
            ctx.fillStyle = 'rgba(255,255,255,0.25)';
            ctx.fillRect(cw - barSize - margin, Math.max(margin, Math.min(thumbY, margin + trackH - thumbH)), barSize, thumbH);
        }
    }

    function hitTestElement(x, y) {
        // Test in reverse order (top-to-bottom)
        for (let i = blueprintElements.length - 1; i >= 0; i--) {
            const el = blueprintElements[i];
            if (x >= el.x && x <= el.x + el.width &&
                y >= el.y && y <= el.y + el.height) {
                return el;
            }
        }
        return null;
    }

    // ========== SELECTION ==========
    function selectElement(element) {
        selectedElement = element;
        renderBlueprint();
        showConfigPopover(element);
    }

    function deselectElement() {
        selectedElement = null;
        closeConfigPopover();
        renderBlueprint();
    }

    // ========== SPATIAL DETECTION ==========
    function detectTouchingRooms(element) {
        // Find all rooms this element overlaps with
        return blueprintElements.filter(room => {
            if (room.type !== 'room') return false;

            // Check if rectangles overlap
            const overlapX = !(element.x + element.width < room.x || element.x > room.x + room.width);
            const overlapY = !(element.y + element.height < room.y || element.y > room.y + room.height);

            return overlapX && overlapY;
        });
    }

    // ========== CONFIG POPOVERS ==========
    function showConfigPopover(element) {
        closeConfigPopover();

        const canvas = document.getElementById('blueprint-canvas');
        const rect = canvas.getBoundingClientRect();

        popoverEl = document.createElement('div');
        popoverEl.className = 'hotspot-popover blueprint-popover';
        popoverEl.style.position = 'fixed';
        popoverEl.style.left = (rect.left + element.x * viewport.zoom + viewport.offsetX + element.width * viewport.zoom + 12) + 'px';
        popoverEl.style.top = (rect.top + element.y * viewport.zoom + viewport.offsetY) + 'px';

        popoverEl.innerHTML = generatePopoverHTML(element);

        document.getElementById('hotspot-overlay').appendChild(popoverEl);
        bindPopoverEvents(element);

        // Reposition if off-screen or colliding with panels
        requestAnimationFrame(() => {
            if (!popoverEl) return;
            const popRect = popoverEl.getBoundingClientRect();

            // Get panel boundaries
            const leftPanel = document.getElementById('toolbar-panel');
            const rightPanel = document.getElementById('blueprint-tools-panel');
            const leftPanelRight = leftPanel && !leftPanel.classList.contains('hidden')
                ? leftPanel.getBoundingClientRect().right + 12
                : 0;
            const rightPanelLeft = rightPanel && !rightPanel.classList.contains('hidden')
                ? rightPanel.getBoundingClientRect().left - 12
                : window.innerWidth;

            // Check collision with right panel or right edge
            if (popRect.right > rightPanelLeft || popRect.right > window.innerWidth) {
                // Position to the left of element
                popoverEl.style.left = Math.max(leftPanelRight, rect.left + element.x * viewport.zoom + viewport.offsetX - popRect.width - 12) + 'px';
            }

            // Check collision with left panel
            if (popRect.left < leftPanelRight) {
                // Position to the right of left panel
                popoverEl.style.left = leftPanelRight + 'px';
            }

            // Check bottom edge
            if (popRect.bottom > window.innerHeight) {
                popoverEl.style.top = Math.max(70, window.innerHeight - popRect.height - 10) + 'px';
            }

            // Check top edge
            if (popRect.top < 70) {
                popoverEl.style.top = '70px';
            }
        });
    }

    function closeConfigPopover() {
        if (popoverEl) {
            popoverEl.remove();
            popoverEl = null;
        }
    }

    function generatePopoverHTML(element) {
        const commonHTML = `
            <div class="popover-header">
                <span class="popover-title">${element.type.charAt(0).toUpperCase() + element.type.slice(1)} Config</span>
                <button class="popover-close">&times;</button>
            </div>
            <div class="popover-field">
                <label>Label</label>
                <input class="panel-input" id="bp-element-label" value="${element.label || ''}" placeholder="${element.type} name..." spellcheck="false">
            </div>
        `;

        let typeSpecificHTML = '';

        if (element.type === 'room') {
            const scenes = typeof SceneManager !== 'undefined' ? SceneManager.getAllScenes() : [];
            typeSpecificHTML = `
                <div class="popover-field">
                    <label>Linked Scene</label>
                    <select class="panel-select" id="bp-element-scene">
                        <option value="">-- None --</option>
                        ${scenes.map(s =>
                            `<option value="${s.id}" ${element.sceneId === s.id ? 'selected' : ''}>${s.name}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="popover-field">
                    <label>Color</label>
                    <input type="color" class="panel-input" id="bp-element-color" value="${element.color || '#ff6b35'}">
                </div>
            `;
        } else if (element.type === 'door') {
            // Auto-detect rooms this door touches
            const touchingRooms = detectTouchingRooms(element);
            const puzzles = typeof PuzzleEditor !== 'undefined' ? PuzzleEditor.getAllPuzzles() : [];
            const scenes = typeof SceneManager !== 'undefined' ? SceneManager.getAllScenes() : [];

            typeSpecificHTML = `
                <div class="popover-field">
                    <label>Touches Rooms</label>
                    <div class="panel-label" style="color: var(--text-secondary); font-size: 11px;">
                        ${touchingRooms.length > 0 ? touchingRooms.map(r => r.label || 'Unnamed').join(', ') : 'None detected'}
                    </div>
                </div>
                <div class="popover-field">
                    <label>Description</label>
                    <textarea class="panel-input" id="bp-door-desc" placeholder="Door description..." style="min-height:60px; resize:vertical;">${element.description || ''}</textarea>
                </div>
                <div class="popover-field">
                    <label>Linked Scene</label>
                    <select class="panel-select" id="bp-element-scene">
                        <option value="">-- None --</option>
                        ${scenes.map(s =>
                            `<option value="${s.id}" ${element.sceneId === s.id ? 'selected' : ''}>${s.name}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="popover-field">
                    <label>Linked Puzzle</label>
                    <select class="panel-select" id="bp-element-puzzle">
                        <option value="">-- None --</option>
                        ${puzzles.map(p =>
                            `<option value="${p.id}" ${element.puzzleId === p.id ? 'selected' : ''}>${p.name}</option>`
                        ).join('')}
                    </select>
                </div>
            `;
        } else if (element.type === 'window') {
            const touchingRooms = detectTouchingRooms(element);
            const puzzles = typeof PuzzleEditor !== 'undefined' ? PuzzleEditor.getAllPuzzles() : [];
            const scenes = typeof SceneManager !== 'undefined' ? SceneManager.getAllScenes() : [];

            typeSpecificHTML = `
                <div class="popover-field">
                    <label>Belongs to Room</label>
                    <div class="panel-label" style="color: var(--text-secondary); font-size: 11px;">
                        ${touchingRooms.length > 0 ? (touchingRooms[0].label || 'Unnamed') : 'None detected'}
                    </div>
                </div>
                <div class="popover-field">
                    <label>Description</label>
                    <textarea class="panel-input" id="bp-window-desc" placeholder="What can be seen..." style="min-height:60px; resize:vertical;">${element.description || ''}</textarea>
                </div>
                <div class="popover-field">
                    <label>Linked Scene</label>
                    <select class="panel-select" id="bp-element-scene">
                        <option value="">-- None --</option>
                        ${scenes.map(s =>
                            `<option value="${s.id}" ${element.sceneId === s.id ? 'selected' : ''}>${s.name}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="popover-field">
                    <label>Linked Puzzle</label>
                    <select class="panel-select" id="bp-element-puzzle">
                        <option value="">-- None --</option>
                        ${puzzles.map(p =>
                            `<option value="${p.id}" ${element.puzzleId === p.id ? 'selected' : ''}>${p.name}</option>`
                        ).join('')}
                    </select>
                </div>
            `;
        } else if (element.type === 'asset') {
            const touchingRooms = detectTouchingRooms(element);
            const parentRoom = touchingRooms.length > 0 ? touchingRooms[0] : null;
            const puzzles = typeof PuzzleEditor !== 'undefined' ? PuzzleEditor.getAllPuzzles() : [];

            // Get scene and scene assets from parent room
            let inheritedScene = null;
            let sceneAssets = [];
            if (parentRoom && parentRoom.sceneId && typeof SceneManager !== 'undefined') {
                const allScenes = SceneManager.getAllScenes();
                inheritedScene = allScenes.find(s => s.id === parentRoom.sceneId);
                if (inheritedScene && inheritedScene.sceneAssets) {
                    sceneAssets = inheritedScene.sceneAssets;
                }
            }

            typeSpecificHTML = `
                <div class="popover-field">
                    <label>Belongs to Room</label>
                    <div class="panel-label" style="color: var(--text-secondary); font-size: 11px;">
                        ${parentRoom ? (parentRoom.label || 'Unnamed') : 'None detected'}
                    </div>
                </div>
                <div class="popover-field">
                    <label>Inherited Scene</label>
                    <div class="panel-label" style="color: var(--text-secondary); font-size: 11px;">
                        ${inheritedScene ? inheritedScene.name : 'None (room has no scene)'}
                    </div>
                </div>
                <div class="popover-field">
                    <label>Linked Scene Asset</label>
                    <select class="panel-select" id="bp-asset-link">
                        <option value="">-- None --</option>
                        ${sceneAssets.map(a =>
                            `<option value="${a.id}" ${element.assetId === a.id ? 'selected' : ''}>${a.name}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="popover-field">
                    <label>Linked Puzzle</label>
                    <select class="panel-select" id="bp-element-puzzle">
                        <option value="">-- None --</option>
                        ${puzzles.map(p =>
                            `<option value="${p.id}" ${element.puzzleId === p.id ? 'selected' : ''}>${p.name}</option>`
                        ).join('')}
                    </select>
                </div>
            `;
        } else if (element.type === 'perspective') {
            const touchingRooms = detectTouchingRooms(element);
            const parentRoom = touchingRooms.length > 0 ? touchingRooms[0] : null;

            // Get inherited scene from parent room
            let inheritedScene = null;
            if (parentRoom && parentRoom.sceneId && typeof SceneManager !== 'undefined') {
                const allScenes = SceneManager.getAllScenes();
                inheritedScene = allScenes.find(s => s.id === parentRoom.sceneId);
            }

            typeSpecificHTML = `
                <div class="popover-field">
                    <label>Belongs to Room</label>
                    <div class="panel-label" style="color: var(--text-secondary); font-size: 11px;">
                        ${parentRoom ? (parentRoom.label || 'Unnamed') : 'None detected'}
                    </div>
                </div>
                <div class="popover-field">
                    <label>Inherited Scene</label>
                    <div class="panel-label" style="color: var(--text-secondary); font-size: 11px;">
                        ${inheritedScene ? inheritedScene.name : 'None (room has no scene)'}
                    </div>
                </div>
            `;
        } else if (element.type === 'item') {
            const touchingRooms = detectTouchingRooms(element);
            const parentRoom = touchingRooms.length > 0 ? touchingRooms[0] : null;
            const items = typeof InventoryEditor !== 'undefined' ? InventoryEditor.getAllItems() : [];

            typeSpecificHTML = `
                <div class="popover-field">
                    <label>Location</label>
                    <div class="panel-label" style="color: var(--text-secondary); font-size: 11px;">
                        ${parentRoom ? (parentRoom.label || 'Unnamed room') : 'Out of bounds'}
                    </div>
                </div>
                <div class="popover-field">
                    <label>Linked Game Item</label>
                    <select class="panel-select" id="bp-item-link">
                        <option value="">-- None --</option>
                        ${items.map(i =>
                            `<option value="${i.id}" ${element.itemId === i.id ? 'selected' : ''}>${i.name}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="popover-field">
                    <label>Color</label>
                    <input type="color" class="panel-input" id="bp-element-color" value="${element.color || '#ff6b35'}">
                </div>
            `;
        }

        return commonHTML + typeSpecificHTML + `
            <button id="bp-element-delete" class="panel-btn danger" style="width:100%; margin-top:8px">Delete</button>
        `;
    }

    function bindPopoverEvents(element) {
        popoverEl.querySelector('.popover-close').addEventListener('click', () => {
            deselectElement();
        });

        const labelInput = popoverEl.querySelector('#bp-element-label');
        labelInput.addEventListener('input', () => {
            element.label = labelInput.value;
            renderBlueprint();
            refreshListView();
        });

        if (element.type === 'room') {
            const sceneSelect = popoverEl.querySelector('#bp-element-scene');
            sceneSelect.addEventListener('change', () => {
                element.sceneId = sceneSelect.value || null;
                refreshListView(); // Update perspective labels that inherit from this room
            });

            const colorInput = popoverEl.querySelector('#bp-element-color');
            colorInput.addEventListener('input', () => {
                element.color = colorInput.value;
                renderBlueprint();
            });
        } else if (element.type === 'door') {
            const descTextarea = popoverEl.querySelector('#bp-door-desc');
            descTextarea.addEventListener('input', () => {
                element.description = descTextarea.value;
            });

            const sceneSelect = popoverEl.querySelector('#bp-element-scene');
            sceneSelect.addEventListener('change', () => {
                element.sceneId = sceneSelect.value || null;
            });

            const puzzleSelect = popoverEl.querySelector('#bp-element-puzzle');
            puzzleSelect.addEventListener('change', () => {
                element.puzzleId = puzzleSelect.value || null;
            });
        } else if (element.type === 'window') {
            const descTextarea = popoverEl.querySelector('#bp-window-desc');
            descTextarea.addEventListener('input', () => {
                element.description = descTextarea.value;
            });

            const sceneSelect = popoverEl.querySelector('#bp-element-scene');
            sceneSelect.addEventListener('change', () => {
                element.sceneId = sceneSelect.value || null;
            });

            const puzzleSelect = popoverEl.querySelector('#bp-element-puzzle');
            puzzleSelect.addEventListener('change', () => {
                element.puzzleId = puzzleSelect.value || null;
            });
        } else if (element.type === 'asset') {
            const assetSelect = popoverEl.querySelector('#bp-asset-link');
            assetSelect.addEventListener('change', () => {
                element.assetId = assetSelect.value || null;
            });

            const puzzleSelect = popoverEl.querySelector('#bp-element-puzzle');
            puzzleSelect.addEventListener('change', () => {
                element.puzzleId = puzzleSelect.value || null;
            });
        } else if (element.type === 'perspective') {
            // Perspective inherits scene from room, no event handlers needed
        } else if (element.type === 'item') {
            const itemSelect = popoverEl.querySelector('#bp-item-link');
            itemSelect.addEventListener('change', () => {
                element.itemId = itemSelect.value || null;
                // Update label and color from selected item
                if (element.itemId && typeof InventoryEditor !== 'undefined') {
                    const item = InventoryEditor.getItem(element.itemId);
                    if (item) {
                        element.label = item.name;
                        element.color = item.color || '#ff6b35';
                        const labelInput = popoverEl.querySelector('#bp-element-label');
                        const colorInput = popoverEl.querySelector('#bp-element-color');
                        if (labelInput) labelInput.value = element.label;
                        if (colorInput) colorInput.value = element.color;
                        renderBlueprint();
                        refreshListView();
                    }
                }
            });

            const colorInput = popoverEl.querySelector('#bp-element-color');
            colorInput.addEventListener('input', () => {
                element.color = colorInput.value;
                renderBlueprint();
            });
        }

        const deleteBtn = popoverEl.querySelector('#bp-element-delete');
        deleteBtn.addEventListener('click', () => {
            const idx = blueprintElements.indexOf(element);
            if (idx !== -1) {
                blueprintElements.splice(idx, 1);
            }
            deselectElement();
            renderBlueprint();
            refreshListView();
        });
    }

    // ========== DATA MANAGEMENT ==========
    function createBlueprintElement(type, x, y, width, height) {
        const base = {
            id: 'bp_element_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            type,
            x: snapToGrid(x),
            y: snapToGrid(y),
            width: snapToGrid(width),
            height: snapToGrid(height),
            label: '',
            color: getDefaultColor(type)
        };

        // Type-specific defaults
        if (type === 'room') {
            base.sceneId = null;
        } else if (type === 'door') {
            base.fromRoom = null;
            base.toRoom = null;
            base.description = '';
            base.puzzleId = null;
            base.sceneId = null;
        } else if (type === 'window') {
            base.description = '';
            base.puzzleId = null;
            base.sceneId = null;
        } else if (type === 'asset') {
            base.assetId = null;
            base.puzzleId = null;
        } else if (type === 'perspective') {
            // Perspective inherits sceneId from room, no sceneId field needed
        } else if (type === 'item') {
            base.itemId = null;
        }

        return base;
    }

    function getDefaultColor(type) {
        switch (type) {
            case 'room': return '#ffffff';
            case 'door': return 'rgba(128, 128, 128, 0.5)';
            case 'window': return '#cccccc';
            case 'asset': return '#999999';
            case 'perspective': return '#ffffff';
            case 'item': return '#ff6b35';
            default: return '#ffffff';
        }
    }

    function getBlueprintData() {
        return {
            elements: blueprintElements.map(el => ({ ...el })),
            viewport: { ...viewport },
            metadata: {
                created: blueprintMetadata.created,
                modified: Date.now()
            }
        };
    }

    function loadBlueprintData(data) {
        if (!data) return;

        blueprintElements = (data.elements || []).map(el => ({ ...el }));
        viewport = data.viewport || { offsetX: 0, offsetY: 0, zoom: 1.0 };
        blueprintMetadata = data.metadata || { created: Date.now(), modified: Date.now() };

        if (isActive()) {
            renderBlueprint();
            refreshListView();
        }
    }

    // ========== LIST VIEW ==========
    function getCategorizedElements() {
        const categories = {
            rooms: blueprintElements.filter(el => el.type === 'room'),
            doors: blueprintElements.filter(el => el.type === 'door'),
            windows: blueprintElements.filter(el => el.type === 'window'),
            assets: blueprintElements.filter(el => el.type === 'asset'),
            perspectives: blueprintElements.filter(el => el.type === 'perspective'),
            items: blueprintElements.filter(el => el.type === 'item')
        };
        return categories;
    }

    function selectElementById(id) {
        const element = blueprintElements.find(el => el.id === id);
        if (element) {
            selectElement(element);
        }
    }

    function refreshListView() {
        if (typeof Toolbar !== 'undefined' && isActive()) {
            Toolbar.refreshBlueprintList();
        }
    }

    // ========== PUBLIC API ==========
    return {
        activate,
        deactivate,
        isActive,
        getBlueprintData,
        loadBlueprintData,
        getCategorizedElements,
        selectElementById,
        refreshListView
    };
})();
