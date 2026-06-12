const { contextBridge } = require('electron');

// Expose only safe, read-only metadata. The renderer never gets Node access.
contextBridge.exposeInMainWorld('boqDesktop', {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
});
