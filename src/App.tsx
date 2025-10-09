"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { ChatSidebar } from "./components/chat/ChatSidebar"
import { ChatWindow } from "./components/chat/ChatWindow"
import { LoginScreen } from "./components/auth/LoginScreen"
import { useChatData } from "./hooks/useChatData"
import { Message } from "./types/chat";
import { PendingMessagesList } from "./components/chat/PendingMessageList";
import { ChatInput } from "./components/chat/ChatInput"
import { motion, AnimatePresence } from "framer-motion"

export default function ChatApp() {
  // --- 步驟 1: 將所有 Hooks 放在最頂部 ---
  const [loggedInUser, setLoggedInUser] = useState<string | null>(null)
  const [activeContactId, setActiveContactId] = useState<string | null>(null)
  const [pendingMessages, setPendingMessages] = useState<Record<string, Message[]>>({});
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | undefined>(undefined);

  const {
    contactsData,
    setContactsData,
    sidebarContacts,
    isLoading,
    error,
    fetchMore,
    reload
  } = useChatData(loggedInUser)

  const currentContact = useMemo(() =>
    contactsData.find((contact) => contact.id === activeContactId),
    [contactsData, activeContactId]
  );

  const currentMessages = currentContact?.messages || [];

  useEffect(() => {
    if (!activeContactId && contactsData.length > 0) {
      setActiveContactId(contactsData[0].id)
    }
  }, [contactsData, activeContactId])


  const handleLoginSuccess = (username: string) => {
    console.log("[ChatApp] User logged in:", username)
    setLoggedInUser(username)
  }

  // Load avatar for the current logged in user (if saved locally)
  useEffect(() => {
    if (!loggedInUser) {
      setCurrentUserAvatar(undefined);
      return;
    }

    let mounted = true;
    const fetchAvatar = async () => {
      try {

        const users = await window.ipcAPI.getSavedUsers();
        console.log(users, '')
        const me = Array.isArray(users) ? users.find((u: any) => u.username === loggedInUser) : undefined;
        console.log(me?.avatar)
        if (me?.avatar) {
          try {
            const dataUrl = await window.ipcAPI.getAvatarDataUrl(me.avatar);
            if (mounted) setCurrentUserAvatar(dataUrl || me.avatar);
          } catch (e) {
            if (mounted) setCurrentUserAvatar(me?.avatar);
          }
        } else {
          if (mounted) setCurrentUserAvatar(undefined);
        }

      } catch (e) {
        if (mounted) setCurrentUserAvatar(undefined);
      }
    };

    fetchAvatar();
    return () => { mounted = false; };
  }, [loggedInUser]);

  const handleContactSelect = (contactId: string) => {
    setActiveContactId(contactId)
    console.log(contactId)
  }

  const handleFetchMore = useCallback(async () => {
    if (!activeContactId || !loggedInUser) return;

    const contact = contactsData.find(c => c.id === activeContactId);
    // console.log(contact, contact?.hasMoreMessages, contact?.isFetchingMore)
    if (!contact || !contact.hasMoreMessages || contact.isFetchingMore) return;
    console.log(`[ChatApp] handleFetchMore called for thread: ${activeContactId}`);
    await fetchMore(activeContactId);
  }, [activeContactId, loggedInUser, contactsData, fetchMore]);

  const handleSendMessage = async (text: string) => {
    if (!activeContactId || !loggedInUser) return;

    // 1. 生成唯一 ID
    const pendingId = `pending_${Date.now()}`;

    // 2. 创建 PendingMessage 并更新 pendingMessages state
    const pendingMessage: Message = {
      id: pendingId,
      content: text,
      timestamp: new Date().toISOString(), // 使用 ISO 字符串
      isOwn: true,
      type: "text",
      status: "sending",
    };
    setPendingMessages(prev => ({
      ...prev,
      [activeContactId]: [...(prev[activeContactId] || []), pendingMessage],
    }));

    // 3. 呼叫 API
    try {
      const response = await window.ipcAPI.sendText(loggedInUser, activeContactId, text, pendingId);

      if (response.success) {
        console.log('resopnse success')
        // 4. 成功后，从 pendingMessages 中移除
        setPendingMessages(prev => {
          const newPending = (prev[activeContactId] || []).filter(m => m.id !== response.pendingId);
          return { ...prev, [activeContactId]: newPending };
        });
      } else {
        // 5. 失败后，更新状态为 'failed'
        setPendingMessages(prev => {
          const newPending = (prev[activeContactId] || []).map(m =>
            m.id === response.pendingId ? { ...m, status: 'failed' as const } : m
          );
          return { ...prev, [activeContactId]: newPending };
        });
      }
    } catch (err) {
      // IPC 调用失败
      setPendingMessages(prev => {
        const newPending = (prev[activeContactId] || []).map(m =>
          m.id === pendingId ? { ...m, status: 'failed' as const } : m
        );
        return { ...prev, [activeContactId]: newPending };
      });
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!activeContactId || !loggedInUser) return;

    // 只允許圖片/影片/語音
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/') && !file.type.startsWith('audio/')) {
      alert('僅支援圖片、影片、語音檔案');
      return;
    }

    // 取得本地路徑（Electron 環境下 file.path 才有值）
    // @ts-ignore
    const filePath = file.path;
    if (!filePath) {
      alert('無法取得檔案路徑，請用桌面版選擇本地檔案');
      return;
    }

    const pendingId = `pending_${Date.now()}`;
    const pendingMessage: Message = {
      id: pendingId,
      content: file.name,
      timestamp: new Date().toISOString(),
      isOwn: true,
      type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file',
      status: 'sending',
      fileName: file.name,
      fileSize: file.size.toString(),
    };
    setPendingMessages(prev => ({
      ...prev,
      [activeContactId]: [...(prev[activeContactId] || []), pendingMessage],
    }));

    try {
      const response = await window.ipcAPI.sendFile(
        loggedInUser,
        activeContactId,
        filePath,
        file.type,
        pendingId
      );
      if (response.success) {
        setPendingMessages(prev => {
          const newPending = (prev[activeContactId] || []).filter(m => m.id !== response.pendingId);
          return { ...prev, [activeContactId]: newPending };
        });
      } else {
        setPendingMessages(prev => {
          const newPending = (prev[activeContactId] || []).map(m =>
            m.id === response.pendingId ? { ...m, status: 'failed' as const } : m
          );
          return { ...prev, [activeContactId]: newPending };
        });
        if (response.error) alert(response.error);
      }
    } catch (err) {
      setPendingMessages(prev => {
        const newPending = (prev[activeContactId] || []).map(m =>
          m.id === pendingId ? { ...m, status: 'failed' as const } : m
        );
        return { ...prev, [activeContactId]: newPending };
      });
      alert('檔案傳送失敗');
    }
  }

  const handleLogout = () => {
    setLoggedInUser(null)
    setActiveContactId("1")
    setContactsData([])
  }

  // --- 步驟 3: 處理條件渲染 (Early Returns) ---
  if (!loggedInUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  if (isLoading && contactsData.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        {/* ... */}
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <button onClick={() => { setLoggedInUser(null); setActiveContactId(null); }} className="text-primary hover:underline">
            重新登入
          </button>
        </div>
      </div>
    );
  }
  const currentPendingMessages =
    activeContactId !== null ? pendingMessages[activeContactId] || [] : [];

  // --- 步驟 4: 最終的渲染 ---
  // 到這裡時，可以保證所有 Hooks 都已經被呼叫過了
  return (
    <div className="h-screen flex bg-background">
      <ChatSidebar
        contacts={sidebarContacts}
        activeContactId={activeContactId}
        onContactSelect={handleContactSelect}
        currentUser={loggedInUser ? { username: loggedInUser, avatar: currentUserAvatar } : undefined}
        onReload={reload}
        isReloading={isLoading}
        onLogout={handleLogout}
      />
      <div className="flex-1 flex flex-col h-full">
        {/* 主區塊：訊息視窗自動填滿剩餘空間 */}
        <div className="flex-1 flex flex-col min-h-0 relative">
          {currentContact ? (
            <ChatWindow
              contactName={currentContact.name}
              contactAvatar={currentContact.avatar}
              contactStatus={currentContact.status}
              messages={currentMessages}
              onSendMessage={handleSendMessage}
              onFileUpload={handleFileUpload}
              onFetchMore={handleFetchMore}
              hasMore={currentContact.hasMoreMessages}
              isFetchingMore={currentContact.isFetchingMore}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">
                {contactsData.length > 0 ? "請從左側選擇一個對話" : "沒有聊天記錄"}
              </p>
            </div>
          )}
          {/* PendingMessagesList 懸浮視窗 */}
          <AnimatePresence>
            {currentPendingMessages.length > 0 && activeContactId && (
              <motion.div
                className="absolute left-1/2 -translate-x-1/2 bottom-4 z-50 w-80 max-w-[90%]" // 增加 max-w-[90%] 以適應小螢幕
                initial={{ opacity: 0, y: 20 }} // 初始狀態：透明，在下方 20px
                animate={{ opacity: 1, y: 0 }}   // 進入動畫：完全不透明，回到原位
                exit={{ opacity: 0, y: 20, transition: { duration: 0.2 } }} // 退出動畫：變透明，向下 20px
                transition={{ type: "spring", stiffness: 200, damping: 25 }} // 動畫效果：使用彈簧動畫
              >
                <PendingMessagesList
                  messages={currentPendingMessages}
                  onRetry={() => { /* TODO */ }} // TODO
                  onRemove={(clientContext) => {
                    setPendingMessages(prev => {
                      const newPending = (
                        prev[activeContactId as string] || []
                      ).filter((m: Message) => m.clientContext !== clientContext);
                      return { ...prev, [activeContactId]: newPending };
                    });
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {/* ChatInput 永遠在底部，不被 PendingMessagesList 撐開 */}
        <div className="flex-shrink-0">
          <ChatInput
            onSendMessage={handleSendMessage}
            onFileUpload={handleFileUpload}
            placeholder="輸入訊息..."
          />
        </div>
      </div>
    </div>
  );
}