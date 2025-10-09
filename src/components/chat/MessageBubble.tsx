"use client"

import { cn } from "@/lib/utils"
import { ChatAvatar } from "./ChatAvatar"
import { File, Download, MoreHorizontal, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

// MessageActions 子元件保持不變
interface MessageActionsProps {
  isOwn: boolean;
  type?: string;
  content: string;
  imageUrl?: string;
  onDownloadImage: () => void;
  onCopyText: () => void;
}

function MessageActions({ isOwn, type, content, imageUrl, onDownloadImage, onCopyText }: MessageActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          className="h-8 w-8 p-0 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600"
          // 防止點擊按鈕時觸發父元素的事件
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align={isOwn ? "end" : "start"} className="bg-zinc-800 border-zinc-700">
        {(type === "image" || type === "raven_media") && imageUrl && (
          <DropdownMenuItem onClick={onDownloadImage} className="hover:bg-zinc-700 focus:bg-zinc-700">
            <Download className="mr-2 h-4 w-4" />
            下載圖片
          </DropdownMenuItem>
        )}
        {(type === "text" || content) && (
          <DropdownMenuItem onClick={onCopyText} className="hover:bg-zinc-700 focus:bg-zinc-700">
            <Copy className="mr-2 h-4 w-4" />
            複製文字
          </DropdownMenuItem>
        )}
        {/* <DropdownMenuItem className="hover:bg-zinc-700 focus:bg-zinc-700">
          <Reply className="mr-2 h-4 w-4" />
          回覆
        </DropdownMenuItem>
        {isOwn && (
          <DropdownMenuItem className="hover:bg-zinc-700 focus:bg-zinc-700 text-red-400">
            <Trash2 className="mr-2 h-4 w-4" />
            刪除
          </DropdownMenuItem>
        )} */}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}


interface MessageBubbleProps {
  content: string
  timestamp: string
  isOwn?: boolean
  avatar?: string
  senderName?: string
  className?: string
  type?: string
  fileName?: string
  fileSize?: string
  imageUrl?: string
}

export function MessageBubble({
  content,
  timestamp,
  isOwn = false,
  avatar,
  senderName,
  className,
  type,
  fileName,
  fileSize,
  imageUrl,
}: MessageBubbleProps) {

  // ❗ 我們不再需要 isHovered state
  // const [isHovered, setIsHovered] = useState(false)

  const handleDownloadImage = () => {
    if (imageUrl && typeof window !== "undefined") {
      window.ipcAPI.downloadWebUrl(imageUrl)
    }
  }

  const handleCopyText = () => {
    if (content) {
      navigator.clipboard.writeText(content)
    }
  }

  const renderMessageContent = () => {
    // ... (這個函式保持不變)
    switch (type) {
      case "image":
      case "raven_media":
        return (
          <div className="space-y-2">
            {imageUrl && (
              <div className="relative rounded-lg overflow-hidden max-w-xs">
                <img src={imageUrl || "/placeholder.svg"} alt="image" className="w-full h-auto object-cover" />
              </div>
            )}
            {content && content !== '[media]' && content !== '[raven_media]' && <p className="text-sm leading-relaxed">{content}</p>}
          </div>
        )

      case "file":
        return (
          <div className="flex items-center gap-3 p-2">
            <div className={cn("p-2 rounded-lg", isOwn ? "bg-primary-foreground/20" : "bg-zinc-600")}>
              <File className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{fileName || "Unknown file"}</p>
              {fileSize && <p className="text-xs text-muted-foreground">{fileSize}</p>}
            </div>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-transparent">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        )
      default: // text
        return <p className="text-sm leading-relaxed">{content}</p>
    }
  }

  return (
    // ✅ 步驟 1: 在最外層容器上加上 'group' class，這樣 Tailwind 的 group-hover 才能生效
    <div
      className={cn(
        "group flex gap-3 max-w-[80%] relative",
        isOwn ? "ml-auto flex-row-reverse" : "",
        className
      )}
    // ❗ 移除 onMouseEnter 和 onMouseLeave
    >
      {!isOwn && <ChatAvatar src={avatar} alt={senderName || "User"} size="sm" />}

      <div className={cn("flex flex-col gap-1", isOwn ? "items-end" : "items-start")}>
        {!isOwn && senderName && <span className="text-xs text-muted-foreground px-3">{senderName}</span>}

        <div className="flex items-center gap-2">

          {/* ✅ 步驟 2: 創建一個容器來包裹 MessageActions，並使用 CSS 控制它的可見性 */}
          <div className={cn(
            "transition-opacity duration-200",
            isOwn ? "order-first" : "order-last", // 使用 flexbox 的 order 來控制位置
            "opacity-0 group-hover:opacity-100"   // 核心：平時透明，懸停時不透明
          )}>
            <MessageActions
              isOwn={isOwn}
              type={type}
              content={content}
              imageUrl={imageUrl}
              onDownloadImage={handleDownloadImage}
              onCopyText={handleCopyText}
            />
          </div>

          {/* 消息氣泡本身 */}
          <div
            className={cn(
              "rounded-2xl max-w-full break-words",
              type === "file" ? "p-2" : "px-4 py-2",
              type === "image" ? "bg-transparent" :
                isOwn
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-zinc-700 text-foreground rounded-bl-md",
            )}
          >
            {renderMessageContent()}
          </div>

        </div>

        <span className={cn("text-xs text-muted-foreground px-3", isOwn ? "text-right" : "text-left")}>
          {timestamp}
        </span>
      </div>
    </div>
  )
}