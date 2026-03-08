const SceneManager = (() => {
    let scenes = [];
    let currentSceneId = null;

    function createScene(name, backgroundData, fileName) {
        const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '_' + Date.now();
        const scene = {
            id,
            name,
            states: [{
                background: fileName || null,
                backgroundData: backgroundData || null,
                hotspots: []
            }],
            editingStateIndex: 0,
            music: null,
            sceneAssets: [],
            hotspotConnections: []
        };
        scenes.push(scene);
        currentSceneId = id;
        return scene;
    }

    function removeScene(id) {
        scenes = scenes.filter(s => s.id !== id);
        if (currentSceneId === id) {
            currentSceneId = scenes.length > 0 ? scenes[0].id : null;
            const scene = getCurrentScene();
            if (scene) {
                const state = getCurrentState(scene);
                if (state && state.backgroundData) {
                    Canvas.loadImage(state.backgroundData);
                } else {
                    Canvas.render();
                }
            } else {
                Canvas.render();
            }
        }
    }

    function renameScene(id, newName) {
        const scene = getScene(id);
        if (scene) scene.name = newName;
    }

    function getCurrentScene() {
        return scenes.find(s => s.id === currentSceneId) || null;
    }

    function getScene(id) {
        return scenes.find(s => s.id === id) || null;
    }

    function getAllScenes() {
        return scenes;
    }

    // Get the active state for a scene (editor uses editingStateIndex)
    function getCurrentState(scene) {
        if (!scene || !scene.states || scene.states.length === 0) return null;
        const idx = scene.editingStateIndex || 0;
        return scene.states[idx] || scene.states[0];
    }

    // Get state by index for play mode
    function getState(scene, index) {
        if (!scene || !scene.states) return null;
        return scene.states[index] || scene.states[0];
    }

    function getStateCount(scene) {
        return scene && scene.states ? scene.states.length : 0;
    }

    function getStateName(state, index) {
        return (state && state.name) || (state && state.background) || ('State ' + (index + 1));
    }

    function renameState(sceneId, stateIdx, name) {
        const scene = getScene(sceneId);
        if (!scene || !scene.states[stateIdx]) return;
        scene.states[stateIdx].name = name || null;
    }

    // -- Hotspot Connections --

    function addConnection(sceneId, hotspotIds) {
        const scene = getScene(sceneId);
        if (!scene) return null;
        if (!scene.hotspotConnections) scene.hotspotConnections = [];
        const id = 'conn_' + Date.now();
        scene.hotspotConnections.push({ id, hotspotIds: [...hotspotIds] });
        return id;
    }

    function removeConnection(sceneId, connId) {
        const scene = getScene(sceneId);
        if (!scene || !scene.hotspotConnections) return;
        scene.hotspotConnections = scene.hotspotConnections.filter(c => c.id !== connId);
    }

    function getConnections(sceneId) {
        const scene = getScene(sceneId);
        return (scene && scene.hotspotConnections) || [];
    }

    function getConnectionsForHotspot(sceneId, hotspotId) {
        const scene = getScene(sceneId);
        if (!scene || !scene.hotspotConnections) return [];
        return scene.hotspotConnections.filter(c => c.hotspotIds.includes(hotspotId));
    }

    function addState(sceneId, backgroundData, fileName) {
        const scene = getScene(sceneId);
        if (!scene) return;

        // Each state gets its own independent hotspots
        const copiedHotspots = [];

        const prevIdx = scene.editingStateIndex || 0;

        scene.states.push({
            name: null,
            background: fileName || null,
            backgroundData: backgroundData || null,
            hotspots: copiedHotspots
        });

        const newIdx = scene.states.length - 1;

        // Copy statePositions for existing assets
        if (scene.sceneAssets) {
            for (const a of scene.sceneAssets) {
                if (!a.statePositions) a.statePositions = {};
                const srcPos = a.statePositions[prevIdx] || { x: a.x, y: a.y, width: a.width, height: a.height };
                a.statePositions[newIdx] = { ...srcPos };
            }
        }

        // Switch to the new state
        scene.editingStateIndex = newIdx;
    }

    function removeState(sceneId, stateIndex) {
        const scene = getScene(sceneId);
        if (!scene || scene.states.length <= 1) return; // keep at least one
        scene.states.splice(stateIndex, 1);
        if (scene.editingStateIndex >= scene.states.length) {
            scene.editingStateIndex = scene.states.length - 1;
        }
        // Adjust scene asset visibleStates and statePositions
        if (scene.sceneAssets) {
            for (const a of scene.sceneAssets) {
                a.visibleStates = a.visibleStates
                    .filter(i => i !== stateIndex)
                    .map(i => i > stateIndex ? i - 1 : i);
                if (a.statePositions) {
                    const newPositions = {};
                    for (const key of Object.keys(a.statePositions)) {
                        const k = parseInt(key);
                        if (k === stateIndex) continue;
                        newPositions[k > stateIndex ? k - 1 : k] = a.statePositions[key];
                    }
                    a.statePositions = newPositions;
                }
            }
        }
    }

    function setEditingState(sceneId, index) {
        const scene = getScene(sceneId);
        if (!scene) return;
        if (index < 0 || index >= scene.states.length) return;
        scene.editingStateIndex = index;
        HotspotEditor.closePopover();
        const state = scene.states[index];
        if (state && state.backgroundData) {
            Canvas.loadImage(state.backgroundData);
        }
        Canvas.render();
    }

    function switchScene(id) {
        const scene = getScene(id);
        if (!scene) return;
        currentSceneId = id;
        HotspotEditor.closePopover();

        // In play mode, use runtime state; in edit mode, use editingStateIndex
        let stateIdx = scene.editingStateIndex || 0;
        if (typeof PlayMode !== 'undefined' && PlayMode.isActive()) {
            stateIdx = GameState.getSceneState(id);
        }
        const state = scene.states[stateIdx] || scene.states[0];
        if (state && state.backgroundData) {
            Canvas.loadImage(state.backgroundData);
        }
        Canvas.render();
        renderSceneList();
        renderSceneAssetList();
    }

    function renderSceneList() {
        const container = document.getElementById('scene-list');
        if (!container) return;

        if (scenes.length === 0) {
            container.innerHTML = '<span class="panel-label" style="color:var(--text-secondary); padding:8px 0;">No scenes loaded. Click "+ Add Scene" to get started.</span>';
            return;
        }

        container.innerHTML = scenes.map(s => {
            const stateIdx = s.editingStateIndex || 0;
            const state = s.states[stateIdx] || s.states[0];
            const stateCount = s.states.length;
            const hotspotCount = state ? state.hotspots.length : 0;

            return `
            <div class="scene-card ${s.id === currentSceneId ? 'active' : ''}" data-id="${s.id}" draggable="true">
                <div class="scene-thumb">
                    ${state && state.backgroundData
                        ? `<img src="${state.backgroundData}" alt="${s.name}" draggable="false">`
                        : '<span class="scene-thumb-empty">No image</span>'}
                </div>
                <div class="scene-card-info">
                    <input class="scene-card-name" value="${s.name}" data-id="${s.id}" spellcheck="false">
                    <span class="scene-card-meta">${hotspotCount} hotspot${hotspotCount !== 1 ? 's' : ''}${stateCount > 1 ? ' · ' + getStateName(state, stateIdx) + ' (' + (stateIdx + 1) + '/' + stateCount + ')' : ''}</span>
                    ${stateCount > 1 ? `
                    <div class="scene-state-nav">
                        <input class="scene-state-name-input" value="${state.name || ''}"
                               data-id="${s.id}" data-state-idx="${stateIdx}" placeholder="${state.background || ('State ' + (stateIdx + 1))}" spellcheck="false">
                        <button class="scene-state-btn scene-state-prev" data-id="${s.id}" title="Previous state">&larr;</button>
                        <button class="scene-state-btn scene-state-next" data-id="${s.id}" title="Next state">&rarr;</button>
                        <button class="scene-state-btn scene-state-remove" data-id="${s.id}" title="Remove this state">&times;</button>
                    </div>` : ''}
                </div>
                <div class="scene-card-actions">
                    <button class="scene-card-music ${s.music ? 'has-audio' : ''}" data-id="${s.id}" title="${s.music ? s.music : 'Set music'}">&#9835;</button>
                    <input type="file" class="scene-music-input" data-id="${s.id}" accept="audio/*,.enc" style="display:none">
                    <button class="scene-card-edit-bg" data-id="${s.id}" title="Change background image">Edit</button>
                    <button class="scene-card-add-state" data-id="${s.id}" title="Add state">+State</button>
                    <button class="scene-card-delete" data-id="${s.id}" title="Remove scene">&times;</button>
                </div>
            </div>`;
        }).join('');

        // Drag and drop reordering
        let dragId = null;
        container.querySelectorAll('.scene-card').forEach(card => {
            card.addEventListener('dragstart', (e) => {
                dragId = card.dataset.id;
                card.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                container.querySelectorAll('.scene-card').forEach(c => c.classList.remove('drag-over'));
                dragId = null;
            });

            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (card.dataset.id !== dragId) {
                    container.querySelectorAll('.scene-card').forEach(c => c.classList.remove('drag-over'));
                    card.classList.add('drag-over');
                }
            });

            card.addEventListener('dragleave', () => {
                card.classList.remove('drag-over');
            });

            card.addEventListener('drop', (e) => {
                e.preventDefault();
                card.classList.remove('drag-over');
                if (!dragId || dragId === card.dataset.id) return;
                const fromIdx = scenes.findIndex(s => s.id === dragId);
                const toIdx = scenes.findIndex(s => s.id === card.dataset.id);
                if (fromIdx < 0 || toIdx < 0) return;
                const [moved] = scenes.splice(fromIdx, 1);
                scenes.splice(toIdx, 0, moved);
                renderSceneList();
            });
        });

        // Click card to switch scene
        container.querySelectorAll('.scene-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.scene-card-delete') ||
                    e.target.closest('.scene-card-add-state') ||
                    e.target.closest('.scene-card-edit-bg') ||
                    e.target.closest('.scene-card-music') ||
                    e.target.closest('.scene-state-nav') ||
                    e.target.classList.contains('scene-card-name')) return;
                switchScene(card.dataset.id);
            });
        });

        // Rename inline
        container.querySelectorAll('.scene-card-name').forEach(input => {
            input.addEventListener('change', () => {
                renameScene(input.dataset.id, input.value.trim());
            });
        });

        // Set music
        container.querySelectorAll('.scene-card-music').forEach(btn => {
            btn.addEventListener('click', () => {
                const fileInput = container.querySelector(`.scene-music-input[data-id="${btn.dataset.id}"]`);
                if (fileInput) fileInput.click();
            });
        });
        container.querySelectorAll('.scene-music-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const scene = getScene(input.dataset.id);
                if (scene) {
                    scene.music = 'assets/audio/' + file.name;
                    renderSceneList();
                }
                input.value = '';
            });
        });

        // Delete scene
        container.querySelectorAll('.scene-card-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                removeScene(btn.dataset.id);
                renderSceneList();
            });
        });

        // Add state
        container.querySelectorAll('.scene-card-add-state').forEach(btn => {
            btn.addEventListener('click', () => {
                const sceneId = btn.dataset.id;
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const path = 'assets/scenes/' + file.name;
                    addState(sceneId, path, file.name);
                    if (currentSceneId === sceneId) {
                        const scene = getScene(sceneId);
                        const state = getCurrentState(scene);
                        if (state && state.backgroundData) {
                            Canvas.loadImage(state.backgroundData);
                        }
                        Canvas.render();
                    }
                    renderSceneList();
                });
                input.click();
            });
        });

        // State navigation — previous
        container.querySelectorAll('.scene-state-prev').forEach(btn => {
            btn.addEventListener('click', () => {
                const scene = getScene(btn.dataset.id);
                if (!scene) return;
                const newIdx = (scene.editingStateIndex || 0) - 1;
                if (newIdx >= 0) {
                    setEditingState(scene.id, newIdx);
                    renderSceneList();
                }
            });
        });

        // State navigation — next
        container.querySelectorAll('.scene-state-next').forEach(btn => {
            btn.addEventListener('click', () => {
                const scene = getScene(btn.dataset.id);
                if (!scene) return;
                const newIdx = (scene.editingStateIndex || 0) + 1;
                if (newIdx < scene.states.length) {
                    setEditingState(scene.id, newIdx);
                    renderSceneList();
                }
            });
        });

        // Remove current state
        container.querySelectorAll('.scene-state-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                const scene = getScene(btn.dataset.id);
                if (!scene || scene.states.length <= 1) return;
                removeState(scene.id, scene.editingStateIndex || 0);
                // Reload the now-active state's background
                const state = getCurrentState(scene);
                if (state && state.backgroundData) {
                    Canvas.loadImage(state.backgroundData);
                }
                Canvas.render();
                renderSceneList();
            });
        });

        // State name editing
        container.querySelectorAll('.scene-state-name-input').forEach(input => {
            input.addEventListener('change', () => {
                renameState(input.dataset.id, parseInt(input.dataset.stateIdx), input.value.trim());
            });
        });

        // Edit background image for current state
        container.querySelectorAll('.scene-card-edit-bg').forEach(btn => {
            btn.addEventListener('click', () => {
                const scene = getScene(btn.dataset.id);
                if (!scene) return;
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const state = getCurrentState(scene);
                    if (!state) return;
                    const path = 'assets/scenes/' + file.name;
                    state.backgroundData = path;
                    state.background = file.name;
                    if (currentSceneId === scene.id) {
                        Canvas.loadImage(state.backgroundData);
                        Canvas.render();
                    }
                    renderSceneList();
                });
                input.click();
            });
        });
    }

    function exportJSON() {
        const data = {
            scenes: scenes.map(s => ({
                id: s.id,
                name: s.name,
                states: s.states,
                editingStateIndex: s.editingStateIndex || 0,
                music: s.music || null,
                sceneAssets: s.sceneAssets || []
            })),
            items: InventoryEditor.getAllItems(),
            puzzles: PuzzleEditor.getAllPuzzles(),
            gameState: GameState.getDefinedFlags(),
            progressionSteps: GameState.getSteps(),
            blueprint: BlueprintEditor.getBlueprintData(),
            ideogramData: IdeogramEditor.getIdeogramData(),
            ruinscopeData: RuinscopeEditor.getRuinscopeData(),
            lemmingsData: LemmingsEditor.getLemmingsData(),
            puzzleAssets: PuzzleAssetLibrary.getData()
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'parallax-project.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    function importJSON(json) {
        const data = typeof json === 'string' ? JSON.parse(json) : json;
        if (data.scenes) {
            scenes = data.scenes.map(s => {
                // Migrate old format: no states array
                if (!s.states) {
                    return {
                        id: s.id,
                        name: s.name,
                        states: [{
                            background: s.background || null,
                            backgroundData: s.backgroundData || null,
                            hotspots: s.hotspots || []
                        }],
                        editingStateIndex: 0
                    };
                }
                if (!s.sceneAssets) s.sceneAssets = [];
                if (!s.hotspotConnections) s.hotspotConnections = [];
                // Migrate asset properties for older saves
                s.sceneAssets = s.sceneAssets.map(a => {
                    if (!a.visibleStates) a.visibleStates = s.states.map((_, i) => i);
                    if (a.placed === undefined) a.placed = false;
                    if (a.layer === undefined) a.layer = 0;
                    if (!a.linkedItem) a.linkedItem = null;
                    if (!a.transition) a.transition = null;
                    if (a.lockPosition === undefined) a.lockPosition = false;
                    if (!a.statePositions) {
                        a.statePositions = {};
                        s.states.forEach((_, i) => {
                            a.statePositions[i] = { x: a.x, y: a.y, width: a.width, height: a.height };
                        });
                    }
                    return a;
                });
                return s;
            });
            if (scenes.length > 0) {
                switchScene(scenes[0].id);
            }
        }
        if (data.items) {
            InventoryEditor.loadItems(data.items);
        }
        if (data.puzzles) {
            PuzzleEditor.loadPuzzles(data.puzzles);
        }
        if (data.progressionSteps) {
            GameState.loadSteps(data.progressionSteps);
        }
        if (data.blueprint) {
            BlueprintEditor.loadBlueprintData(data.blueprint);
        }
        if (data.ideogramData) {
            IdeogramEditor.loadIdeogramData(data.ideogramData);
        }
        if (data.ruinscopeData) {
            RuinscopeEditor.loadRuinscopeData(data.ruinscopeData);
        }
        if (data.lemmingsData) {
            LemmingsEditor.loadLemmingsData(data.lemmingsData);
        } else if (data.prismaticData || data.clockworkData) {
            LemmingsEditor.loadLemmingsData({
                prismatics: data.prismaticData ? data.prismaticData.prismatics : [],
                clockworks: data.clockworkData ? data.clockworkData.clockworks : []
            });
        }
        if (data.puzzleAssets) {
            PuzzleAssetLibrary.loadData(data.puzzleAssets);
        }
        renderSceneList();
    }

    // ── Scene Asset Cards ──

    function renderSceneAssetList() {
        const container = document.getElementById('scene-asset-list');
        if (!container) return;

        const scene = getCurrentScene();
        if (!scene || !scene.sceneAssets || scene.sceneAssets.length === 0) {
            container.innerHTML = '';
            return;
        }

        const stateIdx = scene.editingStateIndex || 0;
        const stateCount = scene.states.length;

        container.innerHTML = scene.sceneAssets.map(asset => {
            const pos = Canvas.getAssetStatePos(asset, stateIdx);
            return `
            <div class="scene-card scene-asset-card" data-asset-id="${asset.id}">
                <div class="scene-thumb">
                    <img src="${asset.imageData || asset.src}" alt="${asset.name}" draggable="false">
                </div>
                <div class="scene-card-info">
                    <input class="scene-card-name scene-asset-name" value="${asset.name}"
                           data-asset-id="${asset.id}" spellcheck="false">
                    <span class="scene-card-meta">${Math.round(pos.width)} × ${Math.round(pos.height)} · L${asset.layer || 0}${asset.placed ? ' · Placed' : ''}</span>
                    <div class="scene-asset-states">
                        ${scene.states.map((st, i) => `
                            <label class="scene-asset-state-check">
                                <input type="checkbox" data-asset-id="${asset.id}"
                                       data-state-idx="${i}"
                                       ${asset.visibleStates.includes(i) ? 'checked' : ''}>
                                <span>${getStateName(st, i).substring(0, 12)}</span>${asset.lockPosition && (asset.lockPositionState || 0) === i ? '<span class="asset-lock-icon" title="Locked position state">&#x1F512;</span>' : ''}
                            </label>
                        `).join('')}
                    </div>
                    ${stateCount > 1 ? `
                    <div class="scene-state-nav scene-asset-pos-nav">
                        <span class="scene-card-meta">Pos: S${stateIdx + 1}/${stateCount}</span>
                        <button class="scene-state-btn scene-asset-pos-prev" data-asset-id="${asset.id}" title="Previous state position">&larr;</button>
                        <button class="scene-state-btn scene-asset-pos-next" data-asset-id="${asset.id}" title="Next state position">&rarr;</button>
                    </div>` : ''}
                </div>
                <div class="scene-card-actions" style="flex-shrink:0">
                    <button class="scene-card-edit scene-asset-edit"
                            data-asset-id="${asset.id}" title="Change image">Edit</button>
                    <button class="scene-card-add-state scene-asset-add-state"
                            data-asset-id="${asset.id}" title="Add state">+State</button>
                    <button class="scene-card-delete scene-asset-delete"
                            data-asset-id="${asset.id}" title="Remove asset">&times;</button>
                </div>
            </div>`;
        }).join('');

        bindAssetCardEvents(container, scene);
    }

    function bindAssetCardEvents(container, scene) {
        // Rename
        container.querySelectorAll('.scene-asset-name').forEach(input => {
            input.addEventListener('change', () => {
                const asset = scene.sceneAssets.find(a => a.id === input.dataset.assetId);
                if (asset) asset.name = input.value;
            });
        });

        // State checkboxes
        container.querySelectorAll('.scene-asset-state-check input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => {
                const asset = scene.sceneAssets.find(a => a.id === cb.dataset.assetId);
                if (!asset) return;
                const idx = parseInt(cb.dataset.stateIdx);
                if (cb.checked) {
                    if (!asset.visibleStates.includes(idx)) asset.visibleStates.push(idx);
                    // Auto-initialize position from current state
                    if (!asset.statePositions) asset.statePositions = {};
                    if (!asset.statePositions[idx]) {
                        const curIdx = scene.editingStateIndex || 0;
                        const curPos = asset.statePositions[curIdx] || { x: asset.x, y: asset.y, width: asset.width, height: asset.height };
                        asset.statePositions[idx] = { ...curPos };
                    }
                } else {
                    asset.visibleStates = asset.visibleStates.filter(i => i !== idx);
                }
                Canvas.render();
            });
        });

        // Delete
        container.querySelectorAll('.scene-asset-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = scene.sceneAssets.findIndex(a => a.id === btn.dataset.assetId);
                if (idx !== -1) {
                    if (scene.sceneAssets[idx].imageData) URL.revokeObjectURL(scene.sceneAssets[idx].imageData);
                    scene.sceneAssets.splice(idx, 1);
                    Canvas.selectSceneAsset(null);
                    renderSceneAssetList();
                    Canvas.render();
                }
            });
        });

        // Edit (re-select image)
        container.querySelectorAll('.scene-asset-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const asset = scene.sceneAssets.find(a => a.id === btn.dataset.assetId);
                if (!asset) return;
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.addEventListener('change', (ev) => {
                    const file = ev.target.files[0];
                    if (!file) return;
                    if (asset.imageData) URL.revokeObjectURL(asset.imageData);
                    const url = URL.createObjectURL(file);
                    asset.src = 'assets/items/' + file.name;
                    asset.imageData = url;
                    const img = new Image();
                    img.onload = () => {
                        asset.naturalWidth = img.naturalWidth;
                        asset.naturalHeight = img.naturalHeight;
                        Canvas.loadAssetImage(url).then(() => {
                            renderSceneAssetList();
                            Canvas.render();
                        });
                    };
                    img.src = url;
                });
                input.click();
            });
        });

        // Click card to select on canvas
        container.querySelectorAll('.scene-asset-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.scene-asset-delete') || e.target.closest('.scene-asset-edit') || e.target.closest('.scene-asset-name') || e.target.closest('.scene-asset-state-check') || e.target.closest('.scene-asset-pos-nav') || e.target.closest('.scene-asset-add-state')) return;
                const asset = scene.sceneAssets.find(a => a.id === card.dataset.assetId);
                if (asset) {
                    Canvas.selectSceneAsset(asset);
                }
            });
        });

        // Asset position state nav
        container.querySelectorAll('.scene-asset-pos-prev').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = (scene.editingStateIndex || 0) - 1;
                if (idx >= 0) {
                    setEditingState(scene.id, idx);
                    renderSceneList();
                    renderSceneAssetList();
                }
            });
        });
        container.querySelectorAll('.scene-asset-pos-next').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = (scene.editingStateIndex || 0) + 1;
                if (idx < scene.states.length) {
                    setEditingState(scene.id, idx);
                    renderSceneList();
                    renderSceneAssetList();
                }
            });
        });

        // Asset +State button
        container.querySelectorAll('.scene-asset-add-state').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.addEventListener('change', (ev) => {
                    const file = ev.target.files[0];
                    if (!file) return;
                    const path = 'assets/scenes/' + file.name;
                    addState(scene.id, path, file.name);
                    const st = getCurrentState(scene);
                    if (st && st.backgroundData) Canvas.loadImage(st.backgroundData);
                    Canvas.render();
                    renderSceneList();
                    renderSceneAssetList();
                });
                input.click();
            });
        });
    }

    function initToolbar() {
        const addBtn = document.getElementById('scene-add');
        const fileInput = document.getElementById('scene-file-input');

        renderSceneList();

        addBtn.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (files.length === 0) return;
            const basePath = 'assets/scenes';

            let lastScene = null;
            files.forEach(file => {
                const name = file.name.replace(/\.[^.]+$/, '');
                const path = basePath + '/' + file.name;
                lastScene = createScene(name, path, file.name);
            });
            if (lastScene) {
                switchScene(lastScene.id);
                renderSceneList();
            }
            fileInput.value = '';
        });

        // Add Asset button
        const addAssetBtn = document.getElementById('scene-asset-add');
        const assetFileInput = document.getElementById('scene-asset-file-input');
        if (addAssetBtn && assetFileInput) {
            addAssetBtn.addEventListener('click', () => {
                if (!currentSceneId) return;
                assetFileInput.click();
            });
            assetFileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const scene = getCurrentScene();
                if (!scene) return;
                const url = URL.createObjectURL(file);
                const img = new Image();
                img.onload = () => {
                    const defaultPos = { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight };
                    const statePositions = {};
                    scene.states.forEach((_, i) => { statePositions[i] = { ...defaultPos }; });

                    const asset = {
                        id: 'scene_asset_' + Date.now(),
                        name: file.name.replace(/\.[^.]+$/, ''),
                        src: 'assets/items/' + file.name,
                        imageData: url,
                        x: 0, y: 0,
                        width: img.naturalWidth,
                        height: img.naturalHeight,
                        naturalWidth: img.naturalWidth,
                        naturalHeight: img.naturalHeight,
                        visibleStates: scene.states.map((_, i) => i),
                        placed: false,
                        layer: 0,
                        linkedItem: null,
                        statePositions
                    };
                    if (!scene.sceneAssets) scene.sceneAssets = [];
                    scene.sceneAssets.push(asset);
                    Canvas.loadAssetImage(url).then(() => {
                        renderSceneAssetList();
                        Canvas.render();
                    });
                };
                img.src = url;
                assetFileInput.value = '';
            });
        }
    }

    return {
        createScene, removeScene, renameScene,
        getCurrentScene, getScene, getAllScenes,
        getCurrentState, getState, getStateCount,
        getStateName, renameState,
        addState, removeState, setEditingState,
        addConnection, removeConnection, getConnections, getConnectionsForHotspot,
        switchScene, renderSceneList, renderSceneAssetList,
        exportJSON, importJSON, initToolbar
    };
})();
