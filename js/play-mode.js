const PlayMode = (() => {
    let active = false;
    let selectedItem = null;
    let dialogueEl = null;
    let dialogueTimer = null;
    let typewriterInterval = null;
    let typewriterDone = false;
    let hoveredHotspot = null;
    let itemCursorCache = {};
    let pickMode = null; // { hotspot, assetId, targets: [{ hotspotId, stateIdx, points }] }

    const overlay = document.getElementById('inventory-overlay');
    const overlayGrid = document.getElementById('inventory-overlay-grid');
    const overlayClose = document.getElementById('inventory-overlay-close');
    const inventoryBtn = document.getElementById('play-inventory-btn');
    const hintBtn = document.getElementById('play-hint-btn');
    const puzzleOverlay = document.getElementById('puzzle-overlay');
    const puzzleContent = document.getElementById('puzzle-overlay-content');
    const puzzleClose = document.getElementById('puzzle-overlay-close');
    let activePuzzleHotspot = null;
    let wheelOpen = false;
    const radialWheel = document.getElementById('radial-wheel');
    const radialWheelItems = document.getElementById('radial-wheel-items');

    function enter() {
        active = true;
        selectedItem = null;
        GameState.reset();
        HotspotEditor.closePopover();

        // Unlock audio on first click
        const unlockHandler = () => { AudioManager.unlock(); document.removeEventListener('click', unlockHandler); };
        document.addEventListener('click', unlockHandler);

        // Start at the first scene in the list
        const scenes = SceneManager.getAllScenes();
        if (scenes.length > 0) {
            SceneManager.switchScene(scenes[0].id);
            // Queue scene music (plays after first click unlocks audio)
            const scene = SceneManager.getScene(scenes[0].id);
            if (scene && scene.music) AudioManager.playMusic(scene.music);
        }

        createDialogueBox();
        Canvas.render();
        bindCanvas();
        LoopAnimator.startScene(HotspotEditor.getHotspots());
    }

    function exit() {
        active = false;
        selectedItem = null;
        if (wheelOpen) closeRadialWheel();
        if (pickMode) exitPickMode();
        AudioManager.stop();
        LoopAnimator.stop();
        TransitionPlayer.cancel();
        closeInventoryOverlay();
        puzzleOverlay.classList.add('hidden');
        activePuzzleHotspot = null;
        if (dialogueEl) { dialogueEl.remove(); dialogueEl = null; }
        unbindCanvas();
        Canvas.render();
    }

    function isActive() {
        return active;
    }

    function getSelectedItem() {
        return selectedItem;
    }

    function clearSelectedItem() {
        selectedItem = null;
        Canvas.getCanvasElement().style.cursor = 'default';
        puzzleOverlay.style.cursor = '';
    }

    // -- Inventory Overlay --

    function openInventoryOverlay() {
        refreshInventoryOverlay();
        overlay.classList.remove('hidden');
    }

    function closeInventoryOverlay() {
        overlay.classList.add('hidden');
    }

    function refreshInventoryOverlay() {
        const inv = GameState.getInventory();
        if (inv.length === 0) {
            overlayGrid.innerHTML = '<span style="color:var(--text-secondary); font-size:14px; grid-column: 1/-1; text-align:center; padding:20px;">No items collected yet.</span>';
            return;
        }

        overlayGrid.innerHTML = inv.map(itemId => {
            const item = InventoryEditor.getItem(itemId);
            if (!item) return '';
            return `
                <div class="inventory-overlay-item ${selectedItem === itemId ? 'selected' : ''}" data-item="${itemId}">
                    <div class="inventory-overlay-icon">
                        ${item.image ? `<img src="${item.image}" alt="${item.name}">` : '<span style="font-size:11px; color:var(--text-secondary)">?</span>'}
                    </div>
                    <span class="inventory-overlay-name">${item.name}</span>
                </div>
            `;
        }).join('');

        overlayGrid.querySelectorAll('.inventory-overlay-item').forEach(el => {
            el.addEventListener('click', () => {
                const id = el.dataset.item;
                selectedItem = selectedItem === id ? null : id;
                Canvas.getCanvasElement().style.cursor = getActionCursor(hoveredHotspot);
                refreshInventoryOverlay();
            });
        });
    }

    // -- Radial Inventory Wheel --

    function openRadialWheel(clientX, clientY) {
        const inv = GameState.getInventory();
        radialWheelItems.innerHTML = '';

        // Clamp center so wheel stays in viewport
        const padding = 80;
        const cx = Math.max(padding, Math.min(window.innerWidth - padding, clientX));
        const cy = Math.max(padding, Math.min(window.innerHeight - padding, clientY));

        if (inv.length === 0) {
            const emptyEl = document.createElement('div');
            emptyEl.className = 'radial-wheel-empty';
            emptyEl.style.left = cx + 'px';
            emptyEl.style.top = cy + 'px';
            emptyEl.textContent = 'No items collected';
            radialWheelItems.appendChild(emptyEl);
        } else {
            const radius = inv.length === 1 ? 0 : Math.max(70, inv.length * 18);
            const angleStep = (2 * Math.PI) / inv.length;
            const startAngle = -Math.PI / 2;

            inv.forEach((itemId, i) => {
                const item = InventoryEditor.getItem(itemId);
                if (!item) return;

                const angle = startAngle + angleStep * i;
                const x = cx + Math.cos(angle) * radius;
                const y = cy + Math.sin(angle) * radius;

                const el = document.createElement('div');
                el.className = 'radial-wheel-item' + (selectedItem === itemId ? ' selected' : '');
                el.style.left = x + 'px';
                el.style.top = y + 'px';
                el.dataset.itemId = itemId;

                if (item.image) {
                    const img = document.createElement('img');
                    img.src = item.image;
                    img.alt = item.name;
                    el.appendChild(img);
                }

                const nameEl = document.createElement('span');
                nameEl.className = 'radial-wheel-item-name';
                nameEl.textContent = item.name;
                el.appendChild(nameEl);

                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectedItem = itemId;
                    try {
                        const cur = getItemCursor(itemId);
                        Canvas.getCanvasElement().style.cursor = cur;
                        if (!puzzleOverlay.classList.contains('hidden')) {
                            puzzleOverlay.style.cursor = cur;
                        }
                    } catch (_) {}
                    closeRadialWheel();
                });

                el.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    closeRadialWheel();
                });

                radialWheelItems.appendChild(el);
            });
        }

        radialWheel.classList.remove('hidden');
        wheelOpen = true;
    }

    function closeRadialWheel() {
        radialWheel.classList.add('hidden');
        radialWheelItems.innerHTML = '';
        wheelOpen = false;
    }

    function isWheelOpen() {
        return wheelOpen;
    }

    // -- Puzzle Overlay --

    let puzzleOverlayMode = 'play'; // 'play' or 'edit'
    let activePuzzleRef = null;
    let toolsPanelSide = 'right';

    function openPuzzleOverlay(puzzle, hotspot, caption, mode) {
        activePuzzleHotspot = hotspot;
        activePuzzleRef = puzzle;
        puzzleOverlayMode = mode || 'play';

        // Determine background image and state index
        let stateIdx = puzzle.editingStateIndex || 0;
        if (puzzleOverlayMode === 'play') {
            stateIdx = GameState.getPuzzleState(puzzle.id);
        }
        const currentState = puzzle.states ? (puzzle.states[stateIdx] || puzzle.states[0]) : null;
        const bgSrc = currentState ? currentState.backgroundImage : null;

        // Build content wrapper with background image
        let html = '<div class="puzzle-overlay-bg-wrap" style="position:relative; display:inline-block;">';
        if (bgSrc) {
            html += `<img src="${bgSrc}" alt="${puzzle.name}" class="puzzle-overlay-bg-img">`;
        } else {
            html += '<span style="color:var(--text-secondary); font-size:14px; padding:40px; display:block;">No puzzle background set.</span>';
        }
        html += '<div class="puzzle-asset-layer" id="puzzle-asset-layer"></div>';
        html += '<canvas id="puzzle-ideogram-canvas" style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none;"></canvas>';
        html += '</div>';

        if (caption) {
            html += `<p class="puzzle-overlay-caption">${caption}</p>`;
        }

        // Play mode: Continue button (if any state has assets)
        const hasAssets = puzzle.states && puzzle.states.some(s => s.assets && s.assets.length > 0);
        if (puzzleOverlayMode === 'play' && hasAssets) {
            html += '<div class="puzzle-continue-wrap"><button class="panel-btn primary puzzle-continue-btn" id="puzzle-continue-btn">Solve</button></div>';
        }

        puzzleContent.innerHTML = html;
        puzzleOverlay.classList.remove('hidden');

        // Apply saved panel position
        const panel = puzzleOverlay.querySelector('.puzzle-overlay-panel');
        if (puzzle.panelPosition && panel) {
            panel.style.position = 'fixed';
            panel.style.left = puzzle.panelPosition.left + 'px';
            panel.style.top = puzzle.panelPosition.top + 'px';
            panel.style.margin = '0';
            panel.style.transform = 'none';
        }

        const assetLayer = document.getElementById('puzzle-asset-layer');
        const bgWrap = puzzleContent.querySelector('.puzzle-overlay-bg-wrap');
        const bgImg = puzzleContent.querySelector('.puzzle-overlay-bg-img');

        // Render assets after the image has loaded so the layer has correct dimensions
        function renderAfterLayout() {
            if (!assetLayer) return;
            if (puzzleOverlayMode === 'play') {
                PuzzleAssets.resetRuntime(puzzle);
            }
            PuzzleAssets.renderAssets(puzzle, assetLayer, puzzleOverlayMode === 'edit', stateIdx);

            if (puzzle.ideogramId) {
                const igCanvas = document.getElementById('puzzle-ideogram-canvas');
                if (igCanvas) {
                    IdeogramEditor.activateForPuzzle(igCanvas, puzzle.ideogramId, puzzleOverlayMode === 'edit', puzzle);
                }
            }
        }

        if (bgImg && !bgImg.complete) {
            bgImg.addEventListener('load', renderAfterLayout);
        } else {
            renderAfterLayout();
        }

        // Play mode: bind Solve button
        if (puzzleOverlayMode === 'play' && hasAssets) {
            const solveBtn = document.getElementById('puzzle-continue-btn');
            if (solveBtn) {
                solveBtn.addEventListener('click', () => {
                    const solved = PuzzleAssets.attemptSolve(puzzle);
                    if (solved) {
                        closePuzzleOverlay();
                    }
                });
            }
        }

        // Play mode: init puzzle hotspots (invisible, clickable)
        if (puzzleOverlayMode === 'play' && currentState && bgWrap) {
            const hotspotSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            hotspotSvg.setAttribute('class', 'puzzle-hotspot-svg');
            bgWrap.appendChild(hotspotSvg);
            PuzzleHotspotEditor.init(currentState, hotspotSvg, bgWrap, puzzleOverlay, false, puzzle);

            // Start loop animations after image loads
            const startLoops = () => LoopAnimator.startPuzzle(currentState.hotspots || [], bgWrap);
            if (bgImg && !bgImg.complete) {
                bgImg.addEventListener('load', startLoops);
            } else {
                startLoops();
            }
        }

        // Edit mode: create side tools panel
        if (puzzleOverlayMode === 'edit') {
            setupEditLayout(puzzle, assetLayer, bgWrap);
        }
    }

    function setupEditLayout(puzzle, assetLayer, bgWrap) {
        const panel = puzzleOverlay.querySelector('.puzzle-overlay-panel');

        // Add drag handle for panel positioning
        const dragHandle = document.createElement('div');
        dragHandle.style.cssText = 'cursor:grab; background:rgba(255,255,255,0.05); border-bottom:1px solid rgba(255,255,255,0.1); padding:4px 8px; font-size:10px; color:var(--text-secondary); text-align:center; user-select:none;';
        dragHandle.textContent = '\u22EE\u22EE Drag to position';
        panel.insertBefore(dragHandle, panel.firstChild);

        let panelDragState = null;
        dragHandle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            dragHandle.style.cursor = 'grabbing';
            const rect = panel.getBoundingClientRect();
            panelDragState = { startX: e.clientX, startY: e.clientY, startLeft: rect.left, startTop: rect.top };

            const onMove = (me) => {
                if (!panelDragState) return;
                const dx = me.clientX - panelDragState.startX;
                const dy = me.clientY - panelDragState.startY;
                panel.style.position = 'fixed';
                panel.style.left = (panelDragState.startLeft + dx) + 'px';
                panel.style.top = (panelDragState.startTop + dy) + 'px';
                panel.style.margin = '0';
                panel.style.transform = 'none';
            };

            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                dragHandle.style.cursor = 'grab';
                if (panelDragState) {
                    puzzle.panelPosition = {
                        left: parseInt(panel.style.left),
                        top: parseInt(panel.style.top)
                    };
                    panelDragState = null;
                }
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });

        // Create flex layout wrapper
        const layout = document.createElement('div');
        layout.className = 'puzzle-edit-layout';
        layout.id = 'puzzle-edit-layout';
        panel.parentNode.insertBefore(layout, panel);
        layout.appendChild(panel);

        // Create tools panel
        const tools = document.createElement('div');
        tools.className = 'puzzle-tools-panel';
        tools.id = 'puzzle-tools-panel';

        const assetTypes = PuzzleAssets.getAssetTypes();
        tools.innerHTML = `
            <div class="puzzle-tools-header">
                <span class="panel-label" style="font-size:11px;">Tools</span>
                <button class="puzzle-tools-toggle" id="puzzle-tools-toggle" title="Switch side">&#8644;</button>
            </div>
            <button class="panel-btn" id="puzzle-place-hotspot-btn" style="width:100%;">+ Hotspot</button>
            <div class="puzzle-hotspot-toolbar" id="puzzle-hotspot-toolbar">
                <button class="panel-btn" id="puzzle-hotspot-undo">Undo Point</button>
                <button class="panel-btn danger" id="puzzle-hotspot-delete">Delete</button>
            </div>
            ${assetTypes.length ? `
            <div class="puzzle-tools-divider"></div>
            <select class="panel-select" id="puzzle-asset-type-select">
                ${assetTypes.map(at => `<option value="${at.type}">${at.label}</option>`).join('')}
            </select>
            <button class="panel-btn primary" id="puzzle-place-asset-btn" style="width:100%;">+ Place</button>
            ` : ''}
            <div class="puzzle-tools-divider"></div>
            <span class="panel-label" style="font-size:11px;">Assets</span>
            <button class="panel-btn primary" id="puzzle-add-asset-btn" style="width:100%;">+ Add Asset</button>
            <input type="file" id="puzzle-asset-file-input" accept="image/png,image/*" style="display:none;">
            <div id="puzzle-asset-list"></div>
            <div class="puzzle-tools-divider"></div>
            <button class="panel-btn" id="puzzle-connect-btn" style="width:100%;">Connect</button>
            <div class="puzzle-connect-toolbar" id="puzzle-connect-toolbar">
                <input class="panel-input" id="puzzle-connect-name" placeholder="group_name">
                <button class="panel-btn primary" id="puzzle-connect-confirm" style="width:100%;" disabled>Confirm</button>
                <button class="panel-btn" id="puzzle-connect-cancel" style="width:100%;">Cancel</button>
            </div>
            <span id="puzzle-edit-status" class="panel-label" style="color:var(--text-secondary); font-size:11px; word-break:break-word;"></span>
            <div class="puzzle-tools-divider"></div>
            <button class="panel-btn" id="puzzle-reset-position-btn" style="width:100%;">Reset Position</button>
            <div class="puzzle-tools-divider"></div>
            <span class="panel-label" style="font-size:11px;">Ideogram</span>
            <select class="panel-select" id="puzzle-ideogram-select">
                <option value="">— None —</option>
                ${IdeogramEditor.getAllIdeograms().map(ig => `<option value="${ig.id}" ${puzzle.ideogramId === ig.id ? 'selected' : ''}>${ig.name || ig.id}</option>`).join('')}
            </select>
            <button class="panel-btn danger" id="puzzle-ideogram-clear" style="width:100%; ${puzzle.ideogramId ? '' : 'display:none;'}">Remove Ideogram</button>
            <div class="puzzle-tools-divider"></div>
            <div id="puzzle-state-widget"></div>
            <input type="file" id="puzzle-state-file-input" accept="image/*" style="display:none;">
        `;

        // Position based on side preference
        if (toolsPanelSide === 'left') tools.classList.add('left');
        layout.appendChild(tools);

        // Side toggle
        const toggleBtn = tools.querySelector('#puzzle-tools-toggle');
        toggleBtn.addEventListener('click', () => {
            toolsPanelSide = toolsPanelSide === 'right' ? 'left' : 'right';
            tools.classList.toggle('left', toolsPanelSide === 'left');
        });

        bindEditTools(tools, puzzle, assetLayer, bgWrap);
    }

    function renderPuzzleAssetList(puzzle, tools) {
        const container = tools.querySelector('#puzzle-asset-list');
        if (!container) return;
        const currentSt = PuzzleEditor.getCurrentState(puzzle);
        const assets = currentSt ? (currentSt.assets || []).filter(a => a.type === 'puzzle_asset') : [];
        if (assets.length === 0) {
            container.innerHTML = '';
            return;
        }
        const items = typeof InventoryEditor !== 'undefined' ? InventoryEditor.getAllItems() : [];
        container.innerHTML = assets.map(a => {
            const src = a.imageData || a.src;
            const linkedName = a.linkedItem ? (items.find(i => i.id === a.linkedItem) || {}).name || a.linkedItem : 'None';
            return `
            <div class="scene-card puzzle-asset-card" data-asset-id="${a.id}" style="padding:4px; margin-top:4px;">
                <div class="scene-thumb" style="width:32px; height:32px; flex-shrink:0;">
                    <img src="${src}" style="width:100%; height:100%; object-fit:contain;">
                </div>
                <div class="scene-card-info" style="min-width:0;">
                    <span class="scene-card-meta" style="font-size:10px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${a.name || 'asset'}</span>
                    <span class="scene-card-meta" style="font-size:9px; color:var(--text-secondary);">${linkedName}</span>
                </div>
                <button class="scene-card-delete puzzle-asset-delete" data-asset-id="${a.id}" title="Remove">&times;</button>
            </div>`;
        }).join('');

        container.querySelectorAll('.puzzle-asset-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const assetId = btn.dataset.assetId;
                if (!currentSt || !currentSt.assets) return;
                currentSt.assets = currentSt.assets.filter(a => a.id !== assetId);
                const assetLayer = document.querySelector('.puzzle-asset-layer');
                if (assetLayer) PuzzleAssets.renderAssets(puzzle, assetLayer, true);
                renderPuzzleAssetList(puzzle, tools);
            });
        });
    }

    function bindEditTools(tools, puzzle, assetLayer, bgWrap) {
        const placeBtn = tools.querySelector('#puzzle-place-asset-btn');
        const hotspotBtn = tools.querySelector('#puzzle-place-hotspot-btn');
        const typeSelect = tools.querySelector('#puzzle-asset-type-select');
        const statusEl = tools.querySelector('#puzzle-edit-status');
        const connectBtn = tools.querySelector('#puzzle-connect-btn');
        const connectToolbar = tools.querySelector('#puzzle-connect-toolbar');
        const connectName = tools.querySelector('#puzzle-connect-name');
        const connectConfirm = tools.querySelector('#puzzle-connect-confirm');
        const connectCancel = tools.querySelector('#puzzle-connect-cancel');
        const hotspotToolbar = tools.querySelector('#puzzle-hotspot-toolbar');
        const hotspotUndoBtn = tools.querySelector('#puzzle-hotspot-undo');
        const hotspotDeleteBtn = tools.querySelector('#puzzle-hotspot-delete');
        const ideogramSelect = tools.querySelector('#puzzle-ideogram-select');
        const ideogramClearBtn = tools.querySelector('#puzzle-ideogram-clear');

        const resetPosBtn = tools.querySelector('#puzzle-reset-position-btn');
        if (resetPosBtn) {
            resetPosBtn.addEventListener('click', () => {
                delete puzzle.panelPosition;
                const panel = puzzleOverlay.querySelector('.puzzle-overlay-panel');
                if (panel) {
                    panel.style.position = '';
                    panel.style.left = '';
                    panel.style.top = '';
                    panel.style.margin = '';
                    panel.style.transform = '';
                }
            });
        }

        // Refresh asset list when puzzle-assets.js deletes/modifies an asset
        PuzzleAssets.onChange = () => renderPuzzleAssetList(puzzle, tools);

        ideogramSelect.addEventListener('change', () => {
            IdeogramEditor.deactivateForPuzzle();
            puzzle.ideogramId = ideogramSelect.value || null;
            delete puzzle.ideogramState;
            if (puzzle.ideogramId) {
                const igCanvas = document.getElementById('puzzle-ideogram-canvas');
                if (igCanvas) {
                    IdeogramEditor.activateForPuzzle(igCanvas, puzzle.ideogramId, true, puzzle);
                }
            }
            ideogramClearBtn.style.display = puzzle.ideogramId ? '' : 'none';
        });

        ideogramClearBtn.addEventListener('click', () => {
            IdeogramEditor.deactivateForPuzzle();
            puzzle.ideogramId = null;
            delete puzzle.ideogramState;
            ideogramSelect.value = '';
            ideogramClearBtn.style.display = 'none';
            const igCanvas = document.getElementById('puzzle-ideogram-canvas');
            if (igCanvas) {
                const ctx = igCanvas.getContext('2d');
                ctx.clearRect(0, 0, igCanvas.width, igCanvas.height);
            }
        });

        // SVG layer for puzzle hotspots
        const hotspotSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        hotspotSvg.setAttribute('class', 'puzzle-hotspot-svg');
        if (bgWrap) bgWrap.appendChild(hotspotSvg);

        // Init puzzle hotspot editor
        const currentSt = PuzzleEditor.getCurrentState(puzzle);
        if (currentSt) {
            PuzzleHotspotEditor.init(currentSt, hotspotSvg, bgWrap, puzzleOverlay, true, puzzle);
        }

        // Hotspot toolbar buttons
        hotspotUndoBtn.addEventListener('click', () => PuzzleHotspotEditor.undoPoint());
        hotspotDeleteBtn.addEventListener('click', () => PuzzleHotspotEditor.deleteSelected());

        // Image asset pending data
        let pendingAssetData = null;

        // Ghost placement preview
        let ghostEl = null;

        function removeGhost() {
            if (ghostEl) { ghostEl.remove(); ghostEl = null; }
            if (bgWrap) bgWrap.style.cursor = '';
        }

        function createGhost(type) {
            removeGhost();
            const html = PuzzleAssets.renderPreview(type);
            if (!html) return;
            ghostEl = document.createElement('div');
            ghostEl.className = 'puzzle-asset edit-mode puzzle-ghost';
            ghostEl.innerHTML = html;
            assetLayer.appendChild(ghostEl);
            if (bgWrap) bgWrap.style.cursor = 'none';
        }

        if (bgWrap) {
            bgWrap.addEventListener('mousemove', (e) => {
                if (!ghostEl) return;
                const imgEl = bgWrap.querySelector('.puzzle-overlay-bg-img');
                const ref = imgEl || assetLayer;
                const refRect = ref.getBoundingClientRect();
                const x = e.clientX - refRect.left;
                const y = e.clientY - refRect.top;
                ghostEl.style.left = x + 'px';
                ghostEl.style.top = y + 'px';
                ghostEl.style.display = 'block';
            });

            bgWrap.addEventListener('mouseleave', () => {
                if (ghostEl) ghostEl.style.display = 'none';
            });

            bgWrap.addEventListener('mouseenter', () => {
                if (ghostEl) ghostEl.style.display = 'block';
            });
        }

        // Hotspot drawing
        hotspotBtn.addEventListener('click', () => {
            if (PuzzleAssets.isConnecting()) {
                PuzzleAssets.stopConnecting();
                connectBtn.classList.remove('active');
                connectToolbar.classList.remove('active');
            }
            PuzzleAssets.stopPlacing();
            removeGhost();
            if (placeBtn) placeBtn.classList.remove('active');
            PuzzleHotspotEditor.startDrawing();
            statusEl.textContent = 'Click to place points. Double-click to close.';
            hotspotBtn.classList.add('active');
            hotspotToolbar.classList.add('active');
        });

        // Place puzzle asset (combo lock, terminal, etc.)
        if (placeBtn && typeSelect) {
            placeBtn.addEventListener('click', () => {
                if (PuzzleAssets.isConnecting()) {
                    PuzzleAssets.stopConnecting();
                    connectBtn.classList.remove('active');
                    connectToolbar.classList.remove('active');
                }
                PuzzleHotspotEditor.stopDrawing();
                hotspotToolbar.classList.remove('active');
                hotspotBtn.classList.remove('active');
                PuzzleAssets.startPlacing(typeSelect.value);
                statusEl.textContent = 'Click to place...';
                placeBtn.classList.add('active');
                createGhost(typeSelect.value);
            });
        }

        // Placement click on bg-wrap (asset placement only, hotspot clicks handled by PuzzleHotspotEditor)
        if (bgWrap && assetLayer) {
            bgWrap.addEventListener('click', (e) => {
                // If hotspot drawing just finished, clean up UI
                if (!PuzzleHotspotEditor.isDrawing() && hotspotToolbar.classList.contains('active')) {
                    hotspotToolbar.classList.remove('active');
                    hotspotBtn.classList.remove('active');
                    statusEl.textContent = '';
                }

                if (!PuzzleAssets.isPlacing()) return;
                if (e.target.closest('.puzzle-asset') || e.target.closest('.puzzle-asset-popover')) return;

                const imgEl = bgWrap.querySelector('.puzzle-overlay-bg-img');
                const ref = imgEl || assetLayer;
                const refRect = ref.getBoundingClientRect();
                const x = e.clientX - refRect.left;
                const y = e.clientY - refRect.top;

                const currentSt = PuzzleEditor.getCurrentState(puzzle);
                if (!currentSt) return;
                if (!currentSt.assets) currentSt.assets = [];
                const placingType = PuzzleAssets.getPlacingType();
                const asset = placingType === 'puzzle_asset'
                    ? PuzzleAssets.createAsset('puzzle_asset', x, y, pendingAssetData)
                    : PuzzleAssets.createAsset(typeSelect ? typeSelect.value : placingType, x, y);
                if (asset) {
                    currentSt.assets.push(asset);
                    PuzzleAssets.stopPlacing();
                    PuzzleAssets.renderAssets(puzzle, assetLayer, true);
                    renderPuzzleAssetList(puzzle, tools);
                }

                pendingAssetData = null;
                removeGhost();
                statusEl.textContent = '';
                if (placeBtn) placeBtn.classList.remove('active');
            });
        }

        // Add asset
        const addAssetBtn = tools.querySelector('#puzzle-add-asset-btn');
        const assetFileInput = tools.querySelector('#puzzle-asset-file-input');
        if (addAssetBtn && assetFileInput) {
            addAssetBtn.addEventListener('click', () => assetFileInput.click());
            assetFileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const url = URL.createObjectURL(file);
                const img = new Image();
                img.onload = () => {
                    pendingAssetData = {
                        name: file.name.replace(/\.[^.]+$/, ''),
                        src: 'assets/puzzles/pieces/' + file.name,
                        imageData: url,
                        width: img.naturalWidth,
                        height: img.naturalHeight
                    };
                    // Enter placement mode
                    PuzzleHotspotEditor.stopDrawing();
                    hotspotToolbar.classList.remove('active');
                    hotspotBtn.classList.remove('active');
                    PuzzleAssets.startPlacing('puzzle_asset');
                    statusEl.textContent = 'Click to place image...';

                    // Create image ghost
                    removeGhost();
                    ghostEl = document.createElement('div');
                    ghostEl.className = 'puzzle-asset edit-mode puzzle-ghost';
                    ghostEl.innerHTML = `<img src="${url}" style="width:${img.naturalWidth}px; height:${img.naturalHeight}px; display:block; pointer-events:none; opacity:0.6;" draggable="false">`;
                    assetLayer.appendChild(ghostEl);
                    if (bgWrap) bgWrap.style.cursor = 'none';
                };
                img.src = url;
                assetFileInput.value = '';
            });
        }

        // Render asset list in tools panel
        renderPuzzleAssetList(puzzle, tools);

        // Connect mode
        function updateConnectConfirm() {
            connectConfirm.disabled = connectName.value.trim().length === 0;
        }

        connectName.addEventListener('input', updateConnectConfirm);

        connectBtn.addEventListener('click', () => {
            if (PuzzleAssets.isConnecting()) {
                PuzzleAssets.stopConnecting();
                connectBtn.classList.remove('active');
                connectToolbar.classList.remove('active');
                statusEl.textContent = '';
            } else {
                PuzzleAssets.stopPlacing();
                PuzzleHotspotEditor.stopDrawing();
                PuzzleHotspotEditor.render();
                hotspotToolbar.classList.remove('active');
                hotspotBtn.classList.remove('active');
                if (placeBtn) placeBtn.classList.remove('active');
                removeGhost();
                PuzzleAssets.startConnecting();
                connectBtn.classList.add('active');
                connectToolbar.classList.add('active');
                statusEl.textContent = 'Click assets to connect...';
                connectName.value = '';
                updateConnectConfirm();

                const observer = setInterval(() => {
                    if (!PuzzleAssets.isConnecting()) {
                        clearInterval(observer);
                        return;
                    }
                    updateConnectConfirm();
                }, 200);
            }
        });

        connectConfirm.addEventListener('click', () => {
            const name = connectName.value.trim();
            if (!name) {
                statusEl.textContent = 'Enter a group name.';
                connectName.focus();
                return;
            }
            if (PuzzleAssets.getConnectSelection().size < 2) {
                statusEl.textContent = 'Select at least 2 assets.';
                return;
            }
            PuzzleAssets.createGroup(name, puzzle);
            connectBtn.classList.remove('active');
            connectToolbar.classList.remove('active');
            statusEl.textContent = '';
            PuzzleAssets.renderAssets(puzzle, assetLayer, true);
        });

        connectCancel.addEventListener('click', () => {
            PuzzleAssets.stopConnecting();
            connectBtn.classList.remove('active');
            connectToolbar.classList.remove('active');
            statusEl.textContent = '';
        });

        // State widget (scene-card style)
        const stateWidget = tools.querySelector('#puzzle-state-widget');
        const stateFileInput = tools.querySelector('#puzzle-state-file-input');

        function renderStateWidget() {
            const stateIdx = puzzle.editingStateIndex || 0;
            const stateCount = puzzle.states ? puzzle.states.length : 1;
            const currentSt = puzzle.states ? (puzzle.states[stateIdx] || puzzle.states[0]) : null;
            const bgSrc = currentSt ? currentSt.backgroundImage : null;
            const assetCount = currentSt ? (currentSt.assets || []).length : 0;

            stateWidget.innerHTML = `
                <div class="scene-card puzzle-state-card-widget">
                    <div class="scene-thumb">
                        ${bgSrc ? `<img src="${bgSrc}" alt="${bgSrc.split('/').pop() || ('State ' + (stateIdx + 1))}" draggable="false">` : '<span class="scene-thumb-empty">No bg</span>'}
                    </div>
                    <div class="scene-card-info">
                        <span class="scene-card-meta">${assetCount} asset${assetCount !== 1 ? 's' : ''}${stateCount > 1 ? ' &middot; ' + (bgSrc ? bgSrc.split('/').pop() : 'State ' + (stateIdx + 1)) + ' (' + (stateIdx + 1) + '/' + stateCount + ')' : ''}</span>
                        ${stateCount > 1 ? `
                        <div class="scene-state-nav">
                            <button class="scene-state-btn puzzle-state-prev" title="Previous state">&larr;</button>
                            <button class="scene-state-btn puzzle-state-next" title="Next state">&rarr;</button>
                            <button class="scene-state-btn puzzle-state-remove-btn" title="Remove this state">&times;</button>
                        </div>` : ''}
                    </div>
                    <div class="scene-card-actions">
                        <button class="scene-card-add-state puzzle-state-add-btn" title="Add state">+State</button>
                    </div>
                </div>`;

            // +State
            const addBtn = stateWidget.querySelector('.puzzle-state-add-btn');
            if (addBtn) {
                addBtn.addEventListener('click', () => stateFileInput.click());
            }

            // Prev
            const prevBtn = stateWidget.querySelector('.puzzle-state-prev');
            if (prevBtn) {
                prevBtn.addEventListener('click', () => {
                    const idx = (puzzle.editingStateIndex || 0) - 1;
                    if (idx >= 0) switchPuzzleEditState(idx);
                });
            }

            // Next
            const nextBtn = stateWidget.querySelector('.puzzle-state-next');
            if (nextBtn) {
                nextBtn.addEventListener('click', () => {
                    const idx = (puzzle.editingStateIndex || 0) + 1;
                    if (idx < puzzle.states.length) switchPuzzleEditState(idx);
                });
            }

            // Remove
            const removeBtn = stateWidget.querySelector('.puzzle-state-remove-btn');
            if (removeBtn) {
                removeBtn.addEventListener('click', () => {
                    if (puzzle.states.length <= 1) return;
                    PuzzleEditor.removeState(puzzle.id, puzzle.editingStateIndex || 0);
                    switchPuzzleEditState(puzzle.editingStateIndex || 0);
                });
            }
        }

        function switchPuzzleEditState(newIdx) {
            PuzzleEditor.setEditingState(puzzle.id, newIdx);
            const st = puzzle.states[newIdx];
            // Update background image
            const bgImg = puzzleContent.querySelector('.puzzle-overlay-bg-img');
            if (bgImg && st) {
                bgImg.src = st.backgroundImage || '';
            }
            // Re-render assets for this state
            PuzzleAssets.renderAssets(puzzle, assetLayer, true, newIdx);
            // Re-init hotspot editor for new state
            if (st) PuzzleHotspotEditor.init(st, hotspotSvg, bgWrap, puzzleOverlay, true, puzzle);
            renderStateWidget();
            renderPuzzleAssetList(puzzle, tools);
        }

        stateFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            PuzzleEditor.addState(puzzle.id, 'assets/puzzles/' + file.name);
            switchPuzzleEditState(puzzle.editingStateIndex);
            stateFileInput.value = '';
        });

        renderStateWidget();
    }

    function closePuzzleOverlay() {
        IdeogramEditor.deactivateForPuzzle();
        AudioManager.stopSounds();
        LoopAnimator.stopPuzzle();
        TransitionPlayer.cancel();

        // Remove drag handles and group connection lines before close animation
        const panelEl = puzzleOverlay.querySelector('.puzzle-overlay-panel');
        if (panelEl) {
            panelEl.querySelectorAll('div').forEach(el => {
                if (el.textContent.includes('Drag to position')) el.remove();
            });
        }
        // Restore panel from edit layout wrapper
        const layout = document.getElementById('puzzle-edit-layout');
        if (layout) {
            const panel = layout.querySelector('.puzzle-overlay-panel');
            if (panel) puzzleOverlay.appendChild(panel);
            layout.remove();
        }

        // Remove group connection lines before close animation
        const groupLines = puzzleOverlay.querySelector('.puzzle-group-lines');
        if (groupLines) groupLines.remove();

        // Animate close: shrink panel + fade backdrop
        const backdrop = puzzleOverlay.querySelector('.puzzle-overlay-backdrop');
        const panel = puzzleOverlay.querySelector('.puzzle-overlay-panel');

        if (backdrop) backdrop.classList.add('closing');
        if (panel) panel.classList.add('closing');

        const duration = 300; // match CSS animation duration
        setTimeout(() => {
            puzzleOverlay.classList.add('hidden');
            if (backdrop) backdrop.classList.remove('closing');
            if (panel) {
                panel.classList.remove('closing');
                // Reset positioning styles after animation completes
                panel.style.position = '';
                panel.style.left = '';
                panel.style.top = '';
                panel.style.margin = '';
                panel.style.transform = '';
            }
        }, duration);

        PuzzleAssets.closeAssetPopover();
        PuzzleAssets.stopPlacing();
        PuzzleAssets.stopConnecting();
        PuzzleHotspotEditor.cleanup();
        activePuzzleHotspot = null;
        activePuzzleRef = null;
    }

    // -- Dialogue --

    function createDialogueBox() {
        if (dialogueEl) dialogueEl.remove();
        dialogueEl = document.createElement('div');
        dialogueEl.className = 'dialogue-box dialogue-hidden';
        dialogueEl.addEventListener('click', () => {
            if (!typewriterDone) {
                if (typewriterInterval) { clearInterval(typewriterInterval); typewriterInterval = null; }
                dialogueEl.textContent = dialogueEl.dataset.fullText || '';
                typewriterDone = true;
                return;
            }
            dismissDialogue();
        });
        document.body.appendChild(dialogueEl);
    }

    function showDialogue(text, duration) {
        if (!dialogueEl) return;
        displayDialogue(text, duration);
    }

    function displayDialogue(text, duration) {
        if (dialogueTimer) { clearTimeout(dialogueTimer); dialogueTimer = null; }
        if (typewriterInterval) { clearInterval(typewriterInterval); typewriterInterval = null; }

        const autoDismiss = duration || 10000;
        dialogueEl.dataset.fullText = text;
        dialogueEl.textContent = '';
        typewriterDone = false;
        dialogueEl.classList.remove('dialogue-hidden');

        let i = 0;
        typewriterInterval = setInterval(() => {
            if (i < text.length) {
                dialogueEl.textContent += text[i];
                i++;
            } else {
                clearInterval(typewriterInterval);
                typewriterInterval = null;
                typewriterDone = true;
            }
        }, 30);

        dialogueTimer = setTimeout(() => {
            dismissDialogue();
        }, autoDismiss);
    }

    function dismissDialogue() {
        if (!dialogueEl) return;
        if (dialogueTimer) { clearTimeout(dialogueTimer); dialogueTimer = null; }
        if (typewriterInterval) { clearInterval(typewriterInterval); typewriterInterval = null; }
        dialogueEl.classList.add('dialogue-hidden');
    }

    // -- Sibling hotspot helpers --

    function getHotspotBBox(hotspot) {
        const xs = hotspot.points.map(p => p[0]);
        const ys = hotspot.points.map(p => p[1]);
        return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
    }

    function bboxOverlap(a, b) {
        return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
    }

    // -- Cursor helpers --

    function getItemCursor(itemId) {
        if (itemCursorCache[itemId]) return itemCursorCache[itemId];
        const item = InventoryEditor.getItem(itemId);
        if (!item || !item.image) {
            itemCursorCache[itemId] = 'grab';
            return 'grab';
        }
        // Try using preloaded image first
        const preloaded = Preloader.getImage(item.image);
        if (preloaded) {
            const c = document.createElement('canvas');
            c.width = 32; c.height = 32;
            c.getContext('2d').drawImage(preloaded, 0, 0, 32, 32);
            itemCursorCache[itemId] = `url(${c.toDataURL()}) 16 16, auto`;
            return itemCursorCache[itemId];
        }
        // Fallback: load async and cache when ready
        const img = new Image();
        img.onload = () => {
            const c = document.createElement('canvas');
            c.width = 32; c.height = 32;
            c.getContext('2d').drawImage(img, 0, 0, 32, 32);
            itemCursorCache[itemId] = `url(${c.toDataURL()}) 16 16, auto`;
        };
        img.src = item.image;
        return 'grab';
    }

    function getActionCursor(hotspot) {
        if (selectedItem) return getItemCursor(selectedItem);
        if (!hotspot) return 'default';
        return 'grab';
    }

    // -- Hover handling --

    function handleMouseMove(e) {
        if (!active) return;

        // Pick mode intercept
        if (pickMode) {
            handlePickMouseMove(e);
            return;
        }

        const rect = Canvas.getCanvasElement().getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const img = Canvas.screenToImage(sx, sy);

        const hit = HotspotEditor.hitTest(img.x, img.y);
        hoveredHotspot = (hit && !GameState.isHotspotCleared(hit.id)) ? hit : null;
        Canvas.getCanvasElement().style.cursor = getActionCursor(hoveredHotspot);
    }

    function getHoveredHotspot() {
        return hoveredHotspot;
    }

    function fadeCanvasTransition(onDone, duration) {
        const halfDur = (duration || 500) / 2;
        const canvasEl = Canvas.getCanvasElement();
        const ctx = Canvas.getContext();
        let start = null;
        let phase = 'out'; // fade out, then swap, then fade in

        function step(ts) {
            if (!start) start = ts;
            const elapsed = ts - start;

            if (phase === 'out') {
                const t = Math.min(elapsed / halfDur, 1);
                Canvas.render();
                ctx.save();
                ctx.fillStyle = `rgba(0,0,0,${t})`;
                ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);
                ctx.restore();
                if (t >= 1) {
                    onDone();
                    phase = 'in';
                    start = null;
                    requestAnimationFrame(step);
                    return;
                }
            } else {
                const t = Math.min(elapsed / halfDur, 1);
                Canvas.render();
                ctx.save();
                ctx.fillStyle = `rgba(0,0,0,${1 - t})`;
                ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);
                ctx.restore();
                if (t >= 1) return;
            }
            requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }

    // -- Pick Mode (Move Asset) --

    function enterPickMode(hotspot, assetId, targets) {
        pickMode = { hotspot, assetId, targets };
        Canvas.setPickModeTargets(targets);
        Canvas.getCanvasElement().classList.add('pick-mode-cursor');
    }

    function exitPickMode() {
        pickMode = null;
        Canvas.clearPickModeTargets();
        Canvas.clearPickGhost();
        Canvas.getCanvasElement().classList.remove('pick-mode-cursor');
        Canvas.getCanvasElement().style.cursor = 'default';
    }

    function handlePickMouseMove(e) {
        if (!pickMode) return;
        const rect = Canvas.getCanvasElement().getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const img = Canvas.screenToImage(sx, sy);

        const scene = SceneManager.getCurrentScene();
        if (!scene) return;

        let found = null;
        for (const target of pickMode.targets) {
            if (HotspotEditor.pointInPolygon(img.x, img.y, target.points)) {
                found = target;
                break;
            }
        }

        if (found) {
            const asset = (scene.sceneAssets || []).find(a => a.id === pickMode.assetId);
            if (asset) {
                const pos = Canvas.getAssetStatePos(asset, found.stateIdx);
                Canvas.setPickGhost(pickMode.assetId, pos);
            }
            Canvas.getCanvasElement().style.cursor = 'pointer';
        } else {
            Canvas.clearPickGhost();
            Canvas.getCanvasElement().style.cursor = '';
        }
    }

    function handlePickClick(e) {
        if (!pickMode) return;
        const rect = Canvas.getCanvasElement().getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const img = Canvas.screenToImage(sx, sy);

        const scene = SceneManager.getCurrentScene();
        if (!scene) return;

        let found = null;
        for (const target of pickMode.targets) {
            if (HotspotEditor.pointInPolygon(img.x, img.y, target.points)) {
                found = target;
                break;
            }
        }

        if (!found) {
            // Clicked outside any target — cancel and restore asset to its position
            const cancelAssetId = pickMode.assetId;
            const cancelHotspot = pickMode.hotspot;
            exitPickMode();
            GameState.restoreAsset(cancelAssetId);
            if (cancelHotspot && cancelHotspot.clearAfterClick) {
                GameState.restoreHotspot(cancelHotspot.id);
            }
            Canvas.fadeAsset(cancelAssetId, 0, 1, 400);
            return;
        }

        const assetId = pickMode.assetId;
        const sourceHotspot = pickMode.hotspot;
        const asset = (scene.sceneAssets || []).find(a => a.id === assetId);
        if (!asset) { exitPickMode(); return; }

        const targetPos = Canvas.getAssetStatePos(asset, found.stateIdx);
        exitPickMode();

        // Restore asset (assetChange may have marked it removed), set new position
        GameState.restoreAsset(assetId);
        GameState.setAssetPosition(assetId, { ...targetPos });

        // Preserve positions of non-move assets before state change
        const currentStateIdx = GameState.getSceneState(scene.id);
        for (const a of (scene.sceneAssets || [])) {
            if (a.id === assetId) continue;
            if (GameState.isAssetRemoved(a.id)) continue;
            if (!GameState.getAssetPosition(a.id)) {
                const curPos = Canvas.getAssetStatePos(a, currentStateIdx);
                GameState.setAssetPosition(a.id, { ...curPos });
            }
        }

        // Switch scene state to target so that state's hotspot becomes active
        GameState.setSceneState(scene.id, found.stateIdx);
        const targetState = SceneManager.getState(scene, found.stateIdx);
        if (targetState && targetState.backgroundData) {
            Canvas.loadImage(targetState.backgroundData);
        }

        // Un-clear all connected hotspots so they can be used again
        const connections = SceneManager.getConnectionsForHotspot(scene.id, sourceHotspot.id);
        for (const conn of connections) {
            for (const hId of conn.hotspotIds) {
                GameState.restoreHotspot(hId);
            }
        }

        Canvas.fadeAsset(assetId, 0, 1, 400);
    }

    // -- Click handling --

    function handleClick(e) {
        if (!active) return;

        // Close radial wheel if open
        if (wheelOpen) {
            selectedItem = null;
            Canvas.getCanvasElement().style.cursor = 'default';
            closeRadialWheel();
            return;
        }

        // Pick mode intercept
        if (pickMode) {
            handlePickClick(e);
            return;
        }

        const rect = Canvas.getCanvasElement().getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const img = Canvas.screenToImage(sx, sy);

        const hotspot = HotspotEditor.hitTest(img.x, img.y);
        if (!hotspot || GameState.isHotspotCleared(hotspot.id)) {
            // Check for linked-item asset pickup
            const asset = Canvas.hitAssetPlay(sx, sy);
            if (asset && asset.linkedItem) {
                GameState.addToInventory(asset.linkedItem);
                const item = InventoryEditor.getItem(asset.linkedItem);
                const itemName = item ? item.name : asset.linkedItem.replace(/_\d+$/, '').replace(/_/g, ' ');
                if (asset.transition === 'fade') {
                    Canvas.fadeAsset(asset.id, 1, 0, 400, () => {
                        GameState.removeAsset(asset.id);
                        Canvas.render();
                    });
                } else {
                    GameState.removeAsset(asset.id);
                    Canvas.render();
                }
                showDialogue(`Picked up: ${itemName}`, 3000);
                renderInventory();
            }
            return;
        }

        // Check conditions
        if (!GameState.checkFlags(hotspot.requires)) {
            showDialogue("Something needs to happen first...");
            return;
        }

        // Play sound effect if set
        if (hotspot.sound) AudioManager.playSound(hotspot.sound, hotspot.soundLoop);

        // Auto-set the flag for this action
        const autoFlag = GameState.getAutoFlag(hotspot);

        // Execute action
        let actionSucceeded = true;
        const action = hotspot.action;
        switch (action.type) {
            case 'none':
                if (autoFlag) GameState.setFlag(autoFlag);
                break;

            case 'clue': {
                const clueDuration = (hotspot.moveAsset && hotspot.moveAsset.assetId) ? 3000 : undefined;
                if (action.clueId) {
                    const clue = PuzzleEditor.getPuzzle(action.clueId);
                    if (clue) {
                        openPuzzleOverlay(clue, hotspot, action.text || clue.completionText);
                    } else {
                        if (action.text) showDialogue(action.text, clueDuration);
                    }
                } else {
                    if (action.text) showDialogue(action.text, clueDuration);
                }
            }
                if (autoFlag) GameState.setFlag(autoFlag);
                break;

            case 'navigate':
                if (action.target) {
                    if (autoFlag) GameState.setFlag(autoFlag);
                    AudioManager.stopSounds();
                    LoopAnimator.stop();
                    SceneManager.switchScene(action.target);
                    LoopAnimator.startScene(HotspotEditor.getHotspots());
                    const targetScene = SceneManager.getScene(action.target);
                    if (targetScene) AudioManager.playMusic(targetScene.music);
                }
                break;

            case 'pickup':
                if (action.itemId) {
                    GameState.addToInventory(action.itemId);
                    if (autoFlag) GameState.setFlag(autoFlag);
                    const item = InventoryEditor.getItem(action.itemId);
                    const itemName = item ? item.name : action.itemId.replace(/_\d+$/, '').replace(/_/g, ' ');
                    showDialogue(`Picked up: ${itemName}`, 3000);
                } else {
                    actionSucceeded = false;
                }
                break;

            case 'accepts_item':
                if (selectedItem && selectedItem === action.requiredItemId) {
                    const usedItem = InventoryEditor.getItem(selectedItem);
                    GameState.useItem(selectedItem);
                    if (autoFlag) GameState.setFlag(autoFlag);
                    selectedItem = null;
                    Canvas.getCanvasElement().style.cursor = getActionCursor(hotspot);
                    if (action.onAccept && action.onAccept.type !== 'none') {
                        switch (action.onAccept.type) {
                            case 'clue':
                                if (action.onAccept.text) showDialogue(action.onAccept.text);
                                else showDialogue(`Used ${usedItem ? usedItem.name : 'the item'}.`, 3000);
                                break;
                            case 'navigate':
                                if (action.onAccept.target) {
                                    AudioManager.stopSounds();
                                    LoopAnimator.stop();
                                    SceneManager.switchScene(action.onAccept.target);
                                    LoopAnimator.startScene(HotspotEditor.getHotspots());
                                    const targetScene = SceneManager.getScene(action.onAccept.target);
                                    if (targetScene) AudioManager.playMusic(targetScene.music);
                                }
                                break;
                            case 'pickup':
                                if (action.onAccept.itemId) {
                                    GameState.addToInventory(action.onAccept.itemId);
                                    const ri = InventoryEditor.getItem(action.onAccept.itemId);
                                    showDialogue(`Picked up: ${ri ? ri.name : action.onAccept.itemId}`, 3000);
                                }
                                break;
                            case 'puzzle':
                                if (action.onAccept.puzzleId) {
                                    const pz = PuzzleEditor.getPuzzle(action.onAccept.puzzleId);
                                    if (pz) openPuzzleOverlay(pz, hotspot);
                                }
                                break;
                        }
                    } else {
                        showDialogue(`Used ${usedItem ? usedItem.name : 'the item'}.`, 3000);
                    }
                } else {
                    actionSucceeded = false;
                    showDialogue("That didn't work", 3000);
                }
                break;

            case 'puzzle':
                if (action.puzzleId) {
                    const puzzle = PuzzleEditor.getPuzzle(action.puzzleId);
                    if (puzzle) {
                        openPuzzleOverlay(puzzle, hotspot);
                    } else {
                        showDialogue('Puzzle not found.');
                    }
                }
                break;
        }

        // Asset changes — hide or show scene/puzzle assets
        const acList = hotspot.assetChanges || (hotspot.assetChange ? [hotspot.assetChange] : []);
        if (actionSucceeded && acList.length > 0) {
            const scene = SceneManager.getCurrentScene();
            for (const ac of acList) {
                if (!ac.assetId) continue;
                const acMode = ac.mode || 'hide';
                const acId = ac.assetId;
                const acAsset = scene ? (scene.sceneAssets || []).find(a => a.id === acId) : null;

                if (acAsset && acAsset.transition === 'fade') {
                    if (acMode === 'show') {
                        GameState.restoreAsset(acId);
                        Canvas.fadeAsset(acId, 0, 1, 500);
                    } else {
                        Canvas.fadeAsset(acId, 1, 0, 500, () => {
                            GameState.removeAsset(acId);
                            Canvas.render();
                        });
                    }
                } else {
                    if (acMode === 'show') {
                        GameState.restoreAsset(acId);
                    } else {
                        GameState.removeAsset(acId);
                    }
                    Canvas.render();
                }
            }
        }

        // Scene state change — only fires if the action succeeded
        if (actionSucceeded && hotspot.stateChange && hotspot.stateChange.stateIndex != null) {
            const scene = SceneManager.getCurrentScene();
            if (scene && GameState.getSceneState(scene.id) !== hotspot.stateChange.stateIndex) {
                const sc = hotspot.stateChange;
                LoopAnimator.stop();
                const onDone = () => {
                    GameState.setSceneState(scene.id, sc.stateIndex);
                    const targetState = SceneManager.getState(scene, sc.stateIndex);
                    if (targetState && targetState.backgroundData) {
                        Canvas.loadImage(targetState.backgroundData).then(() => {
                            LoopAnimator.startScene(HotspotEditor.getHotspots());
                        });
                    }
                };
                if (sc.video) {
                    TransitionPlayer.playVideo(sc.video, { target: 'canvas' }).then(onDone);
                } else if (sc.frames && sc.frames.length > 0) {
                    const playFrames = sc.reverse ? sc.frames.slice().reverse() : sc.frames;
                    TransitionPlayer.play(playFrames, {
                        frameDuration: sc.frameDuration || 100,
                        target: 'canvas'
                    }).then(onDone);
                } else if (sc.effect === 'fade') {
                    fadeCanvasTransition(onDone);
                } else {
                    onDone();
                }
            }
        }

        // Clear hotspot after click
        if (actionSucceeded && hotspot.clearAfterClick) {
            GameState.clearHotspot(hotspot.id);
        }

        // Clear sibling hotspots (same item OR same assetChange target, spatially touching)
        if (actionSucceeded && hotspot.clearGroup) {
            const scene = SceneManager.getCurrentScene();
            if (scene) {
                const srcBBox = getHotspotBBox(hotspot);
                const srcItemId = action.type === 'pickup' ? action.itemId : null;
                const srcAssetIds = (hotspot.assetChanges || (hotspot.assetChange ? [hotspot.assetChange] : [])).map(a => a.assetId).filter(Boolean);
                for (const state of scene.states) {
                    for (const hs of (state.hotspots || [])) {
                        if (hs.id === hotspot.id) continue;
                        const sameItem = srcItemId && hs.action && hs.action.type === 'pickup' && hs.action.itemId === srcItemId;
                        const hsAssetIds = (hs.assetChanges || (hs.assetChange ? [hs.assetChange] : [])).map(a => a.assetId).filter(Boolean);
                        const sameAsset = srcAssetIds.length > 0 && hsAssetIds.some(id => srcAssetIds.includes(id));
                        if ((sameItem || sameAsset) && bboxOverlap(srcBBox, getHotspotBBox(hs))) {
                            GameState.clearHotspot(hs.id);
                            for (const hsAc of (hs.assetChanges || (hs.assetChange ? [hs.assetChange] : []))) {
                                if (hsAc.assetId && (hsAc.mode || 'hide') === 'hide') {
                                    GameState.removeAsset(hsAc.assetId);
                                }
                            }
                        }
                    }
                }
            }
        }

        // Move asset — enter pick mode
        if (actionSucceeded && hotspot.moveAsset && hotspot.moveAsset.assetId) {
            const scene = SceneManager.getCurrentScene();
            if (scene) {
                const connections = SceneManager.getConnectionsForHotspot(scene.id, hotspot.id);
                if (connections.length > 0) {
                    const targets = [];
                    for (const conn of connections) {
                        for (const hId of conn.hotspotIds) {
                            if (hId === hotspot.id) continue;
                            for (let si = 0; si < scene.states.length; si++) {
                                const hs = (scene.states[si].hotspots || []).find(h => h.id === hId);
                                if (hs) {
                                    targets.push({ hotspotId: hId, stateIdx: si, points: hs.points });
                                }
                            }
                        }
                    }
                    if (targets.length > 0) {
                        enterPickMode(hotspot, hotspot.moveAsset.assetId, targets);
                    }
                }
            }
        }
    }

    function handleContextMenu(e) {
        if (!active) return;
        e.preventDefault();
        if (pickMode) return;
        if (wheelOpen) {
            selectedItem = null;
            Canvas.getCanvasElement().style.cursor = 'default';
            closeRadialWheel();
            return;
        }
        openRadialWheel(e.clientX, e.clientY);
    }

    function bindCanvas() {
        const el = Canvas.getCanvasElement();
        el.addEventListener('click', handleClick);
        el.addEventListener('mousemove', handleMouseMove);
        el.addEventListener('contextmenu', handleContextMenu);
    }

    function unbindCanvas() {
        const el = Canvas.getCanvasElement();
        el.removeEventListener('click', handleClick);
        el.removeEventListener('mousemove', handleMouseMove);
        el.removeEventListener('contextmenu', handleContextMenu);
        hoveredHotspot = null;
        el.style.cursor = 'default';
    }

    // -- Init listeners for overlay buttons --
    function init() {
        inventoryBtn.addEventListener('click', () => {
            if (overlay.classList.contains('hidden')) {
                openInventoryOverlay();
            } else {
                closeInventoryOverlay();
            }
        });

        overlayClose.addEventListener('click', closeInventoryOverlay);

        overlay.querySelector('.inventory-overlay-backdrop').addEventListener('click', closeInventoryOverlay);

        puzzleClose.addEventListener('click', closePuzzleOverlay);
        puzzleOverlay.querySelector('.puzzle-overlay-backdrop').addEventListener('click', closePuzzleOverlay);

        hintBtn.addEventListener('click', () => {
            if (!active) return;
            const hint = GameState.getNextHint();
            if (hint) {
                showDialogue(hint);
            } else {
                showDialogue('No more hints — you\'ve done everything!');
            }
        });

        // Radial wheel: click outside items to dismiss + deselect
        radialWheel.addEventListener('click', (e) => {
            if (!e.target.closest('.radial-wheel-item')) {
                selectedItem = null;
                Canvas.getCanvasElement().style.cursor = 'default';
                closeRadialWheel();
            }
        });
        radialWheel.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            selectedItem = null;
            Canvas.getCanvasElement().style.cursor = 'default';
            closeRadialWheel();
        });

        // Right-click in puzzle overlay opens radial wheel
        puzzleOverlay.addEventListener('contextmenu', (e) => {
            if (!active) return;
            e.preventDefault();
            if (wheelOpen) {
                closeRadialWheel();
                return;
            }
            openRadialWheel(e.clientX, e.clientY);
        });
    }

    function isPickMode() {
        return pickMode !== null;
    }

    return { enter, exit, isActive, isPickMode, exitPickMode, getHoveredHotspot, init, showDialogue, openPuzzleOverlay, closePuzzleOverlay, openInventoryOverlay, closeInventoryOverlay, isWheelOpen, closeRadialWheel, getSelectedItem, clearSelectedItem };
})();
