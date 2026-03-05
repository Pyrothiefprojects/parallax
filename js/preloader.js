const Preloader = (() => {
    const cache = new Map(); // url → loaded Image object

    function getImage(url) {
        return cache.get(url) || null;
    }

    function collectUrls(data) {
        const urls = new Set();
        if (!data) return urls;

        // Scene backgrounds, hotspot frames/videos, and audio
        if (data.scenes) {
            for (const scene of data.scenes) {
                if (scene.music) urls.add(scene.music);
                if (!scene.states) continue;
                for (const state of scene.states) {
                    if (state.backgroundData) urls.add(state.backgroundData);
                    if (state.hotspots) {
                        for (const h of state.hotspots) {
                            if (h.sound) urls.add(h.sound);
                            if (h.stateChange) {
                                if (h.stateChange.frames) h.stateChange.frames.forEach(f => urls.add(f));
                                if (h.stateChange.video) urls.add(h.stateChange.video);
                            }
                            if (h.loop) {
                                if (h.loop.frames) h.loop.frames.forEach(f => urls.add(f));
                            }
                        }
                    }
                }
            }
        }

        // Item icons
        if (data.items) {
            for (const item of data.items) {
                if (item.image) urls.add(item.image);
            }
        }

        // Puzzle backgrounds, asset/hotspot sounds
        if (data.puzzles) {
            for (const puzzle of data.puzzles) {
                if (puzzle.states) {
                    for (const state of puzzle.states) {
                        if (state.backgroundImage) urls.add(state.backgroundImage);
                        if (state.assets) {
                            for (const a of state.assets) {
                                if (a.sound) urls.add(a.sound);
                            }
                        }
                        if (state.hotspots) {
                            for (const h of state.hotspots) {
                                if (h.sound) urls.add(h.sound);
                            }
                        }
                    }
                }
            }
        }

        // Ideogram ruin, codex, isopress, and isolathe images
        if (data.ideograms) {
            for (const ig of data.ideograms) {
                if (ig.ruinLibrary) {
                    for (const r of ig.ruinLibrary) {
                        if (r.image) urls.add(r.image);
                    }
                }
                if (ig.codices) {
                    for (const c of ig.codices) {
                        if (c.image) urls.add(c.image);
                    }
                }
                if (ig.isopresses) {
                    for (const p of ig.isopresses) {
                        if (p.image) urls.add(p.image);
                    }
                }
                if (ig.isolathes) {
                    for (const l of ig.isolathes) {
                        if (l.image) urls.add(l.image);
                    }
                }
            }
        }

        return urls;
    }

    function loadAsset(url) {
        if (/\.(mp3|wav|m4a|aac)$/i.test(url)) {
            return AudioManager._resolve(url).then(() => {}).catch(() => {});
        }
        if (/\.(mp4|webm|ogg)$/i.test(url)) {
            return new Promise((resolve) => {
                const video = document.createElement('video');
                video.preload = 'auto';
                video.oncanplaythrough = () => resolve();
                video.onerror = () => resolve(); // don't block on errors
                video.src = url;
            });
        }
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => { cache.set(url, img); resolve(); };
            img.onerror = () => resolve();
            img.src = url;
        });
    }

    function run(data) {
        return new Promise((resolve) => {
            const urls = Array.from(collectUrls(data));
            if (urls.length === 0) {
                hide();
                resolve();
                return;
            }

            const bar = document.getElementById('preloader-bar');
            const text = document.getElementById('preloader-text');
            let loaded = 0;

            function tick() {
                loaded++;
                const pct = Math.round((loaded / urls.length) * 100);
                if (bar) bar.style.width = pct + '%';
                if (text) text.textContent = pct + '%';
                if (loaded >= urls.length) {
                    hide();
                    resolve();
                }
            }

            for (const url of urls) {
                loadAsset(url).then(tick);
            }
        });
    }

    function hide() {
        const el = document.getElementById('preloader');
        if (!el) return;
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 400);
    }

    return { run, getImage };
})();
