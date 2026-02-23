PuzzleAssets.registerType({
    type: 'puzzle_asset',
    label: 'Asset',
    hidden: true,

    create(x, y, options) {
        const o = options || {};
        const w = o.width || 64;
        const h = o.height || 64;
        return {
            id: 'asset_' + Date.now(),
            type: 'puzzle_asset',
            x, y,
            name: o.name || '',
            src: o.src || '',
            imageData: o.imageData || null,
            originalWidth: w,
            originalHeight: h,
            width: w,
            height: h,
            linkedItem: null,
            requires: []
        };
    },

    checkSolved(asset) {
        if (!asset.linkedItem) return true;
        return GameState.isAssetRemoved(asset.id);
    },

    render(asset, editMode) {
        const src = asset.imageData || asset.src;
        return `<img src="${src}" style="width:${asset.width}px; height:${asset.height}px; display:block; pointer-events:none;" draggable="false">`;
    },

    bindPlay(el, asset) {
        if (asset.linkedItem) {
            el.style.cursor = 'pointer';
            el.addEventListener('click', () => {
                if (GameState.isAssetRemoved(asset.id)) return;
                GameState.addToInventory(asset.linkedItem);
                GameState.removeAsset(asset.id);
                el.remove();
                const item = InventoryEditor.getItem(asset.linkedItem);
                const name = item ? item.name : asset.linkedItem;
                PlayMode.showDialogue('Picked up: ' + name, 3000);
                PlayMode.renderInventory();
            });
        }
    },

    popoverFields(asset) {
        const items = typeof InventoryEditor !== 'undefined' ? InventoryEditor.getAllItems() : [];
        const ow = asset.originalWidth || asset.width;
        const oh = asset.originalHeight || asset.height;
        const pct = Math.round((asset.width / ow) * 100);
        return `
            <div class="popover-field">
                <label>Linked Item</label>
                <select class="panel-select puzzle-asset-linked-item">
                    <option value="">-- None --</option>
                    ${items.map(i => `<option value="${i.id}" ${asset.linkedItem === i.id ? 'selected' : ''}>${i.name}</option>`).join('')}
                </select>
            </div>
            <div class="popover-field">
                <label>Size: <span class="puzzle-asset-size-val">${pct}%</span></label>
                <input type="range" class="puzzle-asset-size" min="5" max="200" step="1" value="${pct}" style="width:100%; accent-color:var(--accent-orange);">
            </div>`;
    },

    bindPopover(popoverEl, asset, getEl) {
        const itemSel = popoverEl.querySelector('.puzzle-asset-linked-item');
        if (itemSel) itemSel.addEventListener('change', () => { asset.linkedItem = itemSel.value || null; });
        const sizeSlider = popoverEl.querySelector('.puzzle-asset-size');
        const sizeVal = popoverEl.querySelector('.puzzle-asset-size-val');
        if (sizeSlider) sizeSlider.addEventListener('input', () => {
            const pct = parseInt(sizeSlider.value) / 100;
            const ow = asset.originalWidth || asset.width;
            const oh = asset.originalHeight || asset.height;
            asset.width = Math.round(ow * pct);
            asset.height = Math.round(oh * pct);
            if (sizeVal) sizeVal.textContent = sizeSlider.value + '%';
            const el = getEl();
            if (el) {
                const img = el.querySelector('img');
                if (img) {
                    img.style.width = asset.width + 'px';
                    img.style.height = asset.height + 'px';
                }
            }
        });
    }
});
