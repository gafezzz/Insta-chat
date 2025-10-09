"use client"

import { useState } from "react"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { ChatAvatar } from "./ChatAvatar"
import { NotificationBadge } from "./NotificationBadge"
import { cn } from "@/lib/utils"
import { Search, ChevronLeft, ChevronRight, RefreshCw, LogOut } from "lucide-react"
import { ChatContact } from "@/types/chat";

interface ChatSidebarProps {
  contacts?: ChatContact[]
  activeContactId?: string | null
  onContactSelect?: (contactId: string) => void
  className?: string
  currentUser?: {
    username: string
    avatar?: string
  }
  onReload?: () => void
  isReloading: boolean
  onLogout?: () => void
}

const defaultContacts: ChatContact[] = []

export function ChatSidebar({
  contacts = defaultContacts,
  activeContactId,
  onContactSelect,
  className,
  currentUser,
  onReload,
  isReloading = false,
  onLogout
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [isExpanded, setIsExpanded] = useState(true)

  const filteredContacts = contacts.filter((contact) => contact.name.toLowerCase().includes(searchQuery.toLowerCase()))

  return (
    <div className="relative flex h-full">
      <div
        className={cn(
          "h-full bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out overflow-hidden flex flex-col",
          isExpanded ? "w-80" : "w-0",
          className,
        )}
      >
        {currentUser && (
          <div className="p-4 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <ChatAvatar src={currentUser.avatar} alt={currentUser.username} status="online" size="md" />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sidebar-foreground truncate">{currentUser.username}</h3>
                <p className="text-xs text-muted-foreground">線上</p>
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onLogout} title="登出">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-sidebar-foreground">訊息</h2>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={onReload}
                disabled={isReloading}
                title="重新載入聊天記錄"
              >
                <RefreshCw className={cn("h-4 w-4", isReloading && "animate-spin")} />
              </Button>
              {/* <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <Plus className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button> */}
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜尋聯絡人..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-sidebar-accent border-sidebar-border"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {filteredContacts.map((contact) => (
            <button
              key={contact.id}
              onClick={() => onContactSelect?.(contact.id)}
              className={cn(
                "w-full p-4 flex items-center gap-3 hover:bg-sidebar-accent transition-colors text-left cursor-pointer",
                activeContactId === contact.id && "bg-sidebar-accent",
              )}
            >
              <div className="relative">
                <ChatAvatar src={contact.avatar} alt={contact.name} status={contact.status} size="md" />
                <NotificationBadge count={contact.unreadCount} show={contact.unreadCount > 0} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-medium text-sidebar-foreground truncate">{contact.name}</h3>
                  <span className="text-xs text-muted-foreground">{contact.timestamp}</span>
                </div>
                <p className="text-sm text-muted-foreground truncate">{contact.lastMessage.toString()}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex gap-2">
            {/* <Button variant="ghost" size="sm" className="flex-1 justify-start">
              <Archive className="h-4 w-4 mr-2" />
              封存
            </Button>
            <Button variant="ghost" size="sm" className="flex-1 justify-start">
              <Settings className="h-4 w-4 mr-2" />
              設定
            </Button> */}
          </div>
        </div>
      </div>

      <Button
        variant="outline"
        size="icon"
        className="absolute -right-6 top-1/2 transform -translate-y-1/2 z-10 w-10 bg-transparent"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isExpanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4 ml-4" />}
      </Button>
    </div>
  )
}