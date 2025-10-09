# InstaChat

一款基於 **Electron + React** 開發的非官方 Instagram 的 windows 桌面型聊天應用，
可用於檢視、接收及**下載閱後即焚圖片**，並支援部分基本聊天功能。  
⚠️ **本專案僅供學習與研究目的，請謹慎使用。**

> 由於涉及帳號密碼輸入等機密信息，本專案所使用的程式碼完全開源以確保安全性

---

## 開發動機

- Instagram 推出的 "閱後即焚圖片" 在手機上僅可點開檢視兩次並無法截圖或下載，電腦網頁甚至無法檢視。為了解決這個問題，開發了可以在電腦端無限制檢視和下載 "閱後即焚圖片" 的應用程式。

---

## 技術棧

- **Electron** — 桌面應用封裝
- **React** — 前端框架
- **Vite** — 快速構建與開發工具
- **shadcn/ui** — UI 元件庫
- [**instagram-private-api**](https://github.com/dilame/instagram-private-api) — 與 Instagram 非公開 API 溝通的開源第三方函式庫
- [**instagram_mqtt**](https://github.com/Nerixyz/instagram_mqtt) — 依賴於上者，用於監聽即時更新的訊息

---

## 功能概覽

- 檢視與下載 **閱後即焚圖片**  
  ⚠️（閱後即焚圖片於發送後 24 小時內自動過期失效，請儘快下載）
- 閱後即焚圖片可重複查看（繞過 IG 限制）
- 閱讀訊息時不會觸發已讀狀態
- 傳送與接收文字訊息
- 顯示聊天對方上線狀態
- 保存登入狀態 (避免重複登入被封號)

> - 傳送功能目前僅支援純文字訊息。
> - 影片與音訊端點已被官方棄用，暫不支援。圖片僅支援部分格式
> - 貼圖不支援傳送和檢視

---

## 使用方式

- 通過 github action 自動打包在 [release](https://github.com/zhongdet/insta-chat/releases)
- 安裝程式(建議): **Insta-chat-InstaChat-Windows-1.0.1-Setup.exe**
- 免安裝資料夾: **win-unpacked.zip**
  > - 打包方式透明: 目錄 ./github/workflow/release.yml
  > - 如遇到 「系統檢測到病毒」，關閉瀏覽器下載設定或改為下載安裝程式

---

## ⚠️ 注意事項

- 本專案使用 **非官方 API** ，請遵守 Instagram 使用條款。
- 若因使用本軟體導致帳號封禁、資料遺失等問題，作者概不負責。
- 僅供個人學習與研究，不建議用於任何生產或商業用途。
- 原理是模擬一系列 android 手機的登入，所以使用本專案登入後出現「huawai, redmi 等」遠古型號手機的異地登入紀錄屬正常現象 (這部分的登入邏輯也是開源的，詳見[instagram-private-api](https://github.com/dilame/instagram-private-api), 如果出現太多次登入依然需注意, 可能並非本專案造成的問題)
