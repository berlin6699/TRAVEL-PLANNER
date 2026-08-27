const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('travelPlannerDesktop', {
  getDataLocation: () => ipcRenderer.invoke('desktop:get-data-location'),
  openDataLocation: () => ipcRenderer.invoke('desktop:open-data-location'),
  scheduleNotification: payload => ipcRenderer.invoke('desktop:schedule-notification', payload),
  cancelNotification: id => ipcRenderer.invoke('desktop:cancel-notification', id),
  cancelAllNotifications: () => ipcRenderer.invoke('desktop:cancel-all-notifications'),
})
