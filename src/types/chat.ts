export type MessageType = "text" | "image" | "file" | "link" | "action_log" | "unkown" | string
import type { DirectInboxFeedResponseItemsItem } from "instagram-private-api";
import type { MessageSyncMessageWrapper, MessageSyncMessage } from "instagram_mqtt";
export type ExtDirectInboxFeedResponseItemsItem = DirectInboxFeedResponseItemsItem & {
    [key: string]: any
}
export type ExtMessageWrapper = MessageSyncMessageWrapper & {
    [key: string]: any
}
export type ExtMessage = MessageSyncMessage & {
    [key: string]: any
}
export interface Message {
    id: string
    content: string
    timestamp: string | number | bigint,
    original_timestamp?: string
    isOwn: boolean
    senderName?: string
    senderAvatar?: string
    type?: MessageType
    fileName?: string
    fileSize?: string
    imageUrl?: string
    action_log?: string
    clientContext?: string
    status?: "sending" | "sent" | "failed"
    readBy?: {
        userId: string;
        username: string;
        avatar: string;
        timestamp: string; // 已读的时间
    };
}

export interface ContactData {
    id: string
    name: string
    avatar?: string
    status: "online" | "offline" | "away",
    lastMessage: string,
    timestamp: string,
    unreadCount: number
    messages: Message[],
    is_group: boolean
    nextCursor?: string,
    hasMoreMessages: boolean,
    isFetchingMore: boolean,
    users: any[]; // 存储原始的 users 数组
    last_seen_at?: Record<string, { timestamp: string;[key: string]: any }>; // 存储原始的 last_seen_at
    viewer_id: string; // 存储当前用户的 ID
}

export interface ChatContact {
    id: string
    name: string
    avatar?: string
    lastMessage: string
    timestamp: string
    unreadCount: number
    status?: "online" | "offline" | "away"
}
