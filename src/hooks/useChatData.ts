"use client"

import { useState, useEffect, useCallback } from "react"
import { ChatContact, ContactData, Message, ExtDirectInboxFeedResponseItemsItem } from "@/types/chat"; // 確保 Message 類型已更新
import { ReadReceiptUpdate } from "@/types/electron";
import { formatTimestamp, formatInstagramMessage } from "@/lib/utils";
import { PresenceUpdate } from "@/types/electron";

const processReadReceipts = (
  chat: any,
  initialMessages: Message[],
  viewer_id: string
): Message[] => {
  if (!chat.last_seen_at || initialMessages.length === 0) {
    return initialMessages;
  }

  // 创建一个 Map 来存储每个用户的最后已读信息
  const userLastReadMap = new Map<string, { username: string; avatar: string; timestamp: string, original_timestamp?: string }>();

  for (const userId in chat.last_seen_at) {
    if (userId === viewer_id) continue;

    const seenInfo = chat.last_seen_at[userId];
    const seenByUser = chat.users.find((u: any) => u.pk.toString() === userId);

    if (seenByUser) {
      // seenInfo may be either a primitive (e.g. number/string timestamp) or an object like { timestamp: ... }
      const rawSeenTimestamp = (seenInfo && typeof seenInfo === 'object' && 'timestamp' in seenInfo)
        ? (seenInfo as any).timestamp
        : seenInfo;

      // Normalize to string so later code can safely parse it. Keep undefined if not parseable.
      const originalTsStr = rawSeenTimestamp !== undefined && rawSeenTimestamp !== null
        ? String(rawSeenTimestamp)
        : undefined;

      userLastReadMap.set(userId, {
        username: seenByUser.username,
        avatar: seenByUser.profile_pic_url,
        timestamp: formatTimestamp(originalTsStr ?? ''),
        original_timestamp: originalTsStr
      });
    }
  }

  if (userLastReadMap.size === 0) {
    return initialMessages;
  }

  // 创建一个新数组，避免直接修改原始数组
  const messagesWithReceipts: Message[] = [];

  // 遍历所有真实消息
  for (let i = 0; i < initialMessages.length; i++) {
    const currentMessage = initialMessages[i];
    messagesWithReceipts.push(currentMessage); // 先把当前消息加进去

    // 检查当前消息之后，是否需要插入已读回执
    const nextMessage = initialMessages[i + 1];
    const usersWhoReadThisMessage: any[] = [];

    // 遍历所有已读用户
    for (const [userId, readInfo] of userLastReadMap.entries()) {
      // Parse timestamps into numbers with guards. Some messages/reads may use different shapes (ms vs s),
      // so we conservatively parse integers and skip if unparsable.
      const parsedReadTs = readInfo.original_timestamp ? parseInt(String(readInfo.original_timestamp), 10) : NaN;

      // Fallback to message.timestamp if original_timestamp is missing
      const parsedCurrentTs = currentMessage.original_timestamp
        ? parseInt(String(currentMessage.original_timestamp), 10)
        : (currentMessage.timestamp ? parseInt(String(currentMessage.timestamp), 10) : NaN);

      let shouldPlaceReceiptHere = false;

      if (!isNaN(parsedReadTs) && !isNaN(parsedCurrentTs)) {
        if (nextMessage && (nextMessage.original_timestamp || nextMessage.timestamp)) {
          const parsedNextTs = nextMessage.original_timestamp
            ? parseInt(String(nextMessage.original_timestamp), 10)
            : (nextMessage.timestamp ? parseInt(String(nextMessage.timestamp), 10) : NaN);

          if (!isNaN(parsedNextTs)) {
            // Place receipt if read timestamp is >= current and < next
            if (parsedCurrentTs <= parsedReadTs && parsedReadTs < parsedNextTs) {
              shouldPlaceReceiptHere = true;
            }
          }
        } else {
          // Last message in the list: place receipt if read timestamp is after or equal to current
          if (parsedCurrentTs <= parsedReadTs) {
            shouldPlaceReceiptHere = true;
          }
        }
      }

      if (shouldPlaceReceiptHere) {
        usersWhoReadThisMessage.push({
          userId,
          ...readInfo
        });
        // 从 Map 中移除，表示已经处理过这位用户
        userLastReadMap.delete(userId);

      }
    }

    // 如果有多人同时看过了这条消息作为最后一条，我们将它们合并成一个回执
    if (usersWhoReadThisMessage.length > 0) {
      // 在这里，我们只为第一个用户创建回执，以避免UI混乱。
      // 一个更高级的实现可以创建一个聚合的回执（例如 "Alice 和 Bob 已读"）。
      // 为了简单和修复bug，我们只取第一个。
      const representativeUser = usersWhoReadThisMessage[0];

      const readReceiptMessage: Message = {
        id: `receipt-${representativeUser.userId}-${representativeUser.original_timestamp}`,
        type: 'read_receipt',
        readBy: representativeUser,
        content: '',
        isOwn: false,
        timestamp: representativeUser.timestamp,
        original_timestamp: representativeUser.original_timestamp,
      };
      messagesWithReceipts.push(readReceiptMessage);

    }
  }

  return messagesWithReceipts;
};


export function useChatData(loggedInUser: string | null) {
  const [contactsData, setContactsData] = useState<ContactData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchChatData = useCallback(async () => {
    if (!loggedInUser) {
      setContactsData([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // ✅ response 现在会包含 presence
      const response = await window.ipcAPI.fetchChatData(loggedInUser);

      if (response.chats && response.success) {
        console.log('get chat data successfully');
        const presenceMap = response.presence || {}; // 获取在线状态 Map

        const chatData: ContactData[] = response.chats.map((chat) => {
          const viewer_id = chat.viewer_id.toString();
          let contactStatus: "online" | "offline" = "offline"; // 默认为离线
          let chatPartner: any = null;
          console.log(chat.thread_title, chat.last_seen_at)
          // ✅ 确定初始在线状态
          if (!chat.is_group && chat.users.length > 0) {
            // 私聊，找到对方用户
            chatPartner = chat.users[0]; // 私聊时，users[0] 通常是对方
            const partnerId = chatPartner.pk.toString();

            if (presenceMap[partnerId] && presenceMap[partnerId].is_active) {
              contactStatus = "online";
            }
          }

          const chat_avatar = chat.is_group
            ? 'placeholder-logo.png'
            : chatPartner?.profile_pic_url ?? 'placeholder-logo.png';

          const initialMessages = (chat.items ?? []).map((msg: ExtDirectInboxFeedResponseItemsItem) => {
            return formatInstagramMessage(msg, viewer_id);
          }).reverse();

          const messagesWithReceipts = processReadReceipts(chat, initialMessages, viewer_id);

          return {
            id: chat.thread_id,
            name: chat.thread_title,
            avatar: chat_avatar,
            status: contactStatus, // ✅ 使用我们刚刚计算出的初始状态
            lastMessage: chat.last_permanent_item.text ?? '[多媒體訊息]',
            timestamp: formatTimestamp(chat.last_activity_at),
            unreadCount: chat.read_state,
            messages: messagesWithReceipts,
            nextCursor: chat.oldest_cursor,
            hasMoreMessages: chat.has_older,
            isFetchingMore: false,
            // 填充额外的数据以供实时更新使用
            is_group: chat.is_group,
            users: chat.users,
            last_seen_at: chat.last_seen_at,
            viewer_id: viewer_id,
          };
        });
        setContactsData(chatData);
      } else if (response.error) {
        setError(response.error);
      }
    } catch (err: any) {
      console.error("Error fetching chat data:", err);
      setError(err.message || "載入聊天記錄失敗，請稍後再試");
    } finally {
      setIsLoading(false);
    }
  }, [loggedInUser]);

  useEffect(() => {
    fetchChatData();
  }, [fetchChatData]);

  // Realtime 訊息監聽器
  useEffect(() => {
    if (!loggedInUser) return;

    console.log("Setting up new message listener...");

    const cleanup = window.ipcAPI.onNewMessage((data) => {
      const { thread_id, msg: newMessage } = data;
      console.log("Received new message from main process:", { thread_id, newMessage });

      setContactsData(prevContacts => {
        let contactFound = false;
        const updatedContacts = prevContacts.map(contact => {
          if (contact.id === thread_id) {
            contactFound = true;
            // 避免重複添加
            if (contact.messages.some(m => m.id === newMessage.id)) {
              return contact;
            }
            return {
              ...contact,
              messages: [...contact.messages, newMessage],
              lastMessage: newMessage.content,
              timestamp: newMessage.timestamp,
            };
          }
          return contact;
        });

        if (!contactFound) {
          // 如果是新對話，可以選擇重新拉取所有資料或構造一個新的 ContactData 物件
          // 為了簡單，我們先忽略這種情況，或標記需要重新加載
          console.warn(`Received message for an unknown thread: ${thread_id}. Consider reloading.`);
          return prevContacts;
        }

        // 將有新消息的對話移到最頂部
        const contactToMove = updatedContacts.find(c => c.id === thread_id);
        const otherContacts = updatedContacts.filter(c => c.id !== thread_id);
        return contactToMove ? [contactToMove, ...otherContacts] : updatedContacts;
      });
    });


    return () => {
      console.log("Cleaning up new message listener...");
      cleanup();
    };
  }, [loggedInUser]);

  useEffect(() => {
    if (!loggedInUser) return;

    console.log("Setting up read receipt listener...");

    const cleanup = window.ipcAPI.onReadReceiptUpdate((update: ReadReceiptUpdate) => {
      console.log("Received read receipt update from main process:", update);

      setContactsData(prevContacts => {
        const contactIndex = prevContacts.findIndex(c => c.id === update.thread_id);
        if (contactIndex === -1) {
          return prevContacts; // 找不到对应的对话
        }

        const targetContact = prevContacts[contactIndex];

        // 1. 模拟一个 'chat' 物件，以便复用 processReadReceipts
        // 首先，我们需要从 contact 中获取用户列表
        // 注意：ContactData 需要包含 users 列表才能工作
        if (!targetContact.users) {
          console.warn("ContactData is missing 'users' array, cannot process read receipt.");
          return prevContacts;
        }

        // 创建或更新 last_seen_at 对象
        const newLastSeenAt = { ...targetContact.last_seen_at };
        newLastSeenAt[update.user_id] = {
          timestamp: update.timestamp,
          // 其他属性可以伪造，因为 processReadReceipts 不使用它们
          item_id: '',
          created_at: '',
        };

        const mockChatObject = {
          users: targetContact.users,
          last_seen_at: newLastSeenAt,
          // 其他 processReadReceipts 可能需要的属性
        };

        // 2. 移除旧的已读回执标记
        const messagesWithoutOldReceipts = targetContact.messages.filter(
          msg => msg.type !== 'read_receipt'
        );

        // 3. 使用更新后的 last_seen_at 重新计算已读回执
        const viewer_id = prevContacts.find(c => c.id === update.thread_id)?.viewer_id ?? ''; // 需要 viewer_id
        const newMessagesWithReceipts = processReadReceipts(mockChatObject, messagesWithoutOldReceipts, viewer_id);

        // 4. 更新 contact 数据
        const updatedContact = {
          ...targetContact,
          messages: newMessagesWithReceipts,
          last_seen_at: newLastSeenAt, // 保存最新的已读状态
        };

        const newContactsData = [...prevContacts];
        newContactsData[contactIndex] = updatedContact;

        return newContactsData;
      });
    });

    return () => {
      console.log("Cleaning up read receipt listener...");
      cleanup();
    };
  }, [loggedInUser, contactsData]); // 依赖项可能需要加上 contactsData 才能拿到最新的 users 列表

  useEffect(() => {
    if (!loggedInUser) return;

    console.log("Setting up presence listener...");

    const cleanup = window.ipcAPI.onPresenceUpdate((update: PresenceUpdate) => {
      console.log("Received presence update from main process:", update);

      setContactsData(prevContacts =>
        prevContacts.map(contact => {
          // 检查这个联系人是否是私聊，并且对方就是更新的这个用户
          // 注意：ContactData 需要包含 users 列表
          const isTargetUserInChat = contact.users?.some(
            (user: any) => user.pk.toString() === update.user_id
          );

          if (!contact.is_group && isTargetUserInChat) {
            // 是目标私聊联系人，更新状态
            return {
              ...contact,
              status: update.is_active ? "online" : "offline",
              // 你也可以更新一个更精确的 last_activity 时间戳
              // timestamp: formatTimestamp(update.last_activity_at_ms) 
            };
          }

          // 如果是群聊，你可以选择在联系人头像旁边显示在线成员的小绿点
          // 这里为了简单，我们只更新私聊的整体状态
          return contact;
        })
      );
    });

    return () => {
      console.log("Cleaning up presence listener...");
      cleanup();
    };
  }, [loggedInUser]); // 这里的依赖项很简单


  // 加載更多訊息
  const fetchMore = useCallback(async (threadId: string) => {
    const targetContact = contactsData.find(c => c.id === threadId);
    if (!targetContact || !targetContact.hasMoreMessages || targetContact.isFetchingMore || !loggedInUser) {
      return;
    }

    setContactsData(prev => prev.map(c =>
      c.id === threadId ? { ...c, isFetchingMore: true } : c
    ));

    try {
      const response = await window.ipcAPI.fetchMoreMessages({
        username: loggedInUser,
        thread_id: threadId,
        cursor: targetContact.nextCursor,
      });

      if (response.success && response.messages) {
        setContactsData(prev => prev.map(c => {
          if (c.id === threadId) {
            // 過濾掉可能重複的訊息
            const existingMessageIds = new Set(c.messages.map(m => m.id));
            const newMessages = (response.messages ?? []).filter(m => !existingMessageIds.has(m.id));

            return {
              ...c,
              messages: [...newMessages, ...c.messages],
              nextCursor: response.nextCursor,
              hasMoreMessages: response.hasMore ?? false,
              isFetchingMore: false,
            };
          }
          return c;
        }));
      } else {
        console.error("Failed to fetch more:", response.error);
        setContactsData(prev => prev.map(c =>
          c.id === threadId ? { ...c, isFetchingMore: false } : c
        ));
      }
      return response;
    } catch (err: any) {
      console.error(err);
      setContactsData(prev => prev.map(c =>
        c.id === threadId ? { ...c, isFetchingMore: false } : c
      ));
      return { success: false, error: err.message };
    }
  }, [contactsData, loggedInUser]);

  // 側邊欄聯絡人列表
  const sidebarContacts: ChatContact[] = contactsData.map((contact) => ({
    id: contact.id,
    name: contact.name,
    avatar: contact.avatar,
    lastMessage: contact.lastMessage,
    timestamp: contact.timestamp,
    unreadCount: contact.unreadCount,
    isOnline: contact.status === "online",
    status: contact.status
  }));

  return {
    contactsData,
    setContactsData,
    sidebarContacts,
    isLoading,
    error,
    fetchMore,
    reload: fetchChatData, // 提供一個重新加載的函式
  };
}