const PuzzleAssetLibrary = (() => {
    let assets = [];

    function addAsset(name, imagePath) {
        const id = 'pa_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        const asset = { id, name, image: imagePath };
        assets.push(asset);
        return asset;
    }

    function removeAsset(id) {
        assets = assets.filter(a => a.id !== id);
    }

    function getAsset(id) {
        return assets.find(a => a.id === id) || null;
    }

    function getAll() {
        return assets;
    }

    function getData() {
        return assets.map(a => ({ ...a }));
    }

    function loadData(data) {
        assets = (data || []).map(a => ({ ...a }));
    }

    return { addAsset, removeAsset, getAsset, getAll, getData, loadData };
})();
