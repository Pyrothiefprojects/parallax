const Canvas = (() => {
    const canvasEl = document.getElementById('game-canvas');
    const ctx = canvasEl.getContext('2d');
    let backgroundImage = null;
    let scale = 1;
    let offsetX = 0;
    let offsetY = 0;

    // Scene asset interaction
    let assetImageCache = {};
    let selectedAssetId = null;
    let assetDrag = null;
    let assetPopoverEl = null;
    let assetFades = {};
    let overlayMode = false;
    let overlayOptions = { hotspots: false, assets: false };
    let pickModeTargets = null;
    let pickGhost = null;
    const STATE_COLORS = ['#ff6b35','#4fc3f7','#66bb6a','#ab47bc','#ef5350','#ffee58'];
    const HANDLE = 8;

    function resize() {
        const parent = canvasEl.parentElement;
        canvasEl.width = parent.clientWidth;
        canvasEl.height = parent.clientHeight;
        render();
    }

    function loadImage(src) {
        const cached = typeof Preloader !== 'undefined' && Preloader.getImage(src);
        if (cached) {
            backgroundImage = cached;
            calcFit();
            render();
            return Promise.resolve(cached);
        }
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                backgroundImage = img;
                calcFit();
                render();
                resolve(img);
            };
            img.onerror = reject;
            img.src = src;
        });
    }

    function calcFit() {
        if (!backgroundImage) return;
        const cw = canvasEl.width;
        const ch = canvasEl.height;
        const iw = backgroundImage.width;
        const ih = backgroundImage.height;
        scale = Math.min(cw / iw, ch / ih);
        offsetX = (cw - iw * scale) / 2;
        offsetY = (ch - ih * scale) / 2;
    }

    function render() {
        ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

        if (backgroundImage) {
            ctx.drawImage(
                backgroundImage,
                offsetX, offsetY,
                backgroundImage.width * scale,
                backgroundImage.height * scale
            );
        }

        // Scene assets (edit + play mode)
        if (!(typeof ImageEditor !== 'undefined' && ImageEditor.isActive())) {
            renderSceneAssets();
        }

        if (Toolbar.isEditMode() && !(typeof ImageEditor !== 'undefined' && ImageEditor.isActive())) {
            HotspotEditor.renderHotspots(ctx, scale, offsetX, offsetY);
        }

        // Overlay mode (edit mode only)
        if (overlayMode && Toolbar.isEditMode() && !(typeof ImageEditor !== 'undefined' && ImageEditor.isActive())) {
            renderOverlay();
        }

        // Pick mode targets + ghost (play mode)
        if (pickModeTargets) {
            renderPickTargets();
        }
        if (pickGhost) {
            renderPickGhost();
        }
    }

    // ── Scene Asset Rendering ──

    function loadAssetImage(src) {
        if (assetImageCache[src]) return Promise.resolve(assetImageCache[src]);
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                assetImageCache[src] = img;
                render();
                resolve(img);
            };
            img.onerror = reject;
            img.src = src;
        });
    }

    function fadeAsset(assetId, from, to, duration, onDone) {
        assetFades[assetId] = { alpha: from, from, to, start: performance.now(), duration, onDone: onDone || null };
        requestAnimationFrame(animateFades);
    }

    function animateFades() {
        const now = performance.now();
        const callbacks = [];
        for (const id of Object.keys(assetFades)) {
            const f = assetFades[id];
            const t = Math.min((now - f.start) / f.duration, 1);
            f.alpha = f.from + (f.to - f.from) * t;
            if (t >= 1) {
                if (f.onDone) callbacks.push(f.onDone);
                delete assetFades[id];
            }
        }
        render();
        for (const cb of callbacks) cb();
        if (Object.keys(assetFades).length > 0) requestAnimationFrame(animateFades);
    }

    function setOverlayMode(active, opts) {
        overlayMode = active;
        overlayOptions = opts || { hotspots: false, assets: false };
        render();
    }

    function setPickModeTargets(targets) {
        pickModeTargets = targets;
        render();
    }

    function clearPickModeTargets() {
        pickModeTargets = null;
        render();
    }

    function setPickGhost(assetId, pos) {
        pickGhost = { assetId, pos };
        render();
    }

    function clearPickGhost() {
        if (pickGhost) {
            pickGhost = null;
            render();
        }
    }

    function getAssetStatePos(asset, stateIdx) {
        if (asset.lockPosition && asset.statePositions && asset.statePositions[asset.lockPositionState || 0]) {
            return asset.statePositions[asset.lockPositionState || 0];
        }
        if (asset.statePositions && asset.statePositions[stateIdx]) {
            return asset.statePositions[stateIdx];
        }
        return { x: asset.x, y: asset.y, width: asset.width, height: asset.height };
    }

    function setAssetStatePos(asset, stateIdx, pos) {
        if (!asset.statePositions) asset.statePositions = {};
        if (asset.lockPosition) {
            const lockIdx = asset.lockPositionState || 0;
            asset.statePositions[lockIdx] = pos;
        } else {
            asset.statePositions[stateIdx] = pos;
        }
    }

    function renderSceneAssets() {
        const scene = typeof SceneManager !== 'undefined' ? SceneManager.getCurrentScene() : null;
        if (!scene || !scene.sceneAssets || scene.sceneAssets.length === 0) return;

        let stateIdx = scene.editingStateIndex || 0;
        if (typeof PlayMode !== 'undefined' && PlayMode.isActive()) {
            stateIdx = GameState.getSceneState(scene.id);
        }

        const sorted = [...scene.sceneAssets].sort((a, b) => (a.layer || 0) - (b.layer || 0));
        for (const asset of sorted) {
            if (!asset.visibleStates.includes(stateIdx)) continue;
            if (typeof PlayMode !== 'undefined' && PlayMode.isActive() && GameState.isAssetRemoved(asset.id)) continue;

            const imgSrc = asset.imageData || asset.src;
            const img = assetImageCache[imgSrc];
            if (!img) {
                loadAssetImage(imgSrc);
                continue;
            }

            const runtimePos = (typeof PlayMode !== 'undefined' && PlayMode.isActive() && typeof GameState !== 'undefined') ? GameState.getAssetPosition(asset.id) : null;
            const pos = runtimePos || getAssetStatePos(asset, stateIdx);
            const sx = pos.x * scale + offsetX;
            const sy = pos.y * scale + offsetY;
            const sw = pos.width * scale;
            const sh = pos.height * scale;

            const fade = assetFades[asset.id];
            const needsFlip = pos.flipH || pos.flipV;
            if (fade || needsFlip) {
                ctx.save();
                if (fade) ctx.globalAlpha = fade.alpha;
                if (needsFlip) {
                    ctx.translate(sx + sw / 2, sy + sh / 2);
                    ctx.scale(pos.flipH ? -1 : 1, pos.flipV ? -1 : 1);
                    ctx.drawImage(img, -sw / 2, -sh / 2, sw, sh);
                } else {
                    ctx.drawImage(img, sx, sy, sw, sh);
                }
                ctx.restore();
            } else {
                ctx.drawImage(img, sx, sy, sw, sh);
            }

            // Selection indicator (edit mode only)
            if (Toolbar.isEditMode() && asset.id === selectedAssetId) {
                ctx.save();
                ctx.strokeStyle = '#00e5ff';
                ctx.lineWidth = 2;
                if (asset.placed) {
                    ctx.strokeRect(sx, sy, sw, sh);
                } else {
                    ctx.setLineDash([6, 4]);
                    ctx.strokeRect(sx, sy, sw, sh);
                    ctx.setLineDash([]);
                    ctx.fillStyle = '#00e5ff';
                    const corners = assetCorners(sx, sy, sw, sh);
                    for (const c of corners) {
                        ctx.fillRect(c.x - HANDLE / 2, c.y - HANDLE / 2, HANDLE, HANDLE);
                    }
                }
                ctx.restore();
            }
        }
    }

    // ── Overlay Rendering ──

    function renderOverlay() {
        const scene = typeof SceneManager !== 'undefined' ? SceneManager.getCurrentScene() : null;
        if (!scene || !scene.states || scene.states.length < 2) return;
        const currentIdx = scene.editingStateIndex || 0;

        for (let i = 0; i < scene.states.length; i++) {
            if (i === currentIdx) continue;
            const color = STATE_COLORS[i % STATE_COLORS.length];
            const state = scene.states[i];

            if (overlayOptions.hotspots && state.hotspots) {
                for (const hs of state.hotspots) {
                    drawOverlayPolygon(hs.points, color, hs.name);
                }
            }

            if (overlayOptions.assets && scene.sceneAssets) {
                for (const asset of scene.sceneAssets) {
                    if (!asset.visibleStates.includes(i)) continue;
                    const pos = getAssetStatePos(asset, i);
                    const sx = pos.x * scale + offsetX;
                    const sy = pos.y * scale + offsetY;
                    const sw = pos.width * scale;
                    const sh = pos.height * scale;
                    ctx.save();
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 1;
                    ctx.setLineDash([4, 3]);
                    ctx.globalAlpha = 0.5;
                    ctx.strokeRect(sx, sy, sw, sh);
                    // Draw asset name
                    ctx.fillStyle = color;
                    ctx.font = '10px sans-serif';
                    ctx.globalAlpha = 0.7;
                    ctx.fillText(asset.name, sx + 2, sy - 3);
                    ctx.setLineDash([]);
                    ctx.restore();
                }
            }
        }

        // Legend
        renderOverlayLegend(scene);
    }

    function drawOverlayPolygon(points, color, label) {
        if (!points || points.length === 0) return;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(points[0][0] * scale + offsetX, points[0][1] * scale + offsetY);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i][0] * scale + offsetX, points[i][1] * scale + offsetY);
        }
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.1;
        ctx.fill();
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label
        if (label) {
            let cx = 0, cy = 0;
            for (const p of points) { cx += p[0]; cy += p[1]; }
            cx /= points.length; cy /= points.length;
            ctx.globalAlpha = 0.8;
            ctx.fillStyle = color;
            ctx.font = '10px sans-serif';
            ctx.fillText(label, cx * scale + offsetX, cy * scale + offsetY - 4);
        }
        ctx.restore();
    }

    function renderOverlayLegend(scene) {
        ctx.save();
        const x = 10;
        let y = canvasEl.height - 10;
        ctx.font = '11px sans-serif';
        for (let i = scene.states.length - 1; i >= 0; i--) {
            const color = STATE_COLORS[i % STATE_COLORS.length];
            const currentIdx = scene.editingStateIndex || 0;
            const name = SceneManager.getStateName(scene.states[i], i);
            const label = (i === currentIdx ? '● ' : '○ ') + name;
            ctx.globalAlpha = i === currentIdx ? 1 : 0.7;
            ctx.fillStyle = color;
            ctx.fillText(label, x, y);
            y -= 16;
        }
        ctx.restore();
    }

    // ── Pick Mode Rendering ──

    function renderPickTargets() {
        if (!pickModeTargets) return;
        ctx.save();
        for (const target of pickModeTargets) {
            if (!target.points || target.points.length === 0) continue;
            ctx.beginPath();
            ctx.moveTo(target.points[0][0] * scale + offsetX, target.points[0][1] * scale + offsetY);
            for (let i = 1; i < target.points.length; i++) {
                ctx.lineTo(target.points[i][0] * scale + offsetX, target.points[i][1] * scale + offsetY);
            }
            ctx.closePath();
            ctx.fillStyle = 'rgba(79, 195, 247, 0.15)';
            ctx.fill();
            ctx.strokeStyle = '#4fc3f7';
            ctx.lineWidth = 2;
            ctx.shadowColor = '#4fc3f7';
            ctx.shadowBlur = 10;
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
        ctx.restore();
    }

    function renderPickGhost() {
        if (!pickGhost) return;
        const scene = typeof SceneManager !== 'undefined' ? SceneManager.getCurrentScene() : null;
        if (!scene) return;
        const asset = (scene.sceneAssets || []).find(a => a.id === pickGhost.assetId);
        if (!asset) return;
        const imgSrc = asset.imageData || asset.src;
        const img = assetImageCache[imgSrc];
        if (!img) return;
        const pos = pickGhost.pos;
        const gsx = pos.x * scale + offsetX;
        const gsy = pos.y * scale + offsetY;
        const gsw = pos.width * scale;
        const gsh = pos.height * scale;
        ctx.save();
        ctx.globalAlpha = 0.35;
        if (pos.flipH || pos.flipV) {
            ctx.translate(gsx + gsw / 2, gsy + gsh / 2);
            ctx.scale(pos.flipH ? -1 : 1, pos.flipV ? -1 : 1);
            ctx.drawImage(img, -gsw / 2, -gsh / 2, gsw, gsh);
        } else {
            ctx.drawImage(img, gsx, gsy, gsw, gsh);
        }
        ctx.restore();
    }

    function assetCorners(sx, sy, sw, sh) {
        return [
            { x: sx, y: sy },
            { x: sx + sw, y: sy },
            { x: sx, y: sy + sh },
            { x: sx + sw, y: sy + sh }
        ];
    }

    function selectSceneAsset(asset) {
        selectedAssetId = asset ? asset.id : null;
        render();
    }

    function getSelectedSceneAsset() {
        if (!selectedAssetId) return null;
        const scene = typeof SceneManager !== 'undefined' ? SceneManager.getCurrentScene() : null;
        if (!scene || !scene.sceneAssets) return null;
        return scene.sceneAssets.find(a => a.id === selectedAssetId) || null;
    }

    // ── Scene Asset Mouse Interaction ──

    function hitAssetHandle(mx, my) {
        const asset = getSelectedSceneAsset();
        if (!asset || asset.placed) return -1;
        const scene = typeof SceneManager !== 'undefined' ? SceneManager.getCurrentScene() : null;
        const stateIdx = scene ? (scene.editingStateIndex || 0) : 0;
        const pos = getAssetStatePos(asset, stateIdx);
        const sx = pos.x * scale + offsetX;
        const sy = pos.y * scale + offsetY;
        const sw = pos.width * scale;
        const sh = pos.height * scale;
        const corners = assetCorners(sx, sy, sw, sh);
        for (let i = 0; i < corners.length; i++) {
            if (Math.abs(mx - corners[i].x) < HANDLE && Math.abs(my - corners[i].y) < HANDLE) return i;
        }
        return -1;
    }

    function hitAsset(mx, my) {
        const scene = typeof SceneManager !== 'undefined' ? SceneManager.getCurrentScene() : null;
        if (!scene || !scene.sceneAssets) return null;
        const stateIdx = scene.editingStateIndex || 0;
        const sorted = [...scene.sceneAssets]
            .filter(a => a.visibleStates.includes(stateIdx))
            .sort((a, b) => (a.layer || 0) - (b.layer || 0));
        for (let i = sorted.length - 1; i >= 0; i--) {
            const a = sorted[i];
            const p = getAssetStatePos(a, stateIdx);
            const sx = p.x * scale + offsetX;
            const sy = p.y * scale + offsetY;
            if (mx >= sx && mx <= sx + p.width * scale && my >= sy && my <= sy + p.height * scale) return a;
        }
        return null;
    }

    function hitAssetPlay(mx, my) {
        const scene = typeof SceneManager !== 'undefined' ? SceneManager.getCurrentScene() : null;
        if (!scene || !scene.sceneAssets) return null;
        const stateIdx = typeof GameState !== 'undefined' ? GameState.getSceneState(scene.id) : 0;
        const sorted = [...scene.sceneAssets]
            .filter(a => a.linkedItem && a.visibleStates.includes(stateIdx) && !GameState.isAssetRemoved(a.id))
            .sort((a, b) => (a.layer || 0) - (b.layer || 0));
        for (let i = sorted.length - 1; i >= 0; i--) {
            const a = sorted[i];
            const runtimePos = typeof GameState !== 'undefined' ? GameState.getAssetPosition(a.id) : null;
            const p = runtimePos || getAssetStatePos(a, stateIdx);
            const sx = p.x * scale + offsetX;
            const sy = p.y * scale + offsetY;
            if (mx >= sx && mx <= sx + p.width * scale && my >= sy && my <= sy + p.height * scale) return a;
        }
        return null;
    }

    function handleAssetMouseDown(e) {
        if (!Toolbar.isEditMode()) return;
        if (typeof ImageEditor !== 'undefined' && ImageEditor.isActive()) return;
        if (HotspotEditor.isDrawing() || HotspotEditor.isLoopPlacing()) return;

        const rect = canvasEl.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        // Resize handle
        const hi = hitAssetHandle(mx, my);
        if (hi >= 0) {
            const asset = getSelectedSceneAsset();
            const scene = typeof SceneManager !== 'undefined' ? SceneManager.getCurrentScene() : null;
            const stateIdx = scene ? (scene.editingStateIndex || 0) : 0;
            const pos = getAssetStatePos(asset, stateIdx);
            assetDrag = {
                type: 'resize', corner: hi,
                startX: (mx - offsetX) / scale, startY: (my - offsetY) / scale,
                ox: pos.x, oy: pos.y, ow: pos.width, oh: pos.height,
                stateIdx
            };
            suppressClick();
            e.preventDefault();
            return;
        }

        // Asset body
        const hit = hitAsset(mx, my);
        if (hit) {
            selectedAssetId = hit.id;
            HotspotEditor.closePopover();
            if (hit.placed) {
                closeAssetPopover();
                showAssetPopover(hit);
            } else {
                closeAssetPopover();
                const scn = typeof SceneManager !== 'undefined' ? SceneManager.getCurrentScene() : null;
                const si = scn ? (scn.editingStateIndex || 0) : 0;
                const hp = getAssetStatePos(hit, si);
                assetDrag = {
                    type: 'move',
                    startX: (mx - offsetX) / scale, startY: (my - offsetY) / scale,
                    ox: hp.x, oy: hp.y, ow: hp.width, oh: hp.height,
                    stateIdx: si
                };
            }
            render();
            suppressClick();
            e.preventDefault();
            return;
        }

        // Deselect
        if (selectedAssetId) {
            selectedAssetId = null;
            closeAssetPopover();
            render();
        }
    }

    function handleAssetMouseMove(e) {
        const rect = canvasEl.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        if (assetDrag) {
            const asset = getSelectedSceneAsset();
            if (!asset) { assetDrag = null; return; }
            const imgX = (mx - offsetX) / scale;
            const imgY = (my - offsetY) / scale;

            if (assetDrag.type === 'move') {
                const cur = getAssetStatePos(asset, assetDrag.stateIdx);
                setAssetStatePos(asset, assetDrag.stateIdx, {
                    ...cur,
                    x: assetDrag.ox + (imgX - assetDrag.startX),
                    y: assetDrag.oy + (imgY - assetDrag.startY),
                    width: assetDrag.ow, height: assetDrag.oh
                });
            } else {
                const ci = assetDrag.corner;
                const ratio = assetDrag.oh / assetDrag.ow;
                let newW, anchorX, anchorY;
                if (ci === 0) { newW = assetDrag.ow - (imgX - assetDrag.startX); anchorX = assetDrag.ox + assetDrag.ow; anchorY = assetDrag.oy + assetDrag.oh; }
                else if (ci === 1) { newW = assetDrag.ow + (imgX - assetDrag.startX); anchorX = assetDrag.ox; anchorY = assetDrag.oy + assetDrag.oh; }
                else if (ci === 2) { newW = assetDrag.ow - (imgX - assetDrag.startX); anchorX = assetDrag.ox + assetDrag.ow; anchorY = assetDrag.oy; }
                else { newW = assetDrag.ow + (imgX - assetDrag.startX); anchorX = assetDrag.ox; anchorY = assetDrag.oy; }

                if (newW < 16) newW = 16;
                const newH = newW * ratio;
                const curR = getAssetStatePos(asset, assetDrag.stateIdx);
                setAssetStatePos(asset, assetDrag.stateIdx, {
                    ...curR,
                    x: (ci === 0 || ci === 2) ? anchorX - newW : anchorX,
                    y: (ci === 0 || ci === 1) ? anchorY - newH : anchorY,
                    width: newW, height: newH
                });
            }
            render();
            return;
        }

        // Cursor feedback
        if (!Toolbar.isEditMode() || HotspotEditor.isDrawing() || HotspotEditor.isLoopPlacing()) return;
        if (typeof ImageEditor !== 'undefined' && ImageEditor.isActive()) return;

        const hi = hitAssetHandle(mx, my);
        if (hi >= 0) {
            canvasEl.style.cursor = (hi === 0 || hi === 3) ? 'nwse-resize' : 'nesw-resize';
            return;
        }
        const hit = hitAsset(mx, my);
        if (hit) {
            canvasEl.style.cursor = hit.placed ? 'pointer' : 'move';
            return;
        }
        if (canvasEl.style.cursor === 'move' || canvasEl.style.cursor === 'pointer' || canvasEl.style.cursor.includes('resize')) {
            canvasEl.style.cursor = '';
        }
    }

    function handleAssetMouseUp() {
        if (assetDrag) {
            assetDrag = null;
            if (typeof SceneManager !== 'undefined') SceneManager.renderSceneAssetList();
        }
    }

    function suppressClick() {
        canvasEl.addEventListener('click', function stop(e) {
            e.stopImmediatePropagation();
        }, { once: true, capture: true });
    }

    // ── Asset Context Menu (right-click to place) ──

    function handleAssetContextMenu(e) {
        if (!Toolbar.isEditMode()) return;
        if (typeof ImageEditor !== 'undefined' && ImageEditor.isActive()) return;
        if (HotspotEditor.isDrawing() || HotspotEditor.isLoopPlacing()) return;

        const rect = canvasEl.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        const hit = hitAsset(mx, my);
        if (hit) {
            e.preventDefault();
            e.stopImmediatePropagation();
            if (!hit.placed) {
                hit.placed = true;
                selectedAssetId = hit.id;
                closeAssetPopover();
                showAssetPopover(hit);
                render();
                if (typeof SceneManager !== 'undefined') SceneManager.renderSceneAssetList();
            }
        }
    }

    // ── Asset Config Popover ──

    function showAssetPopover(asset) {
        closeAssetPopover();
        HotspotEditor.closePopover();

        const scene = typeof SceneManager !== 'undefined' ? SceneManager.getCurrentScene() : null;
        const stateIdx = scene ? (scene.editingStateIndex || 0) : 0;
        const apos = getAssetStatePos(asset, stateIdx);
        const sx = apos.x * scale + offsetX + (apos.width * scale);
        const sy = apos.y * scale + offsetY;
        const canvasRect = canvasEl.getBoundingClientRect();

        const items = typeof InventoryEditor !== 'undefined' ? InventoryEditor.getAllItems() : [];

        assetPopoverEl = document.createElement('div');
        assetPopoverEl.className = 'hotspot-popover scene-asset-popover';
        assetPopoverEl.style.position = 'fixed';
        assetPopoverEl.style.left = (canvasRect.left + sx + 12) + 'px';
        assetPopoverEl.style.top = (canvasRect.top + sy) + 'px';

        assetPopoverEl.innerHTML = `
            <div class="popover-header">
                <span class="popover-title">Asset Config</span>
                <button class="popover-close">&times;</button>
            </div>
            <div class="popover-field">
                <label>Name</label>
                <input class="panel-input" id="asset-pop-name" value="${asset.name}" spellcheck="false">
            </div>
            <div class="popover-field">
                <label>Layer</label>
                <input class="panel-input" id="asset-pop-layer" type="number" value="${asset.layer || 0}" min="0" step="1" style="width:80px">
            </div>
            <div class="popover-field">
                <label>Linked Item</label>
                <select class="panel-select" id="asset-pop-item">
                    <option value="">-- None --</option>
                    ${items.map(i => `<option value="${i.id}" ${asset.linkedItem === i.id ? 'selected' : ''}>${i.name}</option>`).join('')}
                </select>
            </div>
            <div class="popover-field">
                <label>Transition</label>
                <select class="panel-select" id="asset-pop-transition">
                    <option value="" ${!asset.transition ? 'selected' : ''}>None</option>
                    <option value="fade" ${asset.transition === 'fade' ? 'selected' : ''}>Fade</option>
                </select>
            </div>
            <div class="popover-field" style="display:flex; gap:6px;">
                <button id="asset-pop-flip-h" class="panel-btn${apos.flipH ? ' active' : ''}" style="flex:1">Flip H</button>
                <button id="asset-pop-flip-v" class="panel-btn${apos.flipV ? ' active' : ''}" style="flex:1">Flip V</button>
            </div>
            <div class="popover-field">
                <label><input type="checkbox" id="asset-pop-lock-pos" ${asset.lockPosition ? 'checked' : ''}> Lock position across states</label>
            </div>
            <button id="asset-pop-unplace" class="panel-btn" style="margin-top:8px; width:100%">Unplace (movable)</button>
        `;

        document.getElementById('hotspot-overlay').appendChild(assetPopoverEl);

        assetPopoverEl.querySelector('.popover-close').addEventListener('click', () => {
            closeAssetPopover();
        });

        const nameInput = assetPopoverEl.querySelector('#asset-pop-name');
        nameInput.addEventListener('input', () => {
            asset.name = nameInput.value;
            if (typeof SceneManager !== 'undefined') SceneManager.renderSceneAssetList();
        });

        const layerInput = assetPopoverEl.querySelector('#asset-pop-layer');
        layerInput.addEventListener('input', () => {
            asset.layer = parseInt(layerInput.value) || 0;
            render();
            if (typeof SceneManager !== 'undefined') SceneManager.renderSceneAssetList();
        });

        const itemSelect = assetPopoverEl.querySelector('#asset-pop-item');
        itemSelect.addEventListener('change', () => {
            asset.linkedItem = itemSelect.value || null;
        });

        const transSelect = assetPopoverEl.querySelector('#asset-pop-transition');
        transSelect.addEventListener('change', () => {
            asset.transition = transSelect.value || null;
        });

        const flipHBtn = assetPopoverEl.querySelector('#asset-pop-flip-h');
        flipHBtn.addEventListener('click', () => {
            apos.flipH = !apos.flipH;
            setAssetStatePos(asset, stateIdx, apos);
            flipHBtn.classList.toggle('active', apos.flipH);
            render();
        });

        const flipVBtn = assetPopoverEl.querySelector('#asset-pop-flip-v');
        flipVBtn.addEventListener('click', () => {
            apos.flipV = !apos.flipV;
            setAssetStatePos(asset, stateIdx, apos);
            flipVBtn.classList.toggle('active', apos.flipV);
            render();
        });

        const lockPosCheck = assetPopoverEl.querySelector('#asset-pop-lock-pos');
        lockPosCheck.addEventListener('change', () => {
            asset.lockPosition = lockPosCheck.checked;
            if (asset.lockPosition) {
                asset.lockPositionState = stateIdx;
                const pos = getAssetStatePos(asset, stateIdx);
                if (!asset.statePositions) asset.statePositions = {};
                asset.statePositions[stateIdx] = pos;
            }
            render();
        });

        const unplaceBtn = assetPopoverEl.querySelector('#asset-pop-unplace');
        unplaceBtn.addEventListener('click', () => {
            asset.placed = false;
            closeAssetPopover();
            render();
            if (typeof SceneManager !== 'undefined') SceneManager.renderSceneAssetList();
        });

        requestAnimationFrame(() => {
            if (!assetPopoverEl) return;
            const popRect = assetPopoverEl.getBoundingClientRect();
            if (popRect.right > window.innerWidth) {
                assetPopoverEl.style.left = Math.max(10, canvasRect.left + apos.x * scale + offsetX - popRect.width - 12) + 'px';
            }
            if (popRect.bottom > window.innerHeight) {
                assetPopoverEl.style.top = Math.max(10, window.innerHeight - popRect.height - 10) + 'px';
            }
        });
    }

    function closeAssetPopover() {
        if (assetPopoverEl) {
            assetPopoverEl.remove();
            assetPopoverEl = null;
        }
    }

    // Convert screen coords to image coords
    function screenToImage(sx, sy) {
        return {
            x: (sx - offsetX) / scale,
            y: (sy - offsetY) / scale
        };
    }

    // Convert image coords to screen coords
    function imageToScreen(ix, iy) {
        return {
            x: ix * scale + offsetX,
            y: iy * scale + offsetY
        };
    }

    function getCanvasElement() {
        return canvasEl;
    }

    function getContext() {
        return ctx;
    }

    function getTransform() {
        return { scale, offsetX, offsetY };
    }

    function hasImage() {
        return backgroundImage !== null;
    }

    function init() {
        resize();
        window.addEventListener('resize', () => {
            resize();
            calcFit();
            render();
        });
        new ResizeObserver(() => {
            resize();
            calcFit();
            render();
        }).observe(canvasEl.parentElement);
        canvasEl.addEventListener('mousedown', handleAssetMouseDown);
        canvasEl.addEventListener('mousemove', handleAssetMouseMove);
        canvasEl.addEventListener('contextmenu', handleAssetContextMenu);
        window.addEventListener('mouseup', handleAssetMouseUp);
    }

    return {
        init, loadImage, render, resize,
        screenToImage, imageToScreen,
        getCanvasElement, getContext, getTransform, hasImage,
        loadAssetImage, selectSceneAsset, getSelectedSceneAsset, closeAssetPopover,
        getAssetStatePos, fadeAsset, hitAssetPlay,
        setOverlayMode, setPickModeTargets, clearPickModeTargets,
        setPickGhost, clearPickGhost
    };
})();
