const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('travelPlannerDesktop', {
  getDataLocation: () => ipcRenderer.invoke('desktop:get-data-location'),
  openDataLocation: () => ipcRenderer.invoke('desktop:open-data-location'),
})
