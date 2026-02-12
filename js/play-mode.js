const PlayMode = (() => {
    let active = false;
    let selectedItem = null;
    let dialogueEl = null;
    let dialogueTimer = null;
    let typewriterInterval = null;
    let typewriterDone = false;
    let hoveredHotspot = null;
    let itemCursorCache = {};

    const overlay = document.getElementById('inventory-overlay');
    const overlayGrid = document.getElementById('inventory-overlay-grid');
    const overlayClose = document.getElementById('inventory-overlay-close');
    const inventoryBtn = document.getElementById('play-inventory-btn');
    const hintBtn = document.getElementById('play-hint-btn');
    const puzzleOverlay = document.getElementById('puzzle-overlay');
    const puzzleContent = document.getElementById('puzzle-overlay-content');
    const puzzleClose = document.getElementById('puzzle-overlay-close');
    let activePuzzleHotspot = null;

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
        html += '</div>';

        if (caption) {
            html += `<p class="puzzle-overlay-caption">${caption}</p>`;
        }

        // Play mode: Continue button (if any state has assets)
        const hasAssets = puzzle.states && puzzle.states.some(s => s.assets && s.assets.length > 0);
        if (puzzleOverlayMode === 'play' && hasAssets) {
            html += '<div class="puzzle-continue-wrap"><button class="panel-btn primary puzzle-continue-btn" id="puzzle-continue-btn">Continue</button></div>';
        }

        puzzleContent.innerHTML = html;
        puzzleOverlay.classList.remove('hidden');

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
        }

        if (bgImg && !bgImg.complete) {
            bgImg.addEventListener('load', renderAfterLayout);
        } else {
            renderAfterLayout();
        }

        // Play mode: bind Continue button
        if (puzzleOverlayMode === 'play' && hasAssets) {
            const continueBtn = document.getElementById('puzzle-continue-btn');
            if (continueBtn) {
                continueBtn.addEventListener('click', () => {
                    const solved = PuzzleAssets.attemptSolve(puzzle);
                    if (solved) {
                        continueBtn.textContent = 'Solved!';
                        continueBtn.disabled = true;
                        continueBtn.classList.add('solved');
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
            <select class="panel-select" id="puzzle-asset-type-select">
                ${assetTypes.map(at => `<option value="${at.type}">${at.label}</option>`).join('')}
                <option value="__hotspot__">Hotspot</option>
            </select>
            <button class="panel-btn primary" id="puzzle-place-asset-btn" style="width:100%;">+ Place</button>
            <div class="puzzle-hotspot-toolbar" id="puzzle-hotspot-toolbar">
                <button class="panel-btn" id="puzzle-hotspot-undo">Undo Point</button>
                <button class="panel-btn danger" id="puzzle-hotspot-delete">Delete</button>
            </div>
            <div class="puzzle-tools-divider"></div>
            <button class="panel-btn" id="puzzle-connect-btn" style="width:100%;">Connect</button>
            <div class="puzzle-connect-toolbar" id="puzzle-connect-toolbar">
                <input class="panel-input" id="puzzle-connect-name" placeholder="group_name">
                <button class="panel-btn primary" id="puzzle-connect-confirm" style="width:100%;" disabled>Confirm</button>
                <button class="panel-btn" id="puzzle-connect-cancel" style="width:100%;">Cancel</button>
            </div>
            <span id="puzzle-edit-status" class="panel-label" style="color:var(--text-secondary); font-size:11px; word-break:break-word;"></span>
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

    function bindEditTools(tools, puzzle, assetLayer, bgWrap) {
        const placeBtn = tools.querySelector('#puzzle-place-asset-btn');
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

        // Place asset / hotspot
        placeBtn.addEventListener('click', () => {
            if (PuzzleAssets.isConnecting()) {
                PuzzleAssets.stopConnecting();
                connectBtn.classList.remove('active');
                connectToolbar.classList.remove('active');
            }
            const type = typeSelect.value;

            if (type === '__hotspot__') {
                // Hotspot drawing mode
                PuzzleAssets.stopPlacing();
                removeGhost();
                PuzzleHotspotEditor.startDrawing();
                statusEl.textContent = 'Click to place points. Double-click to close.';
                placeBtn.classList.add('active');
                hotspotToolbar.classList.add('active');
                return;
            }

            // Normal asset placement
            PuzzleHotspotEditor.stopDrawing();
            hotspotToolbar.classList.remove('active');
            PuzzleAssets.startPlacing(type);
            statusEl.textContent = 'Click to place...';
            placeBtn.classList.add('active');
            createGhost(type);
        });

        // Placement click on bg-wrap (asset placement only, hotspot clicks handled by PuzzleHotspotEditor)
        if (bgWrap && assetLayer) {
            bgWrap.addEventListener('click', (e) => {
                // If hotspot drawing just finished, clean up UI
                if (!PuzzleHotspotEditor.isDrawing() && hotspotToolbar.classList.contains('active')) {
                    hotspotToolbar.classList.remove('active');
                    placeBtn.classList.remove('active');
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
                const asset = PuzzleAssets.createAsset(typeSelect.value, x, y);
                if (asset) {
                    currentSt.assets.push(asset);
                    PuzzleAssets.stopPlacing();
                    PuzzleAssets.renderAssets(puzzle, assetLayer, true);
                }

                removeGhost();
                statusEl.textContent = '';
                placeBtn.classList.remove('active');
            });
        }

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
                placeBtn.classList.remove('active');
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
                        ${bgSrc ? `<img src="${bgSrc}" alt="State ${stateIdx + 1}" draggable="false">` : '<span class="scene-thumb-empty">No bg</span>'}
                    </div>
                    <div class="scene-card-info">
                        <span class="scene-card-meta">${assetCount} asset${assetCount !== 1 ? 's' : ''}${stateCount > 1 ? ' &middot; State ' + (stateIdx + 1) + '/' + stateCount : ''}</span>
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
        AudioManager.stopSounds();
        LoopAnimator.stopPuzzle();
        TransitionPlayer.cancel();

        // Restore panel from edit layout wrapper
        const layout = document.getElementById('puzzle-edit-layout');
        if (layout) {
            const panel = layout.querySelector('.puzzle-overlay-panel');
            if (panel) puzzleOverlay.appendChild(panel);
            layout.remove();
        }

        puzzleOverlay.classList.add('hidden');
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
                // First click: skip typewriter, show full text
                if (typewriterInterval) { clearInterval(typewriterInterval); typewriterInterval = null; }
                dialogueEl.textContent = dialogueEl.dataset.fullText || '';
                typewriterDone = true;
                return;
            }
            // Second click: dismiss
            dismissDialogue();
        });
        document.body.appendChild(dialogueEl);
    }

    function showDialogue(text) {
        if (!dialogueEl) return;
        if (dialogueTimer) { clearTimeout(dialogueTimer); dialogueTimer = null; }
        if (typewriterInterval) { clearInterval(typewriterInterval); typewriterInterval = null; }

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
        }, 10000);
    }

    function dismissDialogue() {
        if (!dialogueEl) return;
        if (dialogueTimer) { clearTimeout(dialogueTimer); dialogueTimer = null; }
        if (typewriterInterval) { clearInterval(typewriterInterval); typewriterInterval = null; }
        dialogueEl.classList.add('dialogue-hidden');
    }

    // -- Cursor helpers --

    function getItemCursor(itemId) {
        if (itemCursorCache[itemId]) return itemCursorCache[itemId];
        const item = InventoryEditor.getItem(itemId);
        if (!item || !item.image) {
            itemCursorCache[itemId] = 'grab';
            return 'grab';
        }
        const img = new Image();
        img.src = item.image;
        const c = document.createElement('canvas');
        c.width = 32;
        c.height = 32;
        const cx = c.getContext('2d');
        cx.drawImage(img, 0, 0, 32, 32);
        const url = c.toDataURL();
        itemCursorCache[itemId] = `url(${url}) 16 16, auto`;
        return itemCursorCache[itemId];
    }

    function getActionCursor(hotspot) {
        if (selectedItem) return getItemCursor(selectedItem);
        if (!hotspot) return 'default';
        return 'grab';
    }

    // -- Hover handling --

    function handleMouseMove(e) {
        if (!active) return;

        const rect = Canvas.getCanvasElement().getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const img = Canvas.screenToImage(sx, sy);

        const hit = HotspotEditor.hitTest(img.x, img.y);
        hoveredHotspot = hit;
        Canvas.getCanvasElement().style.cursor = getActionCursor(hit);
    }

    function getHoveredHotspot() {
        return hoveredHotspot;
    }

    // -- Click handling --

    function handleClick(e) {
        if (!active) return;

        const rect = Canvas.getCanvasElement().getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const img = Canvas.screenToImage(sx, sy);

        const hotspot = HotspotEditor.hitTest(img.x, img.y);
        if (!hotspot) return;

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

            case 'clue':
                if (action.clueId) {
                    const clue = PuzzleEditor.getPuzzle(action.clueId);
                    if (clue) {
                        openPuzzleOverlay(clue, hotspot, action.text || clue.completionText);
                    } else {
                        if (action.text) showDialogue(action.text);
                    }
                } else {
                    if (action.text) showDialogue(action.text);
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
                if (action.itemId && !GameState.hasItem(action.itemId)) {
                    GameState.addToInventory(action.itemId);
                    if (autoFlag) GameState.setFlag(autoFlag);
                    const item = InventoryEditor.getItem(action.itemId);
                    showDialogue(`Picked up: ${item ? item.name : action.itemId}`);
                } else {
                    actionSucceeded = false;
                }
                break;

            case 'accepts_item':
                if (selectedItem && selectedItem === action.requiredItemId) {
                    GameState.useItem(selectedItem);
                    if (autoFlag) GameState.setFlag(autoFlag);
                    selectedItem = null;
                    Canvas.getCanvasElement().style.cursor = getActionCursor(hotspot);
                    showDialogue('Used the item.');
                } else {
                    actionSucceeded = false;
                    showDialogue("That didn't work");
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
                } else {
                    onDone();
                }
            }
        }
    }

    function bindCanvas() {
        const el = Canvas.getCanvasElement();
        el.addEventListener('click', handleClick);
        el.addEventListener('mousemove', handleMouseMove);
    }

    function unbindCanvas() {
        const el = Canvas.getCanvasElement();
        el.removeEventListener('click', handleClick);
        el.removeEventListener('mousemove', handleMouseMove);
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
    }

    return { enter, exit, isActive, getHoveredHotspot, init, showDialogue, openPuzzleOverlay, closePuzzleOverlay };
})();
