const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getPlatform: () => process.platform,
    getVersion: () => '1.0.0',
});
