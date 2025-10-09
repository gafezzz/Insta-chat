import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App.tsx"
import "./styles/globals.css"

// 設置深色主題
document.documentElement.classList.add("dark")

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
