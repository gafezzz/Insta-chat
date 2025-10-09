"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { cn } from "../../lib/utils"
import { Send, Paperclip, Smile } from "lucide-react"

interface ChatInputProps {
  onSendMessage?: (message: string) => void
  onFileUpload?: (file: File) => void
  placeholder?: string
  className?: string
}

const defaultEmojis = ["😀", "😂", "❤️", "👍", "👎", "😢", "😮", "😡"]

export function ChatInput({ onSendMessage, onFileUpload, placeholder = "輸入訊息...", className }: ChatInputProps) {
  const [message, setMessage] = useState("")
  const [showEmojis, setShowEmojis] = useState(false)

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage?.(message.trim())
      setMessage("")
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onFileUpload?.(file)
    }
  }

  const addEmoji = (emoji: string) => {
    setMessage((prev) => prev + emoji)
    setShowEmojis(false)
  }

  return (
    <div className={cn("relative", className)}>
      {/* Emoji Picker */}
      {showEmojis && (
        <div className="absolute bottom-full left-0 mb-2 p-3 bg-card border rounded-lg shadow-lg">
          <div className="grid grid-cols-4 gap-2">
            {defaultEmojis.map((emoji, index) => (
              <button
                key={index}
                onClick={() => addEmoji(emoji)}
                className="p-2 hover:bg-accent rounded text-lg transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-end gap-2 p-4 bg-card border-t">
        {/* File Upload */}
        <div className="relative">
          <input
            type="file"
            id="file-upload"
            className="hidden"
            onChange={handleFileUpload}
            accept="image/*,.pdf,.doc,.docx,.txt"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => document.getElementById("file-upload")?.click()}
            className="h-10 w-10 p-0"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
        </div>

        {/* Message Input */}
        <div className="flex-1 relative">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            className="pr-10 resize-none min-h-10 max-h-32"
          />

          {/* Emoji Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowEmojis(!showEmojis)}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
          >
            <Smile className="h-4 w-4" />
          </Button>
        </div>

        {/* Send Button */}
        <Button onClick={handleSend} disabled={!message.trim()} size="sm" className="h-10 w-10 p-0">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
