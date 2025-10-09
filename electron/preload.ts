import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcAPI', {
  loginToIg: (username: string, passwd: string) => {
    return ipcRenderer.invoke('loginToIg', { username, passwd })
  },

  fetchChatData: (username: string) => {
    return ipcRenderer.invoke('fetchChatData', { username })
  },

  onNewMessage: (callback: any) => {
    const listener = (_event: any, data: any) => callback(data)
    ipcRenderer.on('onMessage', listener)
    return () => {
      ipcRenderer.removeListener('onMessage', listener)
    }
  },
  fetchMoreMessages: (args: any) =>
    ipcRenderer.invoke('fetchMoreMessages', args),
  downloadWebUrl: (url: string) => ipcRenderer.send('downloadWebUrl', url),
  sendText: (
    username: string,
    thread_id: string,
    text: string,
    pendingId: string
  ) => {
    return ipcRenderer.invoke('sendText', {
      username,
      thread_id,
      text,
      pendingId,
    })
  },
  sendFile: (
    username: string,
    thread_id: string,
    filePath: string,
    fileType: string,
    pendingId: string
  ) => {
    return ipcRenderer.invoke('sendFile', {
      username,
      thread_id,
      filePath,
      fileType,
      pendingId,
    })
  },
  onReadReceiptUpdate: (callback: any) => {
    const listener = (_event: any, update: any) => callback(update)
    ipcRenderer.on('onReadReceiptUpdate', listener)

    return () => {
      ipcRenderer.removeListener('onReadReceiptUpdate', listener)
    }
  },
  onPresenceUpdate: (callback: any) => {
    const listener = (_event: any, update: any) => callback(update)
    ipcRenderer.on('onPresenceUpdate', listener)

    return () => {
      ipcRenderer.removeListener('onPresenceUpdate', listener)
    }
  },
  getSavedUsers: () => {
    return ipcRenderer.invoke('getSavedUsers')
  },
  getAvatarDataUrl: (avatarRef: string) => {
    return ipcRenderer.invoke('getAvatarDataUrl', avatarRef)
  },
  removeSavedUser: (username: string) => {
    return ipcRenderer.invoke('removeSavedUser', username)
  },
})
