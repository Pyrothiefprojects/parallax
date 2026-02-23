const PuzzleEditor = (() => {
    let puzzles = [];
    let currentPuzzleId = null;
    let pendingBgImage = null;

    function addPuzzle(name, bgImage) {
        const id = 'puzzle_' + Date.now();
        const puzzle = {
            id,
            name,
            states: [{
                backgroundImage: bgImage,
                assets: [],
                assetGroups: [],
                hotspots: []
            }],
            editingStateIndex: 0,
            rewardItemId: '',
            rewardSceneState: null,
            isClue: false,
            completionText: ''
        };
        puzzles.push(puzzle);
        return puzzle;
    }

    function getCurrentState(puzzle) {
        if (!puzzle || !puzzle.states || puzzle.states.length === 0) return null;
        const idx = puzzle.editingStateIndex || 0;
        return puzzle.states[idx] || puzzle.states[0];
    }

    function getStateCount(puzzle) {
        return puzzle && puzzle.states ? puzzle.states.length : 0;
    }

    function addState(puzzleId, bgImage) {
        const puzzle = getPuzzle(puzzleId);
        if (!puzzle) return;
        const currentState = getCurrentState(puzzle);
        const copiedAssets = currentState ? JSON.parse(JSON.stringify(currentState.assets || [])) : [];
        const copiedGroups = currentState ? JSON.parse(JSON.stringify(currentState.assetGroups || [])) : [];
        const copiedHotspots = currentState ? JSON.parse(JSON.stringify(currentState.hotspots || [])) : [];
        puzzle.states.push({
            backgroundImage: bgImage,
            assets: copiedAssets,
            assetGroups: copiedGroups,
            hotspots: copiedHotspots
        });
        puzzle.editingStateIndex = puzzle.states.length - 1;
    }

    function removeState(puzzleId, stateIndex) {
        const puzzle = getPuzzle(puzzleId);
        if (!puzzle || puzzle.states.length <= 1) return;
        puzzle.states.splice(stateIndex, 1);
        if (puzzle.editingStateIndex >= puzzle.states.length) {
            puzzle.editingStateIndex = puzzle.states.length - 1;
        }
    }

    function setEditingState(puzzleId, index) {
        const puzzle = getPuzzle(puzzleId);
        if (!puzzle) return;
        if (index < 0 || index >= puzzle.states.length) return;
        puzzle.editingStateIndex = index;
    }

    function removePuzzle(id) {
        puzzles = puzzles.filter(p => p.id !== id);
    }

    function getPuzzle(id) {
        return puzzles.find(p => p.id === id) || null;
    }

    function getAllPuzzles() {
        return puzzles;
    }

    function getClues() {
        return puzzles.filter(p => p.isClue);
    }

    function loadPuzzles(data) {
        puzzles = (data || []).map(p => {
            // Migrate old rewardType format
            if (p.rewardType && !('isClue' in p)) {
                p.isClue = p.rewardType === 'clue';
                if (p.rewardType === 'clue') {
                    p.rewardItemId = '';
                }
                delete p.rewardType;
            }
            // Migrate old revealImage to nothing (scene states replace this)
            if (p.revealImage) {
                delete p.revealImage;
            }
            if (!('rewardSceneState' in p)) {
                p.rewardSceneState = null;
            }
            // Migrate old flat format to states array
            if (!p.states) {
                const states = [{
                    backgroundImage: p.backgroundImage || null,
                    assets: p.assets || [],
                    assetGroups: p.assetGroups || []
                }];
                if (p.stateImages) {
                    for (const img of p.stateImages) {
                        states.push({
                            backgroundImage: img,
                            assets: JSON.parse(JSON.stringify(p.assets || [])),
                            assetGroups: JSON.parse(JSON.stringify(p.assetGroups || []))
                        });
                    }
                }
                p.states = states;
                p.editingStateIndex = 0;
                delete p.backgroundImage;
                delete p.assets;
                delete p.assetGroups;
                delete p.stateImages;
            }
            // Ensure all states have hotspots array
            for (const state of p.states) {
                if (!state.hotspots) state.hotspots = [];
            }
            return p;
        });
    }

    function renderPuzzleList() {
        const container = document.getElementById('puzzle-list');
        if (!container) return;

        if (puzzles.length === 0) {
            container.innerHTML = '<span class="panel-label" style="color:var(--text-secondary); padding:8px 0;">No puzzles defined. Add one above.</span>';
            return;
        }

        const items = InventoryEditor.getAllItems();
        const scenes = SceneManager.getAllScenes();

        container.innerHTML = puzzles.map(puzzle => {
            const rss = puzzle.rewardSceneState;
            const selectedScene = rss && rss.sceneId ? SceneManager.getScene(rss.sceneId) : null;
            const sceneStateCount = selectedScene ? SceneManager.getStateCount(selectedScene) : 0;
            const currentState = getCurrentState(puzzle);
            const bgSrc = currentState ? currentState.backgroundImage : null;

            return `
            <div class="scene-card puzzle-card ${puzzle.id === currentPuzzleId ? 'active' : ''}" data-id="${puzzle.id}">
                <div class="scene-thumb puzzle-thumb">
                    ${bgSrc
                        ? `<img src="${bgSrc}" alt="${puzzle.name}">`
                        : '<span class="scene-thumb-empty">No background</span>'}
                </div>
                <div class="scene-card-info">
                    <input class="scene-card-name puzzle-name-input" value="${puzzle.name}" data-id="${puzzle.id}" spellcheck="false">
                    <div class="puzzle-rewards">
                        <label class="puzzle-reward-check">
                            <input type="checkbox" class="puzzle-clue-toggle" data-id="${puzzle.id}" ${puzzle.isClue ? 'checked' : ''}>
                            <span>Clue</span>
                        </label>
                        <select class="item-uses-select puzzle-reward-item" data-id="${puzzle.id}">
                            <option value="">Item: None</option>
                            ${items.map(i => `<option value="${i.id}" ${puzzle.rewardItemId === i.id ? 'selected' : ''}>${i.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="puzzle-rewards">
                        <select class="item-uses-select puzzle-reward-scene" data-id="${puzzle.id}">
                            <option value="">Scene State: None</option>
                            ${scenes.map(s => `<option value="${s.id}" ${rss && rss.sceneId === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
                        </select>
                        ${sceneStateCount > 1 ? `
                        <select class="item-uses-select puzzle-reward-state-idx" data-id="${puzzle.id}">
                            ${Array.from({length: sceneStateCount}, (_, i) => `<option value="${i}" ${rss && rss.stateIndex === i ? 'selected' : ''}>${selectedScene.states[i] && selectedScene.states[i].background ? selectedScene.states[i].background : 'State ' + (i + 1)}</option>`).join('')}
                        </select>` : ''}
                    </div>
                    <input class="panel-input puzzle-completion-text" data-id="${puzzle.id}" value="${puzzle.completionText || ''}" placeholder="Completion text..." style="font-size:10px; margin-top:2px;">
                </div>
                <button class="puzzle-card-preview" data-id="${puzzle.id}" title="Preview / Edit Assets">&#9673;</button>
                <button class="scene-card-delete" data-id="${puzzle.id}" title="Remove puzzle">&times;</button>
            </div>`;
        }).join('');

        // Name change
        container.querySelectorAll('.puzzle-name-input').forEach(input => {
            input.addEventListener('change', () => {
                const puzzle = getPuzzle(input.dataset.id);
                if (puzzle) puzzle.name = input.value.trim();
            });
        });

        // Clue toggle
        container.querySelectorAll('.puzzle-clue-toggle').forEach(cb => {
            cb.addEventListener('change', () => {
                const puzzle = getPuzzle(cb.dataset.id);
                if (puzzle) puzzle.isClue = cb.checked;
            });
        });

        // Reward item change
        container.querySelectorAll('.puzzle-reward-item').forEach(sel => {
            sel.addEventListener('change', () => {
                const puzzle = getPuzzle(sel.dataset.id);
                if (puzzle) puzzle.rewardItemId = sel.value;
            });
        });

        // Reward scene state — scene selector
        container.querySelectorAll('.puzzle-reward-scene').forEach(sel => {
            sel.addEventListener('change', () => {
                const puzzle = getPuzzle(sel.dataset.id);
                if (!puzzle) return;
                if (sel.value) {
                    puzzle.rewardSceneState = { sceneId: sel.value, stateIndex: 0 };
                } else {
                    puzzle.rewardSceneState = null;
                }
                renderPuzzleList(); // re-render to show/hide state index dropdown
            });
        });

        // Reward scene state — state index selector
        container.querySelectorAll('.puzzle-reward-state-idx').forEach(sel => {
            sel.addEventListener('change', () => {
                const puzzle = getPuzzle(sel.dataset.id);
                if (puzzle && puzzle.rewardSceneState) {
                    puzzle.rewardSceneState.stateIndex = parseInt(sel.value) || 0;
                }
            });
        });

        // Completion text
        container.querySelectorAll('.puzzle-completion-text').forEach(input => {
            input.addEventListener('input', () => {
                const puzzle = getPuzzle(input.dataset.id);
                if (puzzle) puzzle.completionText = input.value;
            });
        });

        // Preview / Edit Assets
        container.querySelectorAll('.puzzle-card-preview').forEach(btn => {
            btn.addEventListener('click', () => {
                const puzzle = getPuzzle(btn.dataset.id);
                if (puzzle) PlayMode.openPuzzleOverlay(puzzle, null, null, 'edit');
            });
        });

        // Delete
        container.querySelectorAll('.scene-card-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                removePuzzle(btn.dataset.id);
                if (currentPuzzleId === btn.dataset.id) currentPuzzleId = null;
                renderPuzzleList();
                renderPuzzleContentsList();
            });
        });

        // Select puzzle card
        container.querySelectorAll('.puzzle-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.scene-card-delete') || e.target.closest('.puzzle-card-preview') || e.target.closest('input') || e.target.closest('select') || e.target.closest('label')) return;
                const id = card.dataset.id;
                currentPuzzleId = currentPuzzleId === id ? null : id;
                container.querySelectorAll('.puzzle-card').forEach(c => c.classList.toggle('active', c.dataset.id === currentPuzzleId));
                renderPuzzleContentsList();
            });
        });
    }

    function renderPuzzleContentsList() {
        const listContainer = document.getElementById('puzzle-contents-list');
        if (!listContainer) return;

        const puzzle = currentPuzzleId ? getPuzzle(currentPuzzleId) : null;
        if (!puzzle) {
            listContainer.innerHTML = '';
            return;
        }

        const items = typeof InventoryEditor !== 'undefined' ? InventoryEditor.getAllItems() : [];
        const contents = [];
        (puzzle.states || []).forEach((st, si) => {
            const stLabel = puzzle.states.length > 1 ? ' · S' + (si + 1) : '';
            (st.hotspots || []).forEach(h => {
                contents.push({ name: h.name || 'hotspot', meta: (h.action ? h.action.type : 'none') + stLabel, thumb: '' });
            });
            (st.assets || []).forEach(a => {
                const isAsset = a.type === 'puzzle_asset';
                const src = isAsset ? (a.imageData || a.src || '') : '';
                const linkedName = isAsset && a.linkedItem ? (items.find(i => i.id === a.linkedItem) || {}).name || a.linkedItem : '';
                contents.push({ name: a.name || a.type, meta: (linkedName || a.type) + stLabel, thumb: src });
            });
        });

        if (contents.length === 0) {
            listContainer.innerHTML = '<span class="panel-label" style="color:var(--text-secondary); padding:4px 0; font-size:10px;">No contents yet.</span>';
            return;
        }

        listContainer.innerHTML = contents.map(c => `
            <div class="scene-card puzzle-content-card" style="padding:3px 6px; min-height:auto;">
                ${c.thumb ? `<div class="scene-thumb" style="width:24px; height:24px; flex-shrink:0;"><img src="${c.thumb}" style="width:100%; height:100%; object-fit:contain;"></div>` : ''}
                <div class="scene-card-info" style="min-width:0; gap:0;">
                    <span class="scene-card-meta" style="font-size:10px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c.name}</span>
                    <span class="scene-card-meta" style="font-size:9px; color:var(--text-secondary);">${c.meta}</span>
                </div>
            </div>`).join('');
    }

    function initToolbar() {
        const nameInput = document.getElementById('puzzle-name');
        const loadBgBtn = document.getElementById('puzzle-load-bg');
        const fileInput = document.getElementById('puzzle-file-input');
        const addBtn = document.getElementById('puzzle-add');

        renderPuzzleList();

        loadBgBtn.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            pendingBgImage = 'assets/puzzles/' + file.name;
            loadBgBtn.textContent = 'BG loaded';
            loadBgBtn.style.borderColor = 'var(--accent-gold)';
            fileInput.value = '';
        });

        addBtn.addEventListener('click', () => {
            const name = nameInput.value.trim();
            if (!name) return;
            addPuzzle(name, pendingBgImage);
            nameInput.value = '';
            pendingBgImage = null;
            loadBgBtn.textContent = 'Load Background';
            loadBgBtn.style.borderColor = '';
            renderPuzzleList();
        });
    }

    return {
        addPuzzle, removePuzzle, getPuzzle, getAllPuzzles, getClues, loadPuzzles, renderPuzzleList, renderPuzzleContentsList, initToolbar,
        getCurrentState, getStateCount, addState, removeState, setEditingState
    };
})();
