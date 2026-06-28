const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getPlatform: () => process.platform,
    getVersion: () => require('./package.json').version,
    isDesktop: true,
});
