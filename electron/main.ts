import { app, BrowserWindow, ipcMain } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fsp from "node:fs/promises";
import crypto from "crypto";

const require = createRequire(import.meta.url);
const {
  IgApiClient,
  IgLoginBadPasswordError,
} = require("instagram-private-api");
const {
  withRealtime,
  GraphQLSubscriptions,
  SkywalkerSubscriptions,
} = require("instagram_mqtt");
import type {
  IgApiClientMQTT,
} from "instagram_mqtt";
import {
  ExtMessageWrapper,
  ExtMessage,
} from "../src/types/chat";
import { formatInstagramMessage } from "../src/lib/utils";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, "..");

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow | null;

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    width: 1000,
    height: 750,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
    },
    backgroundColor: "#1c1c1c",
    show: false,
  });

  // Test active push message to Renderer-process.
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
  win?.once("ready-to-show", () => {
    win?.show();
  });
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

const activeSessions = new Map<string, IgApiClientMQTT>();

const SESSIONS_DIR = path.join(app.getPath('userData'), 'sessions');
const SESSION_INDEX_FILE = path.join(SESSIONS_DIR, 'session_index.json');

async function readSessionIndex() {
  try {
    await fsp.access(SESSION_INDEX_FILE);
    const indexContent = await fsp.readFile(SESSION_INDEX_FILE, 'utf-8');
    return JSON.parse(indexContent);
  } catch (error) {
    // 如果文件不存在或为空，返回一个默认的空结构
    return { sessions: [], lastActiveUser: null };
  }
}

// 辅助函数：写入 Session 索引
async function writeSessionIndex(indexData: any) {
  await fsp.mkdir(SESSIONS_DIR, { recursive: true });
  await fsp.writeFile(SESSION_INDEX_FILE, JSON.stringify(indexData, null, 2));
}

async function getSessionFile(username: string): Promise<{ sessionFilePath: string; sessionFileHash: string }> {
  const sessionFileHash = crypto.createHash('sha256').update(username).digest('hex') + '.json';
  const sessionFilePath = path.join(SESSIONS_DIR, sessionFileHash);
  return { sessionFilePath, sessionFileHash };
}

// async function saveSessionOnUpdate(
//   instance: IgApiClientMQTT,
//   username: string
// ) {
//   instance.request.end$.subscribe(async () => {
//     const stateObj = await instance.state.serialize();
//     const stateFile = await getSessionFile(username);
//     await fsp.writeFile(stateFile.sessionFilePath, JSON.stringify(stateObj, null, 2));
//   });
// }

async function checkIsIgValid(ig: IgApiClientMQTT | undefined) {
  if (!ig) {
    console.log("IG client not initialized.");
    return false;
  }
  try {
    console.log("checking if session valid...");
    await ig.account.currentUser();
    console.log("session is valid");
    return true;
  } catch (error: unknown) {
    let errorMessage;
    if (error instanceof Error) {
      if (error.name == "IgLoginRequiredError") {
        errorMessage = "Login required";
      } else {
        errorMessage = error.message;
      }
    }
    console.error("Session is invalid:", errorMessage);
    return false;
  }
}

async function realtimeConnect(ig: IgApiClientMQTT) {
  console.log("Connecting to Instagram Realtime...");
  if (!(await checkIsIgValid(ig))) {
    console.error("Cannot connect to realtime, session is invalid.");
    return;
  }
  console.log(
    `Connecting ${(await ig.account.currentUser()).username} to Realtime...`
  );
  // now `ig` is a client with a valid session
  //  console.log((await ig.account.currentUser()).full_name)
  // whenever something gets sent and has no event, this is called
  ig.realtime.on("receive", (topic: any, messages: any) =>
    console.log("receive", topic, messages)
  );

  // this is called with a wrapper use {message} to only get the "actual" message from the wrapper
  ig.realtime.on("message", async (messageWrapper: ExtMessageWrapper) => {
    const logger = logEvent("messageWrapper");
    logger(messageWrapper);
    const msg: ExtMessage = messageWrapper.message;
    if (messageWrapper.delta_type) {
      switch (messageWrapper.delta_type) {
        case "deltaNewMessage":
        case "deltaNewRavenMessage":
          const new_msg = formatInstagramMessage(msg, ig.state.cookieUserId);
          console.log(new_msg.isOwn);
          if (win) {
            win.webContents.send("onMessage", {
              thread_id: msg.thread_id,
              msg: new_msg,
            });
          }
          break;
        case "deltaReadReceipt":
          console.log("Received a real-time read receipt update.");

          const message = messageWrapper.message;
          const pathParts = message.path.split("/");

          // 从路径 "/direct_v2/threads/.../participants/.../has_seen" 中解析 user_id
          // participants 的索引通常是 4
          const userIdIndex = pathParts.indexOf("participants");
          if (userIdIndex !== -1 && pathParts.length > userIdIndex + 1) {
            const userId = pathParts[userIdIndex + 1];

            const readReceiptUpdate = {
              thread_id: message.thread_id,
              user_id: userId,
              timestamp: message.timestamp.toString(), // 确保是字符串
            };

            // ✅ 通过一个新的 IPC 通道发送更新
            if (win) {
              win.webContents.send("onReadReceiptUpdate", readReceiptUpdate);
            }
          }
          break;
      }
    }
  });

  // a thread is updated, e.g. admins/members added/removed
  ig.realtime.on("threadUpdate", logEvent("threadUpdateWrapper"));


  // other direct messages - no messages
  ig.realtime.on("direct", logEvent("direct"));

  // whenever something gets sent to /ig_realtime_sub and has no event, this is called
  ig.realtime.on("realtimeSub", (realtimeSub: any) => {
    const logger = logEvent("realtimeSub");
    logger(realtimeSub);

    try {
      // payload 是一个 JSON 字符串，需要解析
      const payload = JSON.parse(realtimeSub.data.message.payload);
      // 检查是否存在 presence_event
      if (payload.presence_event) {
        const presenceEvent = payload.presence_event;
        console.log("Received a real-time presence update:", presenceEvent);

        const presenceUpdate = {
          user_id: presenceEvent.user_id.toString(), // 确保是字符串
          is_active: presenceEvent.is_active,
          last_activity_at_ms: presenceEvent.last_activity_at_ms.toString(), // 确保是字符串
        };
        console.log(presenceUpdate);
        // ✅ 通过一个新的 IPC 通道发送更新
        if (win) {
          win.webContents.send("onPresenceUpdate", presenceUpdate);
        }
      }
    } catch (error) {
      // 有时 payload 可能不是有效的 JSON，或者结构不同，做个保护
      console.warn("Could not parse realtimeSub payload:", error);
    }
  });

  // whenever the client has a fatal error
  ig.realtime.on("error", console.error);

  ig.realtime.on("close", () => console.error("RealtimeClient closed"));

  // connect
  // this will resolve once all initial subscriptions have been sent
  await ig.realtime.connect({
    graphQlSubs: [
      GraphQLSubscriptions.getAppPresenceSubscription(),
      GraphQLSubscriptions.getZeroProvisionSubscription(ig.state.phoneId),
      GraphQLSubscriptions.getDirectStatusSubscription(),
      GraphQLSubscriptions.getDirectTypingSubscription(ig.state.cookieUserId),
      // GraphQLSubscriptions.getAsyncAdSubscription(ig.state.cookieUserId),
    ],

    skywalkerSubs: [SkywalkerSubscriptions.directSub(ig.state.cookieUserId)],

    irisData: await ig.feed.directInbox().request(),
    // optional
    // in here you can change connect options
    // available are all properties defined in MQTToTConnectionClientInfo
    connectOverrides: {},
  });
  // from now on, you won't receive any realtime-data as you "aren't in the app"
  // the keepAliveTimeout is somehow a 'constant' by instagram
}

/**
 * A wrapper function to log to the console
 * @param name
 * @returns {(data) => void}
 */
function logEvent(name: string) {
  return (data: any) => console.log(name, JSON.stringify(data, null, 2));
}

// function JSON_stringify(data: any) {
//   return JSON.stringify(data, null, 2);
// }

// IPC handler
//loginToIg
ipcMain.handle('loginToIg', async (_event, { username, passwd }) => {
  // 參數校驗
  if (!username) {
    return { success: false, error: "用戶名不能為空。" };
  }

  const { sessionFilePath, sessionFileHash } = await getSessionFile(username);
  const newIg: IgApiClientMQTT = withRealtime(new IgApiClient());

  // ✅ 步驟 1: 在 Handler 的頂層作用域宣告一個變數來快取用戶資訊
  let currentUserInfo: any = null;

  try {
    // --- 優先嘗試從 session 文件恢復 ---
    await fsp.access(sessionFilePath);
    const stateStr = await fsp.readFile(sessionFilePath, 'utf-8');
    if (!stateStr) throw new Error('Session file is empty.');

    await newIg.state.deserialize(JSON.parse(stateStr));

    // 驗證 session 的同時，獲取並快取用戶資訊
    currentUserInfo = await newIg.account.currentUser();
    console.log(`Session for ${currentUserInfo.username} restored and is valid.`);

  } catch (sessionError) {
    // --- Session 恢復失敗，進行完整密碼登入 ---
    console.log(`Could not restore session for ${username}. Proceeding with full login.`);
    if (!passwd) {
      return { success: false, error: 'Session已失效，請輸入密碼重新登入。' };
    }

    try {
      newIg.state.generateDevice(username);
      await newIg.account.login(username, passwd);
      // 密碼登入成功後，獲取並快取用戶資訊
      currentUserInfo = await newIg.account.currentUser();
      console.log(`Password login for ${currentUserInfo.username} successful.`);

    } catch (loginError: any) {
      // 處理特定的登入錯誤
      if (loginError instanceof IgLoginBadPasswordError) {
        return { success: false, error: '帳號或密碼錯誤。' };
      }
      // 可以添加對 IgCheckpointError 等其他錯誤的處理
      console.error(`Login failed for ${username}:`, loginError);
      return { success: false, error: loginError.message || '登入失敗，請稍後再試。' };
    }
  }

  // 如果經過上述所有流程，currentUserInfo 依然為空，說明發生了意外，直接失敗
  if (!currentUserInfo) {
    return { success: false, error: '無法驗證用戶資訊，登入失敗。' };
  }

  // ✅ 步驟 2: 創建一個不包含任何網路請求的、純粹的保存函式
  // 它會使用在外部作用域中快取的 currentUserInfo
  const pureSaveAndIndexSession = async () => {
    try {
      const stateObj = await newIg.state.serialize();
      await fsp.writeFile(sessionFilePath, JSON.stringify(stateObj, null, 2));

      const index = await readSessionIndex();
      const userIndex = index.sessions.findIndex((s: any) => s.username === currentUserInfo.username);

      const sessionInfo = {
        username: currentUserInfo.username,
        sessionFile: sessionFileHash,
        lastLogin: new Date().toISOString(),
        // 優先使用已下載並儲存在本地的頭像檔案路徑（如果有），否則回退到原始的遠端 URL
        avatar: (currentUserInfo as any)._localAvatarPath ?? currentUserInfo.profile_pic_url,
      };

      if (userIndex > -1) {
        index.sessions[userIndex] = sessionInfo; // 更新現有條目
      } else {
        index.sessions.push(sessionInfo); // 添加新條目
      }
      index.lastActiveUser = currentUserInfo.username; // 更新最後活躍用戶

      await writeSessionIndex(index);
      // console.log(`Session for ${currentUserInfo.username} saved/updated.`); // 在 subscribe 中可以移除，避免過多日誌
    } catch (e) {
      console.error("Error during pure session save:", e);
    }
  };

  // Helper: download avatar once and save to sessions directory.
  // This MUST NOT be called repeatedly inside request.end$ subscription.
  async function downloadAvatarOnceIfNeeded() {
    try {
      const remoteUrl = currentUserInfo.profile_pic_url;
      if (!remoteUrl) return;

      // Ensure sessions dir exists
      await fsp.mkdir(SESSIONS_DIR, { recursive: true });

      // Determine extension from URL path, fallback to .jpg
      let ext = '.jpg';
      try {
        const parsed = new URL(remoteUrl);
        const pext = path.extname(parsed.pathname);
        if (pext) ext = pext;
      } catch (e) {
        // ignore and use default
      }

      const avatarFilename = `${sessionFileHash}-avatar${ext}`;
      const avatarPath = path.join(SESSIONS_DIR, avatarFilename);

      // If file already exists, don't redownload
      try {
        await fsp.access(avatarPath);
        // file exists
        (currentUserInfo as any)._localAvatarPath = avatarPath;
        return;
      } catch (_) {
        // file doesn't exist, continue to download
      }

      // Try to download using fetch (Node 18+). If not available, skip.
      if (typeof fetch === 'function') {
        const resp = await fetch(remoteUrl);
        if (!resp.ok) throw new Error(`Failed to fetch avatar: ${resp.status}`);
        const ab = await resp.arrayBuffer();
        const buffer = Buffer.from(ab);
        await fsp.writeFile(avatarPath, buffer);
        (currentUserInfo as any)._localAvatarPath = avatarPath;
      } else {
        // fetch not available, skip and keep remote URL
        console.warn('fetch is not available in this Node runtime; skipping avatar download');
      }
    } catch (err) {
      console.warn('Could not download avatar, will use remote URL:', err);
    }
  }

  // --- 無論是 Session 恢復還是密碼登入成功，都執行以下邏輯 ---
  try {
    // ✅ 步驟 3: 在所有網路操作成功後，嘗試下載一次頭像到本地（僅執行一次），確保前端可直接讀取本地檔案，避免跨源問題
    await downloadAvatarOnceIfNeeded();

    // 保存索引（pureSaveAndIndexSession 不會發起網路請求）
    await pureSaveAndIndexSession();
    console.log(`Session for ${currentUserInfo.username} is now indexed with avatar.`);

    // 將已驗證的實例存入活躍 Map
    activeSessions.set(currentUserInfo.username, newIg);

    // ✅ 步驟 4: 綁定 session 自動保存，訂閱的是純粹的保存函式
    newIg.request.end$.subscribe(() => {
      pureSaveAndIndexSession();
    });

    // 觸發 realtime 連接
    realtimeConnect(newIg);

    return { success: true, username: currentUserInfo.username, message: '登入成功！' };

  } catch (finalError: any) {
    console.error("Failed during final session processing:", finalError);
    return { success: false, error: "登入成功，但保存 Session 失敗。" };
  }
});

//fetchChatData
ipcMain.handle(
  "fetchChatData",
  async (_event, { username }: { username: string }) => {
    const igInstance = activeSessions.get(username);
    if (!igInstance || !(await checkIsIgValid(igInstance))) {
      return { success: false, error: "該帳號未登入或 Session 已失效。" };
    }

    try {
      const [threads, presence] = await Promise.all([
        igInstance.feed.directInbox().items(),
        igInstance.direct.getPresence(),
      ]);
      return {
        success: true,
        chats: threads,
        presence: presence.user_presence,
      };
    } catch (error) {
      return { success: false, error: "獲取聊天資料失敗。" };
    }
  }
);

// fetchMoreMessages
ipcMain.handle(
  "fetchMoreMessages",
  async (_event, { username, thread_id, cursor }) => {
    const igInstance = activeSessions.get(username);

    if (!igInstance || !(await checkIsIgValid(igInstance))) {
      return { success: false, error: "該帳號未登入或 Session 已失效。" };
    }

    try {
      console.log(
        `Fetching more messages for thread ${thread_id} with cursor ${cursor}`
      );

      const threadFeed = igInstance.feed.directThread({
        thread_id: thread_id,
        oldest_cursor: cursor,
      });

      const moreMessagesRaw = await threadFeed.items();

      const viewer_id = igInstance.state.cookieUserId;
      const moreMessagesFormatted = moreMessagesRaw
        .map((msg) => formatInstagramMessage(msg, viewer_id))
        .reverse(); // 同樣需要 reverse()

      // get next cursor for more request
      const nextCursor = threadFeed.cursor;

      return {
        success: true,
        messages: moreMessagesFormatted,
        nextCursor: nextCursor,
        hasMore: threadFeed.isMoreAvailable(),
      };
    } catch (error) {
      console.error("Failed to fetch more messages:", error);
      return { success: false, error: "獲取更多訊息失敗。" };
    }
  }
);

//sendText
ipcMain.handle(
  "sendText",
  async (_event, { username, thread_id, text, pendingId }) => {
    const igInstance = activeSessions.get(username);

    if (!igInstance || !(await checkIsIgValid(igInstance))) {
      return { success: false, error: "帳號未登入或 Session 已失效。" };
    }

    try {
      console.log(`Sending message to thread ${thread_id}: "${text}"`);

      // 獲取對話實體
      const thread = igInstance.entity.directThread(thread_id);

      // ✅ 確實存在的方法：發送文字訊息
      const response: any = await thread.broadcastText(text);

      // response 包含了已發送訊息的詳細資訊，你可以用它來確認
      console.log("Message sent successfully:", response.client_context);

      return {
        success: true,
        pendingId: pendingId,
        sentMessage: response,
      };
    } catch (error: any) {
      console.error("Failed to send message:", error);
      return { success: false, pendiingId: pendingId, error: error.message };
    }
  }
);

// sendFile
ipcMain.handle(
  "sendFile",
  async (_event, { username, thread_id, filePath, fileType, pendingId }) => {
    const igInstance = activeSessions.get(username);
    if (!igInstance || !(await checkIsIgValid(igInstance))) {
      return {
        success: false,
        pendingId,
        error: "帳號未登入或 Session 已失效。",
      };
    }
    try {
      // 1. 從文件路徑讀取 Buffer
      const fileBuffer = await fsp.readFile(filePath);
      const thread = igInstance.entity.directThread(thread_id);
      let sentMessagePayload;

      // 2. 根據檔案型態呼叫不同 IG API
      if (fileType && fileType.startsWith("image/")) {
        console.log(`Broadcasting photo to thread ${thread_id}`);
        sentMessagePayload = await thread.broadcastPhoto({
          file: fileBuffer,
        });
      } else if (fileType && fileType.startsWith("video/")) {
        console.log(`Broadcasting video to thread ${thread_id}`);
        sentMessagePayload = await thread.broadcastVideo({
          video: fileBuffer,
        });
      } else if (fileType && fileType.startsWith("audio/")) {
        console.log(`Broadcasting voice message to thread ${thread_id}`);
        sentMessagePayload = await thread.broadcastVoice({
          file: fileBuffer,
        });
      } else {
        return { success: false, pendingId, error: "Unsupported file type" };
      }

      // 3. 成功後，返回格式化後的訊息和 pendingId
      // sentMessagePayload 可能是 IG API 回傳的訊息物件，這裡直接回傳
      return {
        success: true,
        pendingId: pendingId,
        sentMessage: sentMessagePayload,
      };
    } catch (error) {
      let errMsg = "未知錯誤";
      if (error instanceof Error) errMsg = error.message;
      console.error(`Failed to send file for pendingId ${pendingId}:`, error);
      return { success: false, pendingId: pendingId, error: errMsg };
    }
  }
);

//getSavedUsers
ipcMain.handle('getSavedUsers', async () => {
  const index = await readSessionIndex();
  // 只返回用户名列表给前端
  return index.sessions
});

// getAvatarDataUrl: given either a local file path or a remote URL, return a data URL
ipcMain.handle('getAvatarDataUrl', async (_event, avatarRef: string) => {
  try {
    if (!avatarRef) return null;

    // helper to fetch remote into Buffer
    const fetchBuffer = async (remoteUrl: string): Promise<Buffer> => {
      if (typeof fetch === 'function') {
        const resp = await fetch(remoteUrl);
        if (!resp.ok) throw new Error(`Failed to fetch ${remoteUrl}: ${resp.status}`);
        const ab = await resp.arrayBuffer();
        return Buffer.from(ab);
      }

      // fallback using https
      return new Promise<Buffer>((resolve, reject) => {
        try {
          const https = require('https');
          https.get(remoteUrl, (res: any) => {
            const chunks: any[] = [];
            res.on('data', (chunk: any) => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', (err: any) => reject(err));
          }).on('error', reject);
        } catch (err) {
          reject(err);
        }
      });
    };

    let buffer: Buffer;
    if (avatarRef.startsWith('http://') || avatarRef.startsWith('https://')) {
      buffer = await fetchBuffer(avatarRef);
    } else {
      // assume local path
      buffer = await fsp.readFile(avatarRef);
    }

    const ext = path.extname(avatarRef).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };
    const mime = mimeMap[ext] ?? 'image/jpeg';

    const base64 = buffer.toString('base64');
    return `data:${mime};base64,${base64}`;
  } catch (err) {
    console.error('getAvatarDataUrl failed:', err);
    return null;
  }
});

//removeSavedUser
ipcMain.handle('removeSavedUser', async (_event, usernameToRemove: string) => {
  try {
    const index = await readSessionIndex();
    const { sessionFilePath } = await getSessionFile(usernameToRemove);

    // 從索引中移除
    const updatedSessions = index.sessions.filter((s: any) => s.username !== usernameToRemove);

    // 如果移除的是最後活躍用戶，清空它
    if (index.lastActiveUser === usernameToRemove) {
      index.lastActiveUser = null;
    }
    index.sessions = updatedSessions;

    // 將更新後的索引寫回文件
    await writeSessionIndex(index);

    // 從文件系統中刪除對應的 session 文件
    try {
      await fsp.unlink(sessionFilePath);
    } catch (unlinkError: any) {
      // 如果文件不存在，也沒關係，忽略錯誤
      if (unlinkError.code !== 'ENOENT') {
        throw unlinkError;
      }
    }

    console.log(`Successfully removed saved user: ${usernameToRemove}`);
    return { success: true };

  } catch (error: any) {
    console.error(`Failed to remove saved user ${usernameToRemove}:`, error);
    return { success: false, error: error.message || "移除用戶失敗" };
  }
});

ipcMain.on("downloadWebUrl", (_event, url: string) => {
  win?.webContents.downloadURL(url);
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(() => {
  createWindow();
});
