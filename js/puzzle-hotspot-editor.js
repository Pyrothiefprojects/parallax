const PuzzleHotspotEditor = (() => {
    let drawing = false;
    let currentPoints = [];
    let selectedHotspot = null;
    let draggingPoint = null;
    let popoverEl = null;
    let svgLayer = null;
    let bgRefEl = null;
    let overlayEl = null;
    let stateRef = null;
    let puzzleRef = null;
    let isEdit = false;

    // Bound handler references for cleanup
    let _onClick = null;
    let _onDblClick = null;
    let _onMouseMove = null;
    let _onMouseUp = null;
    let _onContextMenu = null;

    function init(state, svgEl, bgEl, overlayParent, editMode, puzzle) {
        cleanup();
        stateRef = state;
        puzzleRef = puzzle || null;
        svgLayer = svgEl;
        bgRefEl = bgEl;
        overlayEl = overlayParent;
        isEdit = editMode;
        if (!stateRef.hotspots) stateRef.hotspots = [];

        _onClick = handleClick;
        _onDblClick = handleDblClick;
        _onMouseMove = handleMouseMove;
        _onMouseUp = handleMouseUp;
        _onContextMenu = handleContextMenu;

        bgRefEl.addEventListener('click', _onClick);
        bgRefEl.addEventListener('dblclick', _onDblClick);
        bgRefEl.addEventListener('mousemove', _onMouseMove);
        bgRefEl.addEventListener('mouseup', _onMouseUp);
        bgRefEl.addEventListener('contextmenu', _onContextMenu);

        render();
    }

    function cleanup() {
        stopDrawing();
        closePopover();
        selectedHotspot = null;
        draggingPoint = null;
        if (bgRefEl) {
            if (_onClick) bgRefEl.removeEventListener('click', _onClick);
            if (_onDblClick) bgRefEl.removeEventListener('dblclick', _onDblClick);
            if (_onMouseMove) bgRefEl.removeEventListener('mousemove', _onMouseMove);
            if (_onMouseUp) bgRefEl.removeEventListener('mouseup', _onMouseUp);
            if (_onContextMenu) bgRefEl.removeEventListener('contextmenu', _onContextMenu);
        }
        if (svgLayer) svgLayer.innerHTML = '';
        stateRef = null;
        puzzleRef = null;
        svgLayer = null;
        bgRefEl = null;
        overlayEl = null;
        _onClick = _onDblClick = _onMouseMove = _onMouseUp = _onContextMenu = null;
    }

    function getHotspots() {
        return stateRef ? (stateRef.hotspots || []) : [];
    }

    // -- Drawing --

    function startDrawing() {
        drawing = true;
        currentPoints = [];
        selectedHotspot = null;
        closePopover();
        render();
    }

    function stopDrawing() {
        drawing = false;
        currentPoints = [];
    }

    function isDrawing() {
        return drawing;
    }

    function addPoint(x, y) {
        if (!drawing) return;

        if (currentPoints.length >= 3) {
            const first = currentPoints[0];
            const dist = Math.hypot(x - first[0], y - first[1]);
            if (dist < 15) {
                finishPolygon();
                return;
            }
        }

        currentPoints.push([Math.round(x), Math.round(y)]);
        render();
    }

    function undoPoint() {
        if (drawing && currentPoints.length > 0) {
            currentPoints.pop();
            render();
        }
    }

    function finishPolygon() {
        if (currentPoints.length < 3) {
            stopDrawing();
            render();
            return;
        }

        if (!stateRef) return;

        const id = 'hotspot_' + Date.now();
        const hotspot = {
            id,
            name: '',
            points: [...currentPoints],
            action: { type: 'clue', text: '' },
            requires: []
        };

        stateRef.hotspots.push(hotspot);
        stopDrawing();
        selectHotspot(hotspot);
    }

    // -- Selection --

    function selectHotspot(hotspot) {
        selectedHotspot = hotspot;
        render();
        if (hotspot && isEdit) {
            showPopover(hotspot);
        }
    }

    function deleteSelected() {
        if (!selectedHotspot || !stateRef) return;
        stateRef.hotspots = stateRef.hotspots.filter(h => h.id !== selectedHotspot.id);
        selectedHotspot = null;
        closePopover();
        render();
    }

    // -- Hit Testing --

    function hitTest(x, y) {
        const hotspots = getHotspots();
        for (let i = hotspots.length - 1; i >= 0; i--) {
            if (HotspotEditor.pointInPolygon(x, y, hotspots[i].points)) {
                return hotspots[i];
            }
        }
        return null;
    }

    function findNearPoint(x, y, hotspot) {
        if (!hotspot) return -1;
        for (let i = 0; i < hotspot.points.length; i++) {
            const dist = Math.hypot(x - hotspot.points[i][0], y - hotspot.points[i][1]);
            if (dist < 10) return i;
        }
        return -1;
    }

    // -- Coordinate Conversion --

    function getImageCoords(e) {
        const imgEl = bgRefEl.querySelector('.puzzle-overlay-bg-img') || bgRefEl;
        const rect = imgEl.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    // -- SVG Rendering --

    function render() {
        if (!svgLayer) return;
        svgLayer.innerHTML = '';

        const hotspots = getHotspots();
        for (const hs of hotspots) {
            drawSvgPolygon(hs, hs === selectedHotspot, false);
        }

        if (drawing && currentPoints.length > 0) {
            drawSvgPolygon({ points: currentPoints }, true, true);
        }
    }

    function drawSvgPolygon(hs, highlight, open) {
        const points = hs.points;
        if (!points || points.length === 0) return;

        const pointsStr = points.map(p => p[0] + ',' + p[1]).join(' ');

        if (open) {
            // In-progress: polyline (open path)
            const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
            polyline.setAttribute('points', pointsStr);
            polyline.setAttribute('fill', 'none');
            polyline.setAttribute('stroke', '#ffa500');
            polyline.setAttribute('stroke-width', '2');
            polyline.setAttribute('stroke-dasharray', '6,4');
            svgLayer.appendChild(polyline);
        } else {
            // Completed polygon
            const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            polygon.setAttribute('points', pointsStr);

            if (isEdit) {
                polygon.setAttribute('fill', highlight ? 'rgba(255, 107, 53, 0.25)' : 'rgba(255, 107, 53, 0.1)');
                polygon.setAttribute('stroke', highlight ? '#ffa500' : '#ff6b35');
                polygon.setAttribute('stroke-width', highlight ? '2' : '1');
                polygon.classList.add('edit');
            } else {
                // Play mode: invisible, clickable
                polygon.setAttribute('fill', 'transparent');
                polygon.setAttribute('stroke', 'none');
                polygon.classList.add('play');
                polygon.style.pointerEvents = 'all';
                polygon.style.cursor = 'grab';

                // Play mode click handler
                polygon.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handlePlayClick(hs);
                });
            }

            svgLayer.appendChild(polygon);
        }

        // Draw point handles (edit mode, selected or drawing)
        if (highlight && isEdit) {
            for (let i = 0; i < points.length; i++) {
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', points[i][0]);
                circle.setAttribute('cy', points[i][1]);
                circle.setAttribute('r', '4');
                circle.setAttribute('fill', '#ffa500');
                circle.setAttribute('stroke', '#0a0a0a');
                circle.setAttribute('stroke-width', '1');
                circle.classList.add('hotspot-handle');
                circle.style.pointerEvents = 'all';
                circle.style.cursor = 'grab';
                svgLayer.appendChild(circle);
            }
        }
    }

    // -- Play Mode Click --

    function handlePlayClick(hotspot) {
        if (!GameState.checkFlags(hotspot.requires)) {
            PlayMode.showDialogue("Something needs to happen first...");
            return;
        }

        // Handle accepts_item — validate inventory before proceeding
        if (hotspot.action && hotspot.action.type === 'accepts_item') {
            const sel = PlayMode.getSelectedItem();
            if (!sel || sel !== hotspot.action.requiredItemId) {
                PlayMode.showDialogue("That didn't work.", 3000);
                return;
            }
            GameState.useItem(sel);
            PlayMode.clearSelectedItem();
            const item = InventoryEditor.getItem(sel);
            PlayMode.showDialogue(`Used ${item ? item.name : sel}.`, 3000);
        }

        if (hotspot.sound) AudioManager.playSound(hotspot.sound, hotspot.soundLoop);

        const autoFlag = GameState.getAutoFlag(hotspot);
        if (autoFlag) GameState.setFlag(autoFlag);

        PuzzleAssets.dispatchActionObj(hotspot.action);

        // Asset changes — hide or show assets
        const acList = hotspot.assetChanges || (hotspot.assetChange ? [hotspot.assetChange] : []);
        for (const ac of acList) {
            if (!ac.assetId) continue;
            const acMode = ac.mode || 'hide';
            if (acMode === 'show') {
                GameState.restoreAsset(ac.assetId);
            } else {
                GameState.removeAsset(ac.assetId);
            }
        }
        if (acList.length > 0) Canvas.render();

        if (hotspot.stateChange && hotspot.stateChange.stateIndex != null) {
            PuzzleAssets.dispatchActionObj({
                type: 'puzzle_state',
                stateIndex: hotspot.stateChange.stateIndex,
                frames: hotspot.stateChange.frames || [],
                frameDuration: hotspot.stateChange.frameDuration || 100,
                video: hotspot.stateChange.video || null,
                reverse: hotspot.stateChange.reverse || false,
                effect: hotspot.stateChange.effect || null
            });
        }

        if (hotspot.clearAfterClick) GameState.clearHotspot(hotspot.id);

        // Dispatch secondary action for accepts_item
        if (hotspot.action && hotspot.action.onAccept && hotspot.action.onAccept.type !== 'none') {
            PuzzleAssets.dispatchActionObj(hotspot.action.onAccept);
        }
    }

    // -- Mouse Event Handlers --

    function handleClick(e) {
        if (!isEdit) return;
        if (e.target.closest('.hotspot-popover') || e.target.closest('.puzzle-asset-popover')) return;

        // Don't interfere with asset placement or connect mode
        if (!drawing && (PuzzleAssets.isPlacing() || PuzzleAssets.isConnecting())) return;

        const coords = getImageCoords(e);

        if (drawing) {
            // Don't add points when clicking on assets or popovers
            if (e.target.closest('.puzzle-asset')) return;
            addPoint(coords.x, coords.y);
            return;
        }

        // Check if clicking a point handle on selected hotspot
        if (selectedHotspot) {
            const ptIdx = findNearPoint(coords.x, coords.y, selectedHotspot);
            if (ptIdx >= 0) {
                draggingPoint = { hotspot: selectedHotspot, index: ptIdx };
                return;
            }
        }

        // Check if clicking on a hotspot
        const hit = hitTest(coords.x, coords.y);
        if (hit) {
            selectHotspot(hit);
            e.stopPropagation();
        } else if (selectedHotspot) {
            // Only deselect if we didn't click on an asset
            if (!e.target.closest('.puzzle-asset')) {
                selectedHotspot = null;
                closePopover();
                render();
            }
        }
    }

    function handleDblClick(e) {
        if (drawing) {
            e.stopPropagation();
            finishPolygon();
        }
    }

    function handleMouseMove(e) {
        if (!draggingPoint) return;

        const coords = getImageCoords(e);
        draggingPoint.hotspot.points[draggingPoint.index] = [Math.round(coords.x), Math.round(coords.y)];
        render();
    }

    function handleMouseUp() {
        if (draggingPoint) {
            draggingPoint = null;
            if (selectedHotspot) showPopover(selectedHotspot);
        }
    }

    function handleContextMenu(e) {
        if (drawing) {
            e.preventDefault();
            stopDrawing();
            render();
        } else if (selectedHotspot) {
            e.preventDefault();
            selectedHotspot = null;
            closePopover();
            render();
        }
    }

    // -- Popover --

    function showPopover(hotspot) {
        closePopover();
        if (!overlayEl) return;

        const centroid = getCentroid(hotspot.points);
        // Position relative to the overlay panel
        const bgImg = bgRefEl.querySelector('.puzzle-overlay-bg-img') || bgRefEl;
        const bgRect = bgImg.getBoundingClientRect();

        popoverEl = document.createElement('div');
        popoverEl.className = 'hotspot-popover puzzle-hotspot-popover';
        popoverEl.style.position = 'fixed';
        popoverEl.style.left = (bgRect.left + centroid.x + 10) + 'px';
        popoverEl.style.top = (bgRect.top + centroid.y) + 'px';
        popoverEl.style.zIndex = '400';

        const definedFlags = GameState.getDefinedFlags();

        const puzzleStates = puzzleRef ? puzzleRef.states || [] : [];

        popoverEl.innerHTML = `
            <div class="popover-header">
                <span class="popover-title">Hotspot Config</span>
                <button class="popover-close">&times;</button>
            </div>
            <div class="popover-field">
                <label>Name</label>
                <input class="panel-input" id="puzzle-hs-pop-name" value="${hotspot.name}" placeholder="hotspot_name">
            </div>
            <div id="puzzle-hs-pop-auto-flag" class="auto-flag-label"></div>
            <div class="popover-field">
                <label>Requires</label>
                <div class="requires-dropdown" id="puzzle-hs-pop-requires">
                    ${definedFlags.map(f => `
                        <label class="requires-option">
                            <input type="checkbox" value="${f}" ${(hotspot.requires || []).includes(f) ? 'checked' : ''}>
                            ${f}
                        </label>
                    `).join('')}
                </div>
            </div>
            ${ActionConfig.renderDropdown(hotspot, 'puzzle-hs-pop')}
            ${ActionConfig.renderStateChangeToggle(hotspot, 'puzzle-hs-pop', puzzleStates)}
            ${ActionConfig.renderLoopToggle(hotspot, 'puzzle-hs-pop')}
            ${ActionConfig.renderSoundToggle(hotspot, 'puzzle-hs-pop')}
            ${ActionConfig.renderAssetChangeToggle(hotspot, 'puzzle-hs-pop')}
            <div class="popover-field">
                <label><input type="checkbox" id="puzzle-hs-pop-clear-after" ${hotspot.clearAfterClick ? 'checked' : ''}> Clear after click</label>
            </div>
            <div style="margin-top:8px;">
                <button class="panel-btn danger" id="puzzle-hs-pop-delete">Delete</button>
            </div>
        `;

        overlayEl.appendChild(popoverEl);

        // Close
        popoverEl.querySelector('.popover-close').addEventListener('click', closePopover);

        // Name
        const nameInput = popoverEl.querySelector('#puzzle-hs-pop-name');
        nameInput.addEventListener('input', () => {
            hotspot.name = nameInput.value;
            updateAutoFlagLabel(hotspot);
        });

        // Requires
        popoverEl.querySelectorAll('#puzzle-hs-pop-requires input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => {
                hotspot.requires = Array.from(popoverEl.querySelectorAll('#puzzle-hs-pop-requires input:checked')).map(c => c.value);
            });
        });

        ActionConfig.bindDropdown(popoverEl, hotspot, 'puzzle-hs-pop', () => updateAutoFlagLabel(hotspot));
        ActionConfig.bindStateChangeToggle(popoverEl, hotspot, 'puzzle-hs-pop');
        ActionConfig.bindLoopToggle(popoverEl, hotspot, 'puzzle-hs-pop');
        ActionConfig.bindSoundToggle(popoverEl, hotspot, 'puzzle-hs-pop');
        ActionConfig.bindAssetChangeToggle(popoverEl, hotspot, 'puzzle-hs-pop');

        const clearCb = popoverEl.querySelector('#puzzle-hs-pop-clear-after');
        if (clearCb) {
            clearCb.addEventListener('change', () => { hotspot.clearAfterClick = clearCb.checked; });
        }

        // Delete
        popoverEl.querySelector('#puzzle-hs-pop-delete').addEventListener('click', () => {
            deleteSelected();
        });

        updateAutoFlagLabel(hotspot);

        // Keep on screen
        requestAnimationFrame(() => {
            if (!popoverEl) return;
            const popRect = popoverEl.getBoundingClientRect();
            if (popRect.right > window.innerWidth) {
                popoverEl.style.left = Math.max(10, bgRect.left + centroid.x - popRect.width - 10) + 'px';
            }
            if (popRect.bottom > window.innerHeight) {
                popoverEl.style.top = Math.max(10, window.innerHeight - popRect.height - 10) + 'px';
            }
        });
    }

    function updateAutoFlagLabel(hotspot) {
        const el = popoverEl ? popoverEl.querySelector('#puzzle-hs-pop-auto-flag') : null;
        if (!el) return;
        const flag = GameState.getAutoFlag(hotspot);
        if (flag) {
            el.innerHTML = `<span class="auto-flag-arrow">&rarr;</span> sets: <span class="auto-flag-name">${flag}</span>`;
        } else {
            el.innerHTML = '<span style="color:var(--text-secondary)">Name the hotspot to generate a flag</span>';
        }
    }

    function closePopover() {
        if (popoverEl) {
            popoverEl.remove();
            popoverEl = null;
        }
    }

    function getCentroid(points) {
        let cx = 0, cy = 0;
        for (const p of points) { cx += p[0]; cy += p[1]; }
        return { x: cx / points.length, y: cy / points.length };
    }

    return {
        init, cleanup, render, isDrawing, startDrawing, stopDrawing,
        undoPoint, deleteSelected, closePopover
    };
})();
