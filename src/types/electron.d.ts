import { DirectInboxFeedResponseThreadsItem } from "instagram-private-api";
import { Message } from "../types/chat";

export type ExtendedThreadItem = DirectInboxFeedResponseThreadsItem & {
  [key: string]: any
}

export interface ReadReceiptUpdate {
  thread_id: string;
  user_id: string;
  timestamp: string; // 微秒级时间戳
}
export interface PresenceUpdate {
  user_id: string;
  is_active: boolean;
  last_activity_at_ms: string;
}

export interface IElectronAPI {
  openFile: () => Promise<string>
  platform: string
  minimize: () => void
  maximize: () => void
  close: () => void
  isMaximized: () => Promise<boolean>
  onWindowStateChange: (callback: (isMaximized: boolean) => void) => void
}

export interface SavedUser {
  username: string;
  avatar?: string; // 頭像可能是可選的
  lastLogin: string; // ISO 格式的日期字串
}

export interface IIpcAPI {
  loginToIg: (username: string, passwd: string) => Promise<{
    success: boolean;
    username: string;
    message?: string;
    error?: string;
  }>
  fetchChatData: (username: string) => Promise<{
    success: boolean;
    chats?: ExtendedThreadItem[];
    presence?: Record<string, { is_active: boolean; last_activity_at_ms: number }>;
    error?: string;
  }>
  onNewMessage: (callback: (data) => void) => () => void
  fetchMoreMessages: (args: {
    username: string;
    thread_id: string;
    cursor?: string;
  }) => Promise<{
    success: boolean;
    messages?: Message[];
    nextCursor?: string;
    hasMore?: boolean;
    error?: string;
  }>
  downloadWebUrl: (url: string) => void
  sendText: (username: string, thread_id: string, text: string, pendingId: string) => Promise<{
    success: boolean,
    pendingId: string,
    sentMessage?: any,
    error?: any
  }>
  sendFile: (username: string, thread_id: string, filePath: string, fileType: string, pendingId: string) => Promise<{
    success: boolean,
    pendingId: string,
    sentMessage?: any,
    error?: any
  }>
  onReadReceiptUpdate: (callback: (update: ReadReceiptUpdate) => void) => () => void;
  onPresenceUpdate: (callback: (update: PresenceUpdate) => void) => () => void;
  /**
  * 獲取所有已儲存在裝置上的用戶資訊。
  * @returns {Promise<SavedUser[]>} 一個包含已儲存用戶物件的陣列。
  */
  getSavedUsers: () => Promise<SavedUser[]>;

  /**
   * 根據用戶名從裝置上移除一個已儲存的用戶 Session。
   * @param {string} username - 要移除的用戶名。
   * @returns {Promise<{ success: boolean; error?: string }>} 一個表示操作是否成功的物件。
   */
  removeSavedUser: (username: string) => Promise<{ success: boolean; error?: string }>;
  /**
   * 取得頭像的 Data URL（會從本地檔案讀取或下載遠端圖檔並回傳 base64）。
   * @param avatarRef 本地檔案路徑或遠端 URL
   */
  getAvatarDataUrl: (avatarRef: string) => Promise<string | null>;
}

declare global {
  interface Window {
    ipcAPI: IIpcAPI
  }
}