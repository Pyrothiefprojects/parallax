const PuzzleAssets = (() => {
    let popoverEl = null;
    let placingType = null;
    let activePuzzle = null;
    let activeState = null;
    let activeContainer = null;
    let activeEditMode = false;
    let onChangeCallback = null;

    // -- Asset Type Registry --

    const assetTypes = {};

    function registerType(def) {
        assetTypes[def.type] = def;
    }

    // -- Connect Mode State --

    let connectMode = false;
    let connectSelection = new Set();

    function startConnecting() {
        connectMode = true;
        connectSelection.clear();
        closeAssetPopover();
    }

    function stopConnecting() {
        connectMode = false;
        // Remove connecting class from all assets
        if (activeContainer) {
            activeContainer.querySelectorAll('.puzzle-asset.connecting').forEach(el => {
                el.classList.remove('connecting');
            });
        }
        connectSelection.clear();
        // Redraw lines (removes temp lines)
        if (activePuzzle && activeContainer) {
            renderGroupLines(activeContainer);
        }
    }

    function isConnecting() {
        return connectMode;
    }

    function toggleConnectAsset(assetId) {
        if (connectSelection.has(assetId)) {
            connectSelection.delete(assetId);
        } else {
            connectSelection.add(assetId);
        }
        // Update visual
        if (activeContainer) {
            const el = activeContainer.querySelector(`[data-asset-id="${assetId}"]`);
            if (el) el.classList.toggle('connecting', connectSelection.has(assetId));
        }
        // Update temp lines
        if (activePuzzle && activeContainer) {
            renderGroupLines(activeContainer);
        }
    }

    function getConnectSelection() {
        return connectSelection;
    }

    function createGroup(name, puzzle) {
        if (connectSelection.size < 2) return null;
        const group = {
            id: 'group_' + Date.now(),
            name: name || '',
            assetIds: Array.from(connectSelection),
            action: { type: 'clue', text: '' },
            requires: []
        };
        if (!activeState.assetGroups) activeState.assetGroups = [];
        activeState.assetGroups.push(group);

        // Set groupId on member assets
        for (const aid of group.assetIds) {
            const asset = (activeState.assets || []).find(a => a.id === aid);
            if (asset) asset.groupId = group.id;
        }

        stopConnecting();
        return group;
    }

    function disconnectAsset(asset) {
        if (!asset.groupId || !activeState) return;
        const groups = activeState.assetGroups || [];
        const group = groups.find(g => g.id === asset.groupId);
        if (!group) { asset.groupId = null; return; }

        // Remove from group
        group.assetIds = group.assetIds.filter(id => id !== asset.id);
        asset.groupId = null;

        // If group has < 2 members, dissolve it
        if (group.assetIds.length < 2) {
            // Clear groupId from remaining members
            for (const aid of group.assetIds) {
                const a = (activeState.assets || []).find(x => x.id === aid);
                if (a) a.groupId = null;
            }
            activeState.assetGroups = groups.filter(g => g.id !== group.id);
        }
    }

    // -- Public Helpers --

    function getAssetTypes() {
        return Object.entries(assetTypes)
            .filter(([_, val]) => !val.hidden)
            .map(([key, val]) => ({ type: key, label: val.label }));
    }

    function createAsset(type, x, y, options) {
        const def = assetTypes[type];
        if (!def) return null;
        return def.create(x, y, options || {});
    }

    function renderPreview(type) {
        const def = assetTypes[type];
        if (!def) return '';
        const tempAsset = def.create(0, 0);
        return def.render(tempAsset, false);
    }

    function getAutoFlag(asset) {
        if (!asset || !asset.name) return null;
        const name = GameState.sanitizeName(asset.name);
        if (!name) return null;
        return 'solved_' + name;
    }

    function getGroupAutoFlag(group) {
        if (!group || !group.name) return null;
        const name = GameState.sanitizeName(group.name);
        return name ? 'solved_' + name : null;
    }

    // -- Rendering --

    function renderAssets(puzzle, container, editMode, stateIdx) {
        activePuzzle = puzzle;
        activeContainer = container;
        activeEditMode = editMode;

        if (stateIdx == null) {
            stateIdx = puzzle.editingStateIndex || 0;
        }
        activeState = puzzle.states ? (puzzle.states[stateIdx] || puzzle.states[0]) : null;

        // Clear existing asset elements (not popovers)
        container.querySelectorAll('.puzzle-asset').forEach(el => el.remove());

        const assets = activeState ? (activeState.assets || []) : [];
        if (assets.length === 0) {
            renderGroupLines(container);
            return;
        }

        for (const asset of assets) {
            const typeDef = assetTypes[asset.type];
            if (!typeDef) continue;

            // In play mode, skip assets that have been removed (collected/hidden)
            if (!editMode && GameState.isAssetRemoved(asset.id)) continue;

            const el = document.createElement('div');
            el.className = 'puzzle-asset' + (editMode ? ' edit-mode' : '');
            if (connectMode && connectSelection.has(asset.id)) {
                el.classList.add('connecting');
            }
            el.dataset.assetId = asset.id;
            el.style.left = asset.x + 'px';
            el.style.top = asset.y + 'px';
            el.innerHTML = typeDef.render(asset, editMode);
            container.appendChild(el);

            if (editMode) {
                bindEditEvents(el, asset);
            } else {
                const typeDef = assetTypes[asset.type];
                if (typeDef && typeDef.bindPlay) {
                    typeDef.bindPlay(el, asset);
                }
                // After any play click, dispatch asset changes for the group (or individual asset)
                el.addEventListener('click', () => {
                    const group = asset.groupId && activeState
                        ? (activeState.assetGroups || []).find(g => g.id === asset.groupId)
                        : null;
                    const acTarget = group || asset;
                    const acList = acTarget.assetChanges || (acTarget.assetChange ? [acTarget.assetChange] : []);
                    for (const ac of acList) {
                        if (!ac.assetId) continue;
                        const acEl = activeContainer ? activeContainer.querySelector(`[data-asset-id="${ac.assetId}"]`) : null;
                        const eff = ac.effect || 'fade';
                        const useFade = eff === 'fade' || eff === 'long_fade';
                        const fadeDur = eff === 'long_fade' ? 1.2 : 0.4;
                        if ((ac.mode || 'hide') === 'show') {
                            GameState.restoreAsset(ac.assetId);
                            if (acEl && useFade) {
                                acEl.style.opacity = '0';
                                acEl.style.transition = 'opacity ' + fadeDur + 's';
                                requestAnimationFrame(() => { acEl.style.opacity = '1'; });
                            }
                        } else {
                            if (acEl && useFade) {
                                acEl.style.transition = 'opacity ' + fadeDur + 's';
                                acEl.style.opacity = '0';
                                setTimeout(() => {
                                    GameState.removeAsset(ac.assetId);
                                    acEl.remove();
                                }, fadeDur * 1000);
                            } else {
                                GameState.removeAsset(ac.assetId);
                                if (acEl) acEl.remove();
                            }
                        }
                    }
                });
            }
        }

        // Draw group connection lines (edit mode only)
        if (editMode) {
            renderGroupLines(container);
        } else {
            const existing = container.querySelector('.puzzle-group-lines');
            if (existing) existing.remove();
        }
    }

    // -- Group Connection Lines --

    const GROUP_COLORS = ['#ff6b35', '#4fc3f7', '#81c784', '#ce93d8', '#ffb74d'];

    function renderGroupLines(container) {
        // Remove existing SVG
        const existing = container.querySelector('.puzzle-group-lines');
        if (existing) existing.remove();

        const groups = activeState ? (activeState.assetGroups || []) : [];
        const hasGroups = groups.length > 0;
        const hasConnecting = connectMode && connectSelection.size >= 2;
        if (!hasGroups && !hasConnecting) return;

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'puzzle-group-lines');
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.pointerEvents = 'none';
        svg.style.zIndex = '1';

        // Draw established group lines
        groups.forEach((group, gi) => {
            const color = GROUP_COLORS[gi % GROUP_COLORS.length];
            const positions = [];
            for (const aid of group.assetIds) {
                const asset = (activeState ? activeState.assets || [] : []).find(a => a.id === aid);
                if (asset) positions.push({ x: asset.x, y: asset.y });
            }
            drawLines(svg, positions, color, '4,4');
        });

        // Draw temporary connect-mode lines
        if (hasConnecting) {
            const positions = [];
            for (const aid of connectSelection) {
                const asset = (activeState ? activeState.assets || [] : []).find(a => a.id === aid);
                if (asset) positions.push({ x: asset.x, y: asset.y });
            }
            drawLines(svg, positions, '#ffa500', '6,3');
        }

        container.appendChild(svg);
    }

    function drawLines(svg, positions, color, dashArray) {
        if (positions.length < 2) return;
        for (let i = 0; i < positions.length - 1; i++) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', positions[i].x);
            line.setAttribute('y1', positions[i].y);
            line.setAttribute('x2', positions[i + 1].x);
            line.setAttribute('y2', positions[i + 1].y);
            line.setAttribute('stroke', color);
            line.setAttribute('stroke-width', '2');
            line.setAttribute('stroke-dasharray', dashArray);
            line.setAttribute('stroke-opacity', '0.7');
            svg.appendChild(line);
        }
    }

    // -- Edit Mode Events --

    function bindEditEvents(el, asset) {
        let isDragging = false;
        let startMouseX, startMouseY;
        let startAssetX, startAssetY;

        el.addEventListener('mousedown', (e) => {
            if (e.target.closest('.puzzle-asset-popover')) return;

            // In connect mode, toggle selection on click (no drag)
            if (connectMode) {
                toggleConnectAsset(asset.id);
                e.preventDefault();
                return;
            }

            isDragging = false;
            startMouseX = e.clientX;
            startMouseY = e.clientY;
            startAssetX = asset.x;
            startAssetY = asset.y;

            const onMove = (me) => {
                const dx = me.clientX - startMouseX;
                const dy = me.clientY - startMouseY;
                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) isDragging = true;

                if (isDragging) {
                    closeAssetPopover();
                    asset.x = Math.max(0, startAssetX + dx);
                    asset.y = Math.max(0, startAssetY + dy);
                    el.style.left = asset.x + 'px';
                    el.style.top = asset.y + 'px';
                    // Update group lines while dragging
                    if (activePuzzle && activeContainer) {
                        renderGroupLines(activeContainer);
                    }
                }
            };

            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);

                if (!isDragging) {
                    showAssetPopover(asset, el);
                }
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
            e.preventDefault();
        });
    }

    // -- Continue / Submit (Group-Aware) --

    function attemptSolve(puzzle) {
        const assets = activeState ? (activeState.assets || []) : [];
        const groups = activeState ? (activeState.assetGroups || []) : [];
        let allCorrect = true;
        const processedGroups = new Set();

        for (const asset of assets) {
            if (asset._solved) continue;

            const typeDef = assetTypes[asset.type];
            if (!typeDef) continue;

            // Grouped asset
            if (asset.groupId) {
                if (processedGroups.has(asset.groupId)) continue;
                processedGroups.add(asset.groupId);

                const group = groups.find(g => g.id === asset.groupId);
                if (!group) continue;

                // Get all member assets
                const members = group.assetIds.map(id => assets.find(a => a.id === id)).filter(Boolean);

                // Check if ALL members are solved
                let groupCorrect = true;
                for (const m of members) {
                    if (m._solved) continue;
                    const td = assetTypes[m.type];
                    if (!td || !td.checkSolved(m)) {
                        groupCorrect = false;
                        break;
                    }
                }

                if (!groupCorrect) {
                    allCorrect = false;
                    continue;
                }

                // Check group requires
                if (!GameState.checkFlags(group.requires)) {
                    PlayMode.showDialogue("Something needs to happen first...");
                    return false;
                }

                // Mark all members solved
                for (const m of members) {
                    m._solved = true;
                    const el = activeContainer ? activeContainer.querySelector(`[data-asset-id="${m.id}"]`) : null;
                    const td = assetTypes[m.type];
                    if (el && td && td.markSolved) td.markSolved(el, m);
                }

                // Set group auto flag
                const autoFlag = getGroupAutoFlag(group);
                if (autoFlag) GameState.setFlag(autoFlag);

                // Play group sound effect
                if (group.sound) AudioManager.playSound(group.sound, group.soundLoop);

                // Fire group action
                dispatchActionObj(group.action);
                const grpAcList = group.assetChanges || (group.assetChange ? [group.assetChange] : []);
                for (const ac of grpAcList) {
                    if (!ac.assetId) continue;
                    if ((ac.mode || 'hide') === 'show') GameState.restoreAsset(ac.assetId);
                    else GameState.removeAsset(ac.assetId);
                }
                if (grpAcList.length > 0) Canvas.render();
                if (group.stateChange && group.stateChange.stateIndex != null) {
                    dispatchActionObj({
                        type: 'puzzle_state',
                        stateIndex: group.stateChange.stateIndex,
                        frames: group.stateChange.frames || [],
                        frameDuration: group.stateChange.frameDuration || 100,
                        video: group.stateChange.video || null,
                        reverse: group.stateChange.reverse || false,
                        effect: group.stateChange.effect || null
                    });
                }
                continue;
            }

            // Ungrouped asset — individual logic
            if (!typeDef.checkSolved(asset)) {
                allCorrect = false;
                continue;
            }

            if (!GameState.checkFlags(asset.requires)) {
                PlayMode.showDialogue("Something needs to happen first...");
                return false;
            }

            asset._solved = true;
            const el = activeContainer ? activeContainer.querySelector(`[data-asset-id="${asset.id}"]`) : null;
            if (el && typeDef.markSolved) typeDef.markSolved(el, asset);

            const autoFlag = getAutoFlag(asset);
            if (autoFlag) GameState.setFlag(autoFlag);

            if (asset.sound) AudioManager.playSound(asset.sound, asset.soundLoop);
            dispatchActionObj(asset.action);
            const assetAcList = asset.assetChanges || (asset.assetChange ? [asset.assetChange] : []);
            for (const ac of assetAcList) {
                if (!ac.assetId) continue;
                if ((ac.mode || 'hide') === 'show') GameState.restoreAsset(ac.assetId);
                else GameState.removeAsset(ac.assetId);
            }
            if (assetAcList.length > 0) Canvas.render();
            if (asset.stateChange && asset.stateChange.stateIndex != null) {
                dispatchActionObj({
                    type: 'puzzle_state',
                    stateIndex: asset.stateChange.stateIndex,
                    frames: asset.stateChange.frames || [],
                    frameDuration: asset.stateChange.frameDuration || 100,
                    video: asset.stateChange.video || null,
                    reverse: asset.stateChange.reverse || false,
                    effect: asset.stateChange.effect || null
                });
            }
        }

        if (!allCorrect) {
            PlayMode.showDialogue("That doesn't seem right...");
        }

        return allCorrect;
    }

    // -- Action Dispatch --

    function dispatchAction(asset) {
        dispatchActionObj(asset.action);
    }

    function dispatchActionObj(action) {
        if (!action || !action.type || action.type === 'none') return;

        switch (action.type) {
            case 'clue':
                if (action.clueId) {
                    const clue = PuzzleEditor.getPuzzle(action.clueId);
                    if (clue) {
                        PlayMode.showDialogue(action.text || clue.completionText || 'Found a clue.');
                    } else {
                        if (action.text) PlayMode.showDialogue(action.text);
                    }
                } else {
                    if (action.text) PlayMode.showDialogue(action.text);
                }
                break;

            case 'navigate':
                if (action.target) {
                    PlayMode.closePuzzleOverlay();
                    SceneManager.switchScene(action.target);
                }
                break;

            case 'pickup':
                if (action.itemId && !GameState.hasItem(action.itemId)) {
                    GameState.addToInventory(action.itemId);
                    const item = InventoryEditor.getItem(action.itemId);
                    PlayMode.showDialogue(`Picked up: ${item ? item.name : action.itemId}`);
                }
                break;

            case 'accepts_item':
                // Item validation handled by puzzle hotspot click handler
                break;

            case 'puzzle':
                if (action.puzzleId) {
                    const puzzle = PuzzleEditor.getPuzzle(action.puzzleId);
                    if (puzzle) {
                        PlayMode.closePuzzleOverlay();
                        PlayMode.openPuzzleOverlay(puzzle, null);
                    }
                }
                break;

            case 'solve_puzzle':
                if (activePuzzle) {
                    const solved = attemptSolve(activePuzzle);
                    if (solved && action.text) {
                        PlayMode.showDialogue(action.text);
                    }
                }
                break;

            case 'puzzle_state':
                if (action.stateIndex != null && activePuzzle) {
                    const bgWrap = activeContainer ? activeContainer.parentElement : null;
                    const imgEl = bgWrap ? bgWrap.querySelector('.puzzle-overlay-bg-img') : null;
                    const onDone = () => {
                        GameState.setPuzzleState(activePuzzle.id, action.stateIndex);
                        transitionPuzzleBg(action.stateIndex);
                    };
                    if (action.video && imgEl) {
                        TransitionPlayer.playVideo(action.video, { target: 'img', imgEl: imgEl }).then(onDone);
                    } else if (action.frames && action.frames.length > 0 && imgEl) {
                        const playFrames = action.reverse ? action.frames.slice().reverse() : action.frames;
                        TransitionPlayer.play(playFrames, {
                            frameDuration: action.frameDuration || 100,
                            target: 'img',
                            imgEl: imgEl
                        }).then(onDone);
                    } else if (action.effect === 'fade' && imgEl) {
                        imgEl.style.transition = 'opacity 250ms';
                        imgEl.style.opacity = '0';
                        setTimeout(() => {
                            onDone();
                            requestAnimationFrame(() => {
                                imgEl.style.opacity = '1';
                                setTimeout(() => { imgEl.style.transition = ''; }, 300);
                            });
                        }, 250);
                    } else {
                        onDone();
                    }
                }
                break;
        }
    }

    // -- Puzzle Background Transition --

    function transitionPuzzleBg(stateIndex) {
        if (!activeContainer || !activePuzzle) return;
        const bgWrap = activeContainer.parentElement;
        if (!bgWrap) return;
        const oldImg = bgWrap.querySelector('.puzzle-overlay-bg-img');
        if (!oldImg) return;

        const state = activePuzzle.states ? activePuzzle.states[stateIndex] : null;
        if (!state || !state.backgroundImage) return;

        // Update active state reference immediately
        activeState = state;

        const newImg = document.createElement('img');
        newImg.className = 'puzzle-overlay-bg-img fading-in';
        newImg.src = state.backgroundImage;
        bgWrap.insertBefore(newImg, oldImg.nextSibling);

        requestAnimationFrame(() => {
            oldImg.classList.add('fading-out');
            newImg.classList.add('visible');
        });

        newImg.addEventListener('transitionend', () => {
            oldImg.remove();
            newImg.classList.remove('fading-in', 'visible');
            // Re-render assets for the new state
            renderAssets(activePuzzle, activeContainer, activeEditMode, stateIndex);
            // Re-enable Continue button if new state has assets
            const continueBtn = document.getElementById('puzzle-continue-btn');
            if (continueBtn && state.assets && state.assets.length > 0) {
                continueBtn.textContent = 'Continue';
                continueBtn.disabled = false;
                continueBtn.classList.remove('solved');
            }
            // Re-init puzzle hotspots for the new state
            if (typeof PuzzleHotspotEditor !== 'undefined') {
                const hotspotSvg = bgWrap.querySelector('.puzzle-hotspot-svg');
                const overlayEl = document.getElementById('puzzle-overlay');
                if (hotspotSvg && state) {
                    PuzzleHotspotEditor.init(state, hotspotSvg, bgWrap, overlayEl, activeEditMode, activePuzzle);
                }
            }
        }, { once: true });
    }

    // -- Asset Config Popover --

    function showAssetPopover(asset, anchorEl) {
        closeAssetPopover();

        const overlayEl = document.getElementById('puzzle-overlay');
        if (!overlayEl) return;

        const typeDef = assetTypes[asset.type];
        const rect = anchorEl.getBoundingClientRect();

        // Determine if asset is in a group
        const group = asset.groupId && activePuzzle
            ? (activeState ? activeState.assetGroups || [] : []).find(g => g.id === asset.groupId)
            : null;

        // The action/requires/flag target is the group (if grouped) or asset (if solo)
        const actionTarget = group || asset;

        popoverEl = document.createElement('div');
        popoverEl.className = 'puzzle-asset-popover';
        popoverEl.style.position = 'fixed';
        popoverEl.style.left = (rect.right + 10) + 'px';
        popoverEl.style.top = rect.top + 'px';
        popoverEl.style.zIndex = '400';

        const definedFlags = GameState.getDefinedFlags();
        const typeFieldsHtml = typeDef && typeDef.popoverFields ? typeDef.popoverFields(asset) : '';

        // Group info section
        let groupHtml = '';
        if (group) {
            groupHtml = `
                <div class="popover-field">
                    <label>Group</label>
                    <input class="panel-input" id="asset-pop-group-name" value="${group.name}" placeholder="group_name">
                </div>`;
        }

        const puzzleStates = activePuzzle ? activePuzzle.states || [] : [];

        popoverEl.innerHTML = `
            <div class="popover-header">
                <span class="popover-title">Asset Config</span>
                <button class="popover-close">&times;</button>
            </div>
            <div class="popover-field">
                <label>Name</label>
                <input class="panel-input" id="asset-pop-name" value="${asset.name}" placeholder="asset_name">
            </div>
            ${typeFieldsHtml}
            ${groupHtml}
            <div id="asset-pop-auto-flag" class="auto-flag-label"></div>
            <div class="popover-field">
                <label>Requires</label>
                <div class="requires-dropdown" id="asset-pop-requires">
                    ${definedFlags.map(f => `
                        <label class="requires-option">
                            <input type="checkbox" value="${f}" ${(actionTarget.requires || []).includes(f) ? 'checked' : ''}>
                            ${f}
                        </label>
                    `).join('')}
                </div>
            </div>
            ${ActionConfig.renderDropdown(actionTarget, 'asset-pop')}
            ${ActionConfig.renderStateChangeToggle(actionTarget, 'asset-pop', puzzleStates)}
            ${ActionConfig.renderLoopToggle(actionTarget, 'asset-pop')}
            ${ActionConfig.renderSoundToggle(actionTarget, 'asset-pop')}
            ${ActionConfig.renderAssetChangeToggle(actionTarget, 'asset-pop')}
            <div class="popover-field">
                <label><input type="checkbox" id="asset-pop-clear-after" ${actionTarget.clearAfterClick ? 'checked' : ''}> Clear after click</label>
            </div>
            <div style="margin-top:8px; display:flex; gap:6px;">
                <button class="panel-btn danger" id="asset-pop-delete">Delete</button>
                ${group ? '<button class="panel-btn danger" id="asset-pop-disconnect">Disconnect</button>' : ''}
            </div>
        `;

        overlayEl.appendChild(popoverEl);

        // Close
        popoverEl.querySelector('.popover-close').addEventListener('click', closeAssetPopover);

        // Name (always per-asset)
        const nameInput = popoverEl.querySelector('#asset-pop-name');
        nameInput.addEventListener('input', () => {
            asset.name = nameInput.value;
            updatePopoverAutoFlag(asset, group);
        });

        // Group name
        if (group) {
            const groupNameInput = popoverEl.querySelector('#asset-pop-group-name');
            if (groupNameInput) {
                groupNameInput.addEventListener('input', () => {
                    group.name = groupNameInput.value;
                    updatePopoverAutoFlag(asset, group);
                });
            }
        }

        // Type-specific popover bindings
        if (typeDef && typeDef.bindPopover) {
            const getEl = () => activeContainer ? activeContainer.querySelector(`[data-asset-id="${asset.id}"]`) : null;
            typeDef.bindPopover(popoverEl, asset, getEl);
        }

        // Requires checkboxes (bound to actionTarget)
        popoverEl.querySelectorAll('#asset-pop-requires input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => {
                actionTarget.requires = Array.from(popoverEl.querySelectorAll('#asset-pop-requires input:checked')).map(c => c.value);
            });
        });

        ActionConfig.bindDropdown(popoverEl, actionTarget, 'asset-pop');
        ActionConfig.bindStateChangeToggle(popoverEl, actionTarget, 'asset-pop');
        ActionConfig.bindLoopToggle(popoverEl, actionTarget, 'asset-pop');
        ActionConfig.bindSoundToggle(popoverEl, actionTarget, 'asset-pop');
        ActionConfig.bindAssetChangeToggle(popoverEl, actionTarget, 'asset-pop');

        const clearCb = popoverEl.querySelector('#asset-pop-clear-after');
        if (clearCb) {
            clearCb.addEventListener('change', () => { actionTarget.clearAfterClick = clearCb.checked; });
        }

        updatePopoverAutoFlag(asset, group);

        // Delete asset
        popoverEl.querySelector('#asset-pop-delete').addEventListener('click', () => {
            if (!activePuzzle) return;
            if (asset.groupId) disconnectAsset(asset);
            if (activeState) activeState.assets = (activeState.assets || []).filter(a => a.id !== asset.id);
            closeAssetPopover();
            renderAssets(activePuzzle, activeContainer, activeEditMode);
            if (onChangeCallback) onChangeCallback();
        });

        // Disconnect from group
        const disconnectBtn = popoverEl.querySelector('#asset-pop-disconnect');
        if (disconnectBtn) {
            disconnectBtn.addEventListener('click', () => {
                disconnectAsset(asset);
                closeAssetPopover();
                renderAssets(activePuzzle, activeContainer, activeEditMode);
            });
        }

        // Keep popover on screen
        requestAnimationFrame(() => {
            if (!popoverEl) return;
            const popRect = popoverEl.getBoundingClientRect();
            if (popRect.right > window.innerWidth) {
                popoverEl.style.left = (rect.left - popRect.width - 10) + 'px';
            }
            if (popRect.bottom > window.innerHeight) {
                popoverEl.style.top = Math.max(10, window.innerHeight - popRect.height - 10) + 'px';
            }
        });
    }

    function updatePopoverAutoFlag(asset, group) {
        const el = popoverEl ? popoverEl.querySelector('#asset-pop-auto-flag') : null;
        if (!el) return;
        const flag = group ? getGroupAutoFlag(group) : getAutoFlag(asset);
        const nameSource = group ? 'group' : 'asset';
        if (flag) {
            el.innerHTML = `<span class="auto-flag-arrow">&rarr;</span> sets: <span class="auto-flag-name">${flag}</span>`;
        } else {
            el.innerHTML = `<span style="color:var(--text-secondary)">Name the ${nameSource} to generate a flag</span>`;
        }
    }

    function closeAssetPopover() {
        if (popoverEl) {
            popoverEl.remove();
            popoverEl = null;
        }
    }

    // -- Placement Mode --

    function startPlacing(type) {
        placingType = type;
    }

    function stopPlacing() {
        placingType = null;
    }

    function isPlacing() {
        return placingType !== null;
    }

    function getPlacingType() {
        return placingType;
    }

    // -- Reset runtime state --

    function resetRuntime(puzzle) {
        if (!puzzle || !puzzle.states) return;
        for (const state of puzzle.states) {
            for (const asset of (state.assets || [])) {
                const typeDef = assetTypes[asset.type];
                if (typeDef && typeDef.resetRuntime) {
                    typeDef.resetRuntime(asset);
                }
                delete asset._solved;
            }
        }
    }

    return {
        registerType,
        getAssetTypes, createAsset, renderPreview, getAutoFlag, getGroupAutoFlag,
        renderAssets, showAssetPopover, closeAssetPopover,
        startPlacing, stopPlacing, isPlacing, getPlacingType,
        startConnecting, stopConnecting, isConnecting,
        toggleConnectAsset, getConnectSelection, createGroup,
        attemptSolve, resetRuntime,
        dispatchActionObj,
        set onChange(fn) { onChangeCallback = fn; }
    };
})();
