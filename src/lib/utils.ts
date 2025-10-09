import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { ExtMessage, ExtDirectInboxFeedResponseItemsItem, Message, MessageType } from "@/types/chat";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
export function formatTimestamp(timestamp: number | string | bigint): string {
  const date = new Date(Number(timestamp) / 1000)

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date);
}
export function formatInstagramMessage(msg: ExtMessage | ExtDirectInboxFeedResponseItemsItem, viewer_id: string): Message {
  const isOwn = msg.user_id.toString() === viewer_id;
  let type: MessageType = 'text';
  let content: string = msg.text ?? '';
  let imageUrl: string | undefined = undefined;

  switch (msg.item_type) {
    case 'text':
      type = 'text';
      break;

    case 'media':
      imageUrl = msg.media?.image_versions2?.candidates[0]?.url;
      if (imageUrl) {
        type = 'image';
        content = '[圖片]'; // for sidebar preview
      } else {
        type = 'unsupported';
        content = '[不支援的多媒體訊息]';
      }
      break;

    // raven_media
    case 'raven_media':
      imageUrl = msg.visual_media?.media?.image_versions2?.candidates[0]?.url;
      if (imageUrl) {
        type = 'image';
        content = '[閱後即焚相片]';
      } else {
        type = 'unsupported';
        content = '[不支援的閱後即焚訊息]';
      }
      break;

    case 'link':
      type = 'link';
      content = msg.link?.text ?? '[連結]';
      break;

    case 'action_log':
      type = 'action_log';
      content = msg.action_log?.description ?? '[聊天室動態]';
      break;

    default:
      type = 'unsupported';
      content = '[不支援的訊息類型]';
      break;
  }

  return {
    id: msg.item_id,
    content: content,
    timestamp: formatTimestamp(msg.timestamp),
    original_timestamp: msg.timestamp.toString(),
    isOwn: isOwn,
    senderName: msg.profile?.full_name,
    senderAvatar: msg.profile?.profile_pic_url,
    type: type,
    imageUrl: imageUrl,
    clientContext: msg.client_context
  };
}