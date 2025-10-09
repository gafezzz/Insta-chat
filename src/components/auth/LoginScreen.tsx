"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { Label } from "../ui/label"
import { Alert, AlertDescription } from "../ui/alert"
import { Loader2, MessageCircle, Eye, EyeOff, X } from "lucide-react"
import { ChatAvatar } from "../chat/ChatAvatar";
import { SavedUser } from "@/types/electron";

interface LoginScreenProps {
  onLoginSuccess: (username: string) => void
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [savedUsers, setSavedUsers] = useState<SavedUser[]>([])

  // ✅ 效果 1: 元件掛載時，從後端獲取已儲存的用戶列表
  useEffect(() => {
    const fetchSavedUsers = async () => {
      if (typeof window !== "undefined" && window.ipcAPI) {
        try {
          // 假設 getSavedUsers 返回 SavedUser[] 類型
          const users = await window.ipcAPI.getSavedUsers();
          console.log(users)
          // 嘗試把 avatar 轉成 data URL（如果主進程已下載或能下載遠端檔案）
          const enriched = await Promise.all(
            (users || []).map(async (u: SavedUser) => {
              if (!u?.avatar) return u;
              try {
                const dataUrl = await window.ipcAPI.getAvatarDataUrl(u.avatar);
                return { ...u, avatar: dataUrl ?? u.avatar };
              } catch (err) {
                console.warn('Failed to get avatar data URL for', u.username, err);
                return u;
              }
            })
          );
          setSavedUsers(enriched);
        } catch (e) {
          console.error("Failed to get saved users:", e);
        }
      }
    };
    fetchSavedUsers();
  }, []); // 空依賴陣列，只在初次渲染時執行

  // ✅ 函式 1: 處理手動輸入用戶名和密碼的登入
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError("請輸入用戶名");
      return;
    }
    // 密碼可以為空，因為可能是 session 登入

    await performLogin(username, password);
  }

  // ✅ 函式 2: 處理點擊已儲存用戶的快速登入
  const handleQuickLogin = async (savedUsername: string) => {
    // 填充用戶名，清空密碼框，然後執行登入
    setUsername(savedUsername);
    setPassword("");
    await performLogin(savedUsername, ""); // 傳入空密碼，讓後端優先嘗試 session
  }

  // ✅ 函式 3: 處理移除已儲存用戶的邏輯
  const handleRemoveSavedUser = async (userToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation(); // ✅ 阻止事件冒泡觸發 handleQuickLogin

    if (confirm(`確定要從此裝置移除 ${userToRemove} 的登入資訊嗎？`)) {
      if (window.ipcAPI) {
        try {
          const result = await window.ipcAPI.removeSavedUser(userToRemove);
          if (result.success) {
            // 從 UI 中移除用戶
            setSavedUsers(prev => prev.filter(u => u.username !== userToRemove));
            // 如果移除的是當前輸入框中的用戶，清空輸入框
            if (username === userToRemove) {
              setUsername("");
            }
          } else {
            setError(result.error || "移除失敗");
          }
        } catch (err: any) {
          setError(err.message || "移除過程中發生錯誤");
        }
      }
    }
  }

  // ✅ 核心函式: 抽離出共用的登入邏輯
  const performLogin = async (userToLogin: string, pass: string) => {
    setIsLoading(true);
    setError("");

    try {
      if (window.ipcAPI) {
        const result = await window.ipcAPI.loginToIg(userToLogin, pass);
        if (result.success && result.username) {
          onLoginSuccess(result.username);
        } else {
          setError(result.error || "登入失敗，未知錯誤");
        }
      } else {
        // 模擬登入
        console.log("[v0] Development mode - simulating login");
        setTimeout(() => onLoginSuccess(userToLogin), 1000);
      }
    } catch (err: any) {
      console.error("[v0] Login error:", err);
      setError(err.message || "登入過程中發生錯誤，請稍後再試");
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <MessageCircle className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Instagram 聊天</CardTitle>
          <CardDescription>請輸入您的 Instagram 帳號資訊以開始聊天</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">用戶名</Label>
              <Input
                id="username"
                type="text"
                placeholder="輸入您的用戶名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                className="bg-muted/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">密碼</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="密碼 (如果 Session 失效則需要)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="bg-muted/50 pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  登入中...
                </>
              ) : (
                "登入"
              )}
            </Button>
          </form>
          {savedUsers.length > 0 && (
            <div className="mt-6">
              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">或選擇已儲存的帳號</span>
                </div>
              </div>
              <div className="space-y-2">
                {savedUsers.map((user) => (
                  <button
                    key={user.username}
                    onClick={() => handleQuickLogin(user.username)}
                    disabled={isLoading}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent transition-colors text-left group disabled:opacity-50 hover:cursor-pointer disabled:cursor-not-allowed"
                  >
                    <ChatAvatar src={user.avatar} alt={user.username} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{user.username}</p>
                      <p className="text-xs text-muted-foreground">
                        上次登入: {new Date(user.lastLogin).toLocaleDateString("zh-TW")}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => handleRemoveSavedUser(user.username, e)}
                      disabled={isLoading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}