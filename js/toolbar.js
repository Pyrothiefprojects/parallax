const Toolbar = (() => {
    let activeSection = null;
    const floatPanel = document.getElementById('toolbar-panel');
    const floatBody = document.getElementById('float-panel-body');
    const floatTitle = document.getElementById('float-panel-title');
    const floatHeader = document.getElementById('float-panel-header');
    const floatClose = document.getElementById('float-panel-close');
    const toolbarEl = document.getElementById('toolbar');
    const modeToggle = document.getElementById('mode-toggle');
    const viewport = document.getElementById('viewport');
    const editorSections = document.getElementById('editor-sections');
    const playInventoryBtn = document.getElementById('play-inventory-btn');
    const playHintBtn = document.getElementById('play-hint-btn');
    const loadBtn = document.getElementById('load-btn');
    const exportBtn = document.getElementById('export-btn');
    const jsonInput = document.getElementById('json-file-input');
    const playOverlayControls = document.getElementById('play-overlay-controls');
    const playOverlayEdit = document.getElementById('play-overlay-edit');
    const playOverlayHint = document.getElementById('play-overlay-hint');
    const playOverlayInventory = document.getElementById('play-overlay-inventory');

    const sectionButtons = document.querySelectorAll('.toolbar-btn[data-section]');

    const sections = {
        scene: {
            render() {
                return `
                    <div class="panel-section visible" data-panel="scene">
                        <div class="scene-panel-top">
                            <span class="panel-label">Scenes</span>
                            <button id="scene-add" class="panel-btn primary">+ Add Scene</button>
                            <input id="scene-file-input" type="file" accept="image/*" multiple style="display:none">
                        </div>
                        <div id="scene-list" class="scene-list"></div>
                        <div class="scene-panel-top" style="margin-top:8px;">
                            <span class="panel-label">Scene Assets</span>
                            <button id="scene-asset-add" class="panel-btn primary">+ Add Asset</button>
                            <input id="scene-asset-file-input" type="file" accept="image/png,image/*" style="display:none">
                        </div>
                        <div id="scene-asset-list" class="scene-list"></div>
                        <div class="overlay-toggle-row" style="margin-top:8px;">
                            <label class="overlay-master-label">
                                <input type="checkbox" id="allow-delete-toggle"> Allow Delete
                            </label>
                        </div>
                        <div class="overlay-toggle-row" style="margin-top:4px;">
                            <label class="overlay-master-label">
                                <input type="checkbox" id="overlay-master-toggle"> Overlay All States
                            </label>
                            <div id="overlay-options" class="overlay-options hidden">
                                <label><input type="checkbox" id="overlay-hotspots" checked> Hotspots</label>
                                <label><input type="checkbox" id="overlay-assets"> Assets</label>
                            </div>
                        </div>
                    </div>
                `;
            },
            init() {
                SceneManager.initToolbar();
                SceneManager.renderSceneAssetList();

                const deleteToggle = document.getElementById('allow-delete-toggle');
                deleteToggle.addEventListener('change', () => {
                    document.getElementById('float-panel-body').classList.toggle('delete-enabled', deleteToggle.checked);
                });

                const masterToggle = document.getElementById('overlay-master-toggle');
                const options = document.getElementById('overlay-options');
                function updateOverlay() {
                    const active = masterToggle.checked;
                    options.classList.toggle('hidden', !active);
                    Canvas.setOverlayMode(active, {
                        hotspots: document.getElementById('overlay-hotspots')?.checked || false,
                        assets: document.getElementById('overlay-assets')?.checked || false
                    });
                }
                masterToggle.addEventListener('change', updateOverlay);
                document.getElementById('overlay-hotspots')?.addEventListener('change', updateOverlay);
                document.getElementById('overlay-assets')?.addEventListener('change', updateOverlay);
            }
        },
        hotspots: {
            render() {
                return `
                    <div class="panel-section visible" data-panel="hotspots">
                        <span class="panel-label">Hotspots</span>
                        <button id="hotspot-new" class="panel-btn primary">+ New Hotspot</button>
                        <button id="hotspot-undo" class="panel-btn">Undo Point</button>
                        <div class="panel-divider"></div>
                        <button id="hotspot-connect" class="panel-btn">Connect</button>
                        <span id="hotspot-connect-status" class="panel-label" style="color: var(--text-secondary); display:none;"></span>
                        <button id="hotspot-connect-confirm" class="panel-btn primary" style="display:none;" disabled>Confirm</button>
                        <button id="hotspot-connect-cancel" class="panel-btn" style="display:none;">Cancel</button>
                        <div class="panel-divider"></div>
                        <span id="hotspot-status" class="panel-label" style="color: var(--text-secondary)">No hotspot selected</span>
                    </div>
                `;
            },
            init() {
                HotspotEditor.initToolbar();
            }
        },
        inventory: {
            render() {
                return `
                    <div class="panel-section visible" data-panel="inventory">
                        <div class="scene-panel-top">
                            <span class="panel-label">Items</span>
                            <input id="item-name" class="panel-input" type="text" placeholder="Item name...">
                            <button id="item-load-img" class="panel-btn">Load Icon</button>
                            <button id="item-add" class="panel-btn primary">+ Add Item</button>
                            <input id="item-file-input" type="file" accept="image/*" style="display:none">
                        </div>
                        <div id="item-list" class="scene-list"></div>
                        <div class="overlay-toggle-row" style="margin-top:8px;">
                            <label class="overlay-master-label">
                                <input type="checkbox" id="inv-allow-delete-toggle"> Allow Delete
                            </label>
                        </div>
                    </div>
                `;
            },
            init() {
                InventoryEditor.initToolbar();

                const deleteToggle = document.getElementById('inv-allow-delete-toggle');
                deleteToggle.addEventListener('change', () => {
                    document.getElementById('float-panel-body').classList.toggle('delete-enabled', deleteToggle.checked);
                });
            }
        },
        puzzle: {
            render() {
                return `
                    <div class="panel-section visible" data-panel="puzzle">
                        <div class="gamestate-mode-toggle">
                            <button id="ideogram-toggle" class="panel-btn">Ideogram</button>
                        </div>
                        <div id="puzzle-standard-view">
                            <div class="scene-panel-top">
                                <span class="panel-label">Puzzles</span>
                                <input id="puzzle-name" class="panel-input" type="text" placeholder="Puzzle name...">
                                <button id="puzzle-load-bg" class="panel-btn">Load Background</button>
                                <button id="puzzle-add" class="panel-btn primary">+ Add Puzzle</button>
                                <input id="puzzle-file-input" type="file" accept="image/*" style="display:none">
                            </div>
                            <div id="puzzle-list" class="scene-list"></div>
                            <div id="puzzle-contents-list" class="scene-list"></div>
                            <div class="overlay-toggle-row" style="margin-top:8px;">
                                <label class="overlay-master-label">
                                    <input type="checkbox" id="puzzle-allow-delete-toggle"> Allow Delete
                                </label>
                            </div>
                        </div>
                        <div id="ideogram-view" class="hidden">
                            <div class="scene-panel-top" style="margin-bottom:6px;">
                                <span class="panel-label">Ideograms</span>
                                <button id="ideogram-new" class="panel-btn primary">+ New</button>
                            </div>
                            <div id="ideogram-card-list" class="scene-list"></div>
                            <div class="overlay-toggle-row" style="margin-top:8px;">
                                <label class="overlay-master-label">
                                    <input type="checkbox" id="ideogram-allow-delete-toggle"> Allow Delete
                                </label>
                            </div>
                        </div>
                    </div>
                `;
            },
            init() {
                PuzzleEditor.initToolbar();

                const deleteToggle = document.getElementById('puzzle-allow-delete-toggle');
                deleteToggle.addEventListener('change', () => {
                    document.getElementById('float-panel-body').classList.toggle('delete-enabled', deleteToggle.checked);
                });

                const ideogramDeleteToggle = document.getElementById('ideogram-allow-delete-toggle');
                ideogramDeleteToggle.addEventListener('change', () => {
                    document.getElementById('float-panel-body').classList.toggle('delete-enabled', ideogramDeleteToggle.checked);
                });

                // Ideogram toggle
                const ideogramToggle = document.getElementById('ideogram-toggle');
                const ideogramView = document.getElementById('ideogram-view');
                const puzzleStandardView = document.getElementById('puzzle-standard-view');

                ideogramToggle.addEventListener('click', () => {
                    if (IdeogramEditor.isActive()) {
                        IdeogramEditor.deactivate();
                        ideogramToggle.textContent = 'Ideogram';
                        puzzleStandardView.classList.remove('hidden');
                        ideogramView.classList.add('hidden');
                    } else {
                        IdeogramEditor.activate();
                        ideogramToggle.textContent = 'Scene';
                        puzzleStandardView.classList.add('hidden');
                        ideogramView.classList.remove('hidden');
                        refreshIdeogramList();
                    }
                });

                document.getElementById('ideogram-new').addEventListener('click', () => {
                    IdeogramEditor.createIdeogram('Untitled');
                    refreshIdeogramList();
                });
            }
        },
        image: {
            render() {
                return `
                    <div class="panel-section visible" data-panel="image">
                        <div class="scene-panel-top">
                            <span class="panel-label">Images</span>
                            <button id="image-load" class="panel-btn primary">+ Load Image</button>
                            <input id="image-file-input" type="file" accept="image/*" multiple style="display:none">
                        </div>
                        <div id="image-list" class="scene-list"></div>
                    </div>
                `;
            },
            init() {
                ImageEditor.initToolbar();
            }
        },
        gamestate: {
            render() {
                return `
                    <div class="panel-section visible" data-panel="gamestate">
                        <div class="gamestate-mode-toggle">
                            <button id="blueprint-toggle" class="panel-btn">Blueprint</button>
                        </div>
                        <div id="blueprint-view" class="hidden">
                            <div id="blueprint-elements-list" class="blueprint-list"></div>
                        </div>
                        <div id="gamestate-standard-view">
                        <div class="gamestate-columns">
                            <div class="gamestate-col">
                                <div class="gamestate-col-header">
                                    <span class="panel-label">Flags</span>
                                    <button id="state-reset" class="panel-btn danger">Reset</button>
                                </div>
                                <div id="flags-container" class="flags-container"></div>
                            </div>
                            <div class="gamestate-col gamestate-col-wide">
                                <div id="progression-container"></div>
                            </div>
                            <div class="gamestate-col">
                                <div id="overview-container"></div>
                            </div>
                        </div>
                        </div>
                    </div>
                `;
            },
            init() {
                GameState.initToolbar();

                const blueprintToggle = document.getElementById('blueprint-toggle');
                const blueprintView = document.getElementById('blueprint-view');
                const standardView = document.getElementById('gamestate-standard-view');

                blueprintToggle.addEventListener('click', () => {
                    if (BlueprintEditor.isActive()) {
                        BlueprintEditor.deactivate();
                        blueprintToggle.textContent = 'Blueprint';
                        blueprintView.classList.add('hidden');
                        standardView.classList.remove('hidden');
                    } else {
                        BlueprintEditor.activate();
                        blueprintToggle.textContent = 'Game State';
                        blueprintView.classList.remove('hidden');
                        standardView.classList.add('hidden');
                        refreshBlueprintList();
                    }
                });
            },
            refreshBlueprintList() {
                const listContainer = document.getElementById('blueprint-elements-list');
                if (!listContainer) return;

                const categories = BlueprintEditor.getCategorizedElements();
                const rooms = categories.rooms || [];
                const doors = categories.doors || [];
                const windows = categories.windows || [];
                const assets = categories.assets || [];
                const perspectives = categories.perspectives || [];
                const items = categories.items || [];

                // Get scenes for perspective labels
                const allScenes = typeof SceneManager !== 'undefined' ? SceneManager.getAllScenes() : [];

                let html = '';

                // Track which items are inside rooms
                const itemsInRooms = new Set();

                // Group by room
                rooms.forEach(room => {
                    // Find elements in this room
                    const roomAssets = assets.filter(a => {
                        return a.x >= room.x && a.x + a.width <= room.x + room.width &&
                               a.y >= room.y && a.y + a.height <= room.y + room.height;
                    });
                    const roomPerspectives = perspectives.filter(p => {
                        return p.x >= room.x && p.x + p.width <= room.x + room.width &&
                               p.y >= room.y && p.y + p.height <= room.y + room.height;
                    });
                    const roomWindows = windows.filter(w => {
                        // Check overlap
                        const overlapX = !(w.x + w.width < room.x || w.x > room.x + room.width);
                        const overlapY = !(w.y + w.height < room.y || w.y > room.y + room.height);
                        return overlapX && overlapY;
                    });
                    const roomItems = items.filter(item => {
                        const inside = item.x >= room.x && item.x + item.width <= room.x + room.width &&
                               item.y >= room.y && item.y + item.height <= room.y + room.height;
                        if (inside) itemsInRooms.add(item.id);
                        return inside;
                    });

                    const roomElements = [...roomAssets, ...roomPerspectives, ...roomWindows, ...roomItems];

                    html += `
                        <div class="blueprint-category">
                            <div class="blueprint-category-header blueprint-room-header" data-element-id="${room.id}">
                                ${room.label || 'Unnamed Room'}
                            </div>
                            <div class="blueprint-category-items">
                                ${roomElements.length > 0 ? roomElements.map(item => {
                                    let label = item.label || 'Unnamed';
                                    // For perspectives, show the inherited scene name
                                    if (item.type === 'perspective' && room.sceneId) {
                                        const scene = allScenes.find(s => s.id === room.sceneId);
                                        label = scene ? scene.name : 'No scene';
                                    }
                                    return `
                                        <div class="blueprint-list-item blueprint-list-subitem" data-element-id="${item.id}">
                                            <span class="blueprint-item-type">${item.type}</span>
                                            <span class="blueprint-item-label">${label}</span>
                                        </div>
                                    `;
                                }).join('') : '<div class="panel-label" style="color: var(--text-secondary); font-size: 11px; padding: 6px 12px;">No items</div>'}
                            </div>
                        </div>
                    `;
                });

                // Doors section
                if (doors.length > 0) {
                    html += `
                        <div class="blueprint-category">
                            <div class="blueprint-category-header">Doors</div>
                            <div class="blueprint-category-items">
                                ${doors.map(door => `
                                    <div class="blueprint-list-item" data-element-id="${door.id}">
                                        <span class="blueprint-item-label">${door.label || 'Unnamed'}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
                }

                // Out of bounds items
                const outOfBoundsItems = items.filter(item => !itemsInRooms.has(item.id));
                if (outOfBoundsItems.length > 0) {
                    html += `
                        <div class="blueprint-category">
                            <div class="blueprint-category-header">Out of bounds</div>
                            <div class="blueprint-category-items">
                                ${outOfBoundsItems.map(item => `
                                    <div class="blueprint-list-item blueprint-list-subitem" data-element-id="${item.id}">
                                        <span class="blueprint-item-type">${item.type}</span>
                                        <span class="blueprint-item-label">${item.label || 'Unnamed'}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
                }

                if (html === '') {
                    html = '<p class="panel-label" style="color: var(--text-secondary); font-size: 11px; text-align: center; padding: 12px;">No elements placed yet. Use the toolset to add elements.</p>';
                }

                listContainer.innerHTML = html;

                // Wire up click handlers
                listContainer.querySelectorAll('.blueprint-list-item, .blueprint-room-header').forEach(item => {
                    item.addEventListener('click', () => {
                        BlueprintEditor.selectElementById(item.dataset.elementId);
                    });
                });
            }
        }
    };

    const sectionTitles = {
        scene: 'Scene', hotspots: 'Hotspots', inventory: 'Inventory',
        puzzle: 'Puzzle', image: 'Image', gamestate: 'Game State'
    };

    function openSection(name) {
        if (activeSection === name) {
            closePanel();
            return;
        }

        HotspotEditor.stopDrawing();
        HotspotEditor.closePopover();
        if (HotspotEditor.isConnecting()) HotspotEditor.stopConnecting();
        Canvas.closeAssetPopover();
        Canvas.setOverlayMode(false, { hotspots: false, assets: false });
        if (name !== 'image') ImageEditor.deactivate();
        if (name !== 'gamestate' && BlueprintEditor.isActive()) BlueprintEditor.deactivate();
        if (name !== 'puzzle' && IdeogramEditor.isActive()) IdeogramEditor.deactivate();
        activeSection = name;
        sectionButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.section === name);
        });

        const section = sections[name];
        if (section) {
            floatBody.innerHTML = section.render();
            floatTitle.textContent = sectionTitles[name] || 'Editor';
            floatPanel.classList.remove('hidden');
            section.init();
        }
    }

    function closePanel() {
        activeSection = null;
        HotspotEditor.stopDrawing();
        HotspotEditor.closePopover();
        if (HotspotEditor.isConnecting()) HotspotEditor.stopConnecting();
        Canvas.closeAssetPopover();
        Canvas.setOverlayMode(false, { hotspots: false, assets: false });
        ImageEditor.deactivate();
        Canvas.render();
        floatPanel.classList.add('hidden');
        sectionButtons.forEach(btn => btn.classList.remove('active'));
    }

    function enterPlayMode() {
        closePanel();
        editorSections.classList.add('hidden');
        loadBtn.classList.add('hidden');
        exportBtn.classList.add('hidden');
        playInventoryBtn.classList.remove('hidden');
        playHintBtn.classList.remove('hidden');
        modeToggle.textContent = 'Edit';
        viewport.classList.add('fullscreen');
        toolbarEl.classList.add('play-mode');
        toolbarEl.classList.add('collapsed');
        playOverlayControls.classList.remove('hidden');
        PlayMode.enter();
    }

    function enterEditMode() {
        toolbarEl.classList.remove('collapsed');
        playOverlayControls.classList.add('hidden');
        editorSections.classList.remove('hidden');
        loadBtn.classList.remove('hidden');
        exportBtn.classList.remove('hidden');
        playInventoryBtn.classList.add('hidden');
        playHintBtn.classList.add('hidden');
        modeToggle.textContent = 'Play';
        viewport.classList.remove('fullscreen');
        toolbarEl.classList.remove('play-mode');
        PlayMode.exit();
    }

    function isEditMode() {
        return !toolbarEl.classList.contains('play-mode');
    }

    function init() {
        sectionButtons.forEach(btn => {
            btn.addEventListener('click', () => openSection(btn.dataset.section));
        });

        // Float panel close button
        floatClose.addEventListener('click', () => closePanel());

        // Float panel drag
        let drag = null;
        floatHeader.addEventListener('mousedown', (e) => {
            if (e.target === floatClose) return;
            const rect = floatPanel.getBoundingClientRect();
            drag = { startX: e.clientX, startY: e.clientY, origLeft: rect.left, origTop: rect.top };
            floatPanel.style.right = 'auto';
            floatPanel.style.left = rect.left + 'px';
            floatPanel.style.top = rect.top + 'px';
            e.preventDefault();
        });
        document.addEventListener('mousemove', (e) => {
            if (!drag) return;
            const dx = e.clientX - drag.startX;
            const dy = e.clientY - drag.startY;
            floatPanel.style.left = (drag.origLeft + dx) + 'px';
            floatPanel.style.top = (drag.origTop + dy) + 'px';
        });
        document.addEventListener('mouseup', () => { drag = null; });

        modeToggle.addEventListener('click', () => {
            if (isEditMode()) {
                enterPlayMode();
            } else {
                enterEditMode();
            }
        });

        // Import JSON (global)
        loadBtn.addEventListener('click', () => jsonInput.click());

        // Export as project-data.js (path-based, lightweight)
        function stripDataUrls(obj) {
            if (typeof obj === 'string') return (obj.startsWith('data:') || obj.startsWith('blob:')) ? null : obj;
            if (Array.isArray(obj)) return obj.map(stripDataUrls).filter(v => v !== null);
            if (obj && typeof obj === 'object') {
                const out = {};
                for (const k in obj) out[k] = stripDataUrls(obj[k]);
                return out;
            }
            return obj;
        }

        exportBtn.addEventListener('click', () => {
            const data = {
                scenes: SceneManager.getAllScenes().map(s => ({
                    id: s.id,
                    name: s.name,
                    states: s.states,
                    editingStateIndex: s.editingStateIndex || 0,
                    music: s.music || null,
                    sceneAssets: (s.sceneAssets || []).map(a => ({
                        id: a.id, name: a.name, src: a.src,
                        x: a.x, y: a.y, width: a.width, height: a.height,
                        naturalWidth: a.naturalWidth, naturalHeight: a.naturalHeight,
                        visibleStates: a.visibleStates,
                        placed: a.placed || false, layer: a.layer || 0,
                        linkedItem: a.linkedItem || null,
                        statePositions: a.statePositions || null,
                        transition: a.transition || null
                    })),
                    hotspotConnections: s.hotspotConnections || []
                })),
                items: InventoryEditor.getAllItems(),
                puzzles: PuzzleEditor.getAllPuzzles(),
                gameState: GameState.getDefinedFlags(),
                progressionSteps: GameState.getSteps(),
                blueprint: BlueprintEditor.getBlueprintData(),
                ideogramData: IdeogramEditor.getIdeogramData()
            };
            const clean = stripDataUrls(data);
            const js = 'window.PARALLAX_PROJECT =' + JSON.stringify(clean, null, 2) + ';\n';
            const blob = new Blob([js], { type: 'application/javascript' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'project-data.js';
            a.click();
            URL.revokeObjectURL(url);
        });
        jsonInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => SceneManager.importJSON(evt.target.result);
            reader.readAsText(file);
            jsonInput.value = '';
        });

        // Play overlay buttons
        playOverlayEdit.addEventListener('click', () => enterEditMode());

        playOverlayHint.addEventListener('click', () => {
            if (typeof PlayMode === 'undefined' || !PlayMode.isActive()) return;
            const hint = GameState.getNextHint();
            if (hint) {
                PlayMode.showDialogue(hint);
            } else {
                PlayMode.showDialogue('No more hints — you\'ve done everything!');
            }
        });

        playOverlayInventory.addEventListener('click', () => {
            if (typeof PlayMode === 'undefined' || !PlayMode.isActive()) return;
            const inv = document.getElementById('inventory-overlay');
            if (inv.classList.contains('hidden')) {
                PlayMode.openInventoryOverlay();
            } else {
                PlayMode.closeInventoryOverlay();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !isEditMode()) {
                if (typeof PlayMode !== 'undefined' && PlayMode.isWheelOpen && PlayMode.isWheelOpen()) {
                    PlayMode.closeRadialWheel();
                } else if (typeof PlayMode !== 'undefined' && PlayMode.isPickMode && PlayMode.isPickMode()) {
                    PlayMode.exitPickMode();
                } else {
                    enterEditMode();
                }
            }
        });
    }

    function refreshBlueprintList() {
        if (sections.gamestate && sections.gamestate.refreshBlueprintList) {
            sections.gamestate.refreshBlueprintList();
        }
    }

    function refreshIdeogramList() {
        const container = document.getElementById('ideogram-card-list');
        if (!container || typeof IdeogramEditor === 'undefined') return;
        const ideograms = IdeogramEditor.getAllIdeograms();
        const currentId = IdeogramEditor.getCurrentIdeogramId();

        if (ideograms.length === 0) {
            container.innerHTML = '<span class="panel-label" style="color:var(--text-secondary); padding:8px 0;">No ideograms yet.</span>';
            return;
        }

        container.innerHTML = ideograms.map(ig => {
            const ruinCount = (ig.placedRuins || []).length;
            const shapeCount = (ig.drawnShapes || []).length;
            return `
            <div class="scene-card ${ig.id === currentId ? 'active' : ''}" data-id="${ig.id}">
                <div class="scene-thumb ideogram-thumb-pick" data-id="${ig.id}" title="Click to set thumbnail">
                    ${ig.thumbnail ? `<img src="${ig.thumbnail}">` : `<span class="scene-thumb-empty">No image</span>`}
                </div>
                <div class="scene-card-info">
                    <input class="scene-card-name" value="${ig.name || 'Untitled'}" data-id="${ig.id}" spellcheck="false">
                    <span class="scene-card-meta">${ruinCount} asset${ruinCount !== 1 ? 's' : ''} and ${shapeCount} ideogram${shapeCount !== 1 ? 's' : ''}</span>
                </div>
                <button class="scene-card-delete" data-id="${ig.id}">&times;</button>
            </div>
        `}).join('');

        container.querySelectorAll('.scene-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.scene-card-delete') || e.target.classList.contains('scene-card-name') || e.target.closest('.ideogram-thumb-pick')) return;
                IdeogramEditor.switchIdeogram(card.dataset.id);
                refreshIdeogramList();
            });
        });

        container.querySelectorAll('.scene-card-name').forEach(input => {
            input.addEventListener('change', () => {
                const ig = IdeogramEditor.getAllIdeograms().find(i => i.id === input.dataset.id);
                if (ig) ig.name = input.value.trim();
            });
        });

        container.querySelectorAll('.scene-card-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                IdeogramEditor.deleteIdeogram(btn.dataset.id);
                refreshIdeogramList();
            });
        });

        container.querySelectorAll('.ideogram-thumb-pick').forEach(thumb => {
            thumb.addEventListener('click', (e) => {
                e.stopPropagation();
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.addEventListener('change', () => {
                    if (!input.files || !input.files[0]) return;
                    const ig = IdeogramEditor.getAllIdeograms().find(i => i.id === thumb.dataset.id);
                    if (ig) {
                        ig.thumbnail = 'assets/puzzles/' + input.files[0].name;
                        refreshIdeogramList();
                    }
                });
                input.click();
            });
        });
    }

    return { init, openSection, closePanel, isEditMode, enterEditMode, enterPlayMode, refreshBlueprintList, refreshIdeogramList };
})();
