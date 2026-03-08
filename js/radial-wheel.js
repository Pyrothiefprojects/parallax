const RadialWheel = (() => {
    let wheelEl = null;
    let open = false;
    let onCloseCallback = null;

    /**
     * Open a radial wheel at screen position.
     * @param {Array<{id, name, image?}>} items
     * @param {number} clientX
     * @param {number} clientY
     * @param {function(string)} onSelect - called with selected item id
     * @param {object} [opts]
     * @param {string} [opts.selectedId] - highlight this item
     * @param {string} [opts.emptyText] - text when no items
     * @param {function} [opts.onClose] - called when wheel closes without selection
     */
    function openWheel(items, clientX, clientY, onSelect, opts) {
        closeWheel();
        const options = opts || {};
        onCloseCallback = options.onClose || null;

        wheelEl = document.createElement('div');
        wheelEl.className = 'radial-wheel';
        wheelEl.id = 'shared-radial-wheel';

        const itemsContainer = document.createElement('div');
        itemsContainer.className = 'radial-wheel-items';

        const padding = 80;
        const cx = Math.max(padding, Math.min(window.innerWidth - padding, clientX));
        const cy = Math.max(padding, Math.min(window.innerHeight - padding, clientY));

        if (!items || items.length === 0) {
            const emptyEl = document.createElement('div');
            emptyEl.className = 'radial-wheel-empty';
            emptyEl.style.left = cx + 'px';
            emptyEl.style.top = cy + 'px';
            emptyEl.textContent = options.emptyText || 'No items available';
            itemsContainer.appendChild(emptyEl);
        } else {
            const radius = items.length === 1 ? 0 : Math.max(70, items.length * 18);
            const angleStep = (2 * Math.PI) / items.length;
            const startAngle = -Math.PI / 2;

            items.forEach((item, i) => {
                const angle = startAngle + angleStep * i;
                const x = cx + Math.cos(angle) * radius;
                const y = cy + Math.sin(angle) * radius;

                const el = document.createElement('div');
                el.className = 'radial-wheel-item' + (options.selectedId === item.id ? ' selected' : '');
                el.style.left = x + 'px';
                el.style.top = y + 'px';
                el.dataset.itemId = item.id;

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
                    const id = item.id;
                    closeWheel();
                    onSelect(id);
                });

                el.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    closeWheel();
                });

                itemsContainer.appendChild(el);
            });
        }

        wheelEl.appendChild(itemsContainer);
        document.body.appendChild(wheelEl);
        open = true;

        wheelEl.addEventListener('click', (e) => {
            if (!e.target.closest('.radial-wheel-item')) {
                closeWheel();
            }
        });

        wheelEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            closeWheel();
        });
    }

    function closeWheel() {
        if (wheelEl) {
            wheelEl.remove();
            wheelEl = null;
        }
        const wasOpen = open;
        open = false;
        if (wasOpen && onCloseCallback) {
            const cb = onCloseCallback;
            onCloseCallback = null;
            cb();
        } else {
            onCloseCallback = null;
        }
    }

    function isOpen() {
        return open;
    }

    return { open: openWheel, close: closeWheel, isOpen };
})();
