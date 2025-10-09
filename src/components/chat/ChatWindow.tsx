"use client"

import { useRef, UIEvent, useLayoutEffect } from "react" // ✅ 引入 useLayoutEffect
import { ChatAvatar } from "./ChatAvatar"
import { MessageBubble } from "./MessageBubble"
// import { ChatInput } from "./ChatInput" // 假設 ChatInput 在父元件中
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"
import { Message } from "@/types/chat";

interface ChatWindowProps {
  contactName?: string
  contactAvatar?: string
  contactStatus?: "online" | "offline" | "away"
  messages?: Message[]
  onSendMessage?: (message: string) => void
  onFileUpload?: (file: File) => void
  className?: string
  onFetchMore?: () => void;
  hasMore?: boolean;
  isFetchingMore?: boolean;
}

export function ChatWindow({
  contactName = "Alice Chen",
  contactAvatar,
  contactStatus = "online",
  messages = [],
  className,
  onFetchMore,
  hasMore,
  isFetchingMore,
}: ChatWindowProps) {
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastMessageIdRef = useRef<string | undefined>(undefined);

  // ✅ 優化滾動邏輯的 Refs
  const shouldScrollToBottom = useRef(true); // 判斷是否應該滾動到底部
  const scrollHeightBeforeLoad = useRef<number | null>(null); // 儲存加載前的 scrollHeight

  // ✅ 處理滾動事件以加載更多
  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = container;

    if (scrollTop < 5 && hasMore && !isFetchingMore) {
      shouldScrollToBottom.current = false;
      scrollHeightBeforeLoad.current = scrollHeight;
      onFetchMore?.();
    }

    // 如果滚动条不在最底部，就禁用自动滚动
    if (scrollHeight - scrollTop - clientHeight > 1) { // 使用 1px 误差
      shouldScrollToBottom.current = false;
    } else {
      // 如果用户自己又滚动回了底部，重新启用自动滚动
      shouldScrollToBottom.current = true;
    }
  };

  useLayoutEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const currentLastMessageId = messages.length > 0 ? messages[messages.length - 1].id : undefined;

    if (scrollHeightBeforeLoad.current !== null) {
      // 场景 A: 加载了更多旧消息
      const scrollHeightAfterLoad = container.scrollHeight;
      container.scrollTop = scrollHeightAfterLoad - scrollHeightBeforeLoad.current;
      scrollHeightBeforeLoad.current = null;
    } else if (currentLastMessageId !== lastMessageIdRef.current && !isFetchingMore) {
      // 场景 B: 收到了新消息
      const lastMessage = messages[messages.length - 1];
      const isOwnMessage = lastMessage?.isOwn === true;

      if (isOwnMessage) {
        // 如果是自己发送的消息，强制启用自动滚动并立即滚动
        shouldScrollToBottom.current = true;
      }

      if (shouldScrollToBottom.current && messagesEndRef.current) {
        // ✅ 恢复使用 scrollIntoView 来实现平滑滚动
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }

    lastMessageIdRef.current = currentLastMessageId;

  }, [messages, isFetchingMore]);

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      {/* Header */}
      <div className="p-4 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ChatAvatar src={contactAvatar} alt={contactName} status={contactStatus} size="md" />
            <div>
              <h3 className="font-semibold text-card-foreground">{contactName}</h3>
              <p className="text-sm text-muted-foreground">
                {contactStatus === "online" ? "線上" : contactStatus === "away" ? "離開" : "離線"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* <Button variant="ghost" size="sm" className="h-9 w-9 p-0"><Phone className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0"><Video className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0"><Info className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0"><MoreVertical className="h-4 w-4" /></Button> */}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto custom-scrollbar p-4"
      >
        <div className="flex flex-col space-y-4">
          {isFetchingMore && (
            <div className="flex justify-center items-center my-4">
              <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
            </div>
          )}

          {messages.map((message) => {
            // console.log(message)
            // console.log(message.readBy)
            // ✅ 核心改動：渲染已讀回執
            if (message.type === 'read_receipt' && message.readBy) {
              return (
                <div key={message.id} className="flex items-center justify-end gap-2 my-1 mr-2 self-end">
                  <span className="text-xs text-muted-foreground">
                    {/* 可以根據是否為群聊顯示不同文字 */}
                    {contactName?.includes('和') ? `${message.readBy.username} 已看過` : `${message.readBy.timestamp} 已看過`}
                  </span>
                  <ChatAvatar
                    src={message.readBy.avatar}
                    alt={message.readBy.username}
                    size="sm"
                  />
                </div>
              );
            }

            // 正常渲染 MessageBubble
            return (
              <MessageBubble
                key={message.id}
                content={message.content!} // 使用 ! 斷言，因為非 read_receipt 類型必有 content
                timestamp={String(message.timestamp)}
                isOwn={message.isOwn}
                avatar={message.senderAvatar || contactAvatar}
                senderName={message.senderName}
                type={message.type}
                // fileName={message.fileName}
                // fileSize={message.fileSize}
                imageUrl={message.imageUrl}
              // status={message.status} // 傳遞 status 給 MessageBubble
              />
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input - 假設已移至父元件 */}
      {/* <ChatInput onSendMessage={handleSendMessage} onFileUpload={handleFileUpload} placeholder="輸入訊息..." /> */}
    </div>
  )
}