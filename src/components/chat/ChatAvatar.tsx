import { cn } from "../../lib/utils"

interface ChatAvatarProps {
  src?: string
  alt?: string
  size?: "sm" | "md" | "lg"
  status?: "online" | "offline" | "away"
  className?: string
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
}

const statusColors = {
  online: "bg-green-500",
  offline: "hidden",
  away: "bg-yellow-500",
}

export function ChatAvatar({ src, alt = "User", size = "md", status, className }: ChatAvatarProps) {
  const initials = alt
    .split(" ")
    .map((name) => name[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className={cn("relative flex-shrink-0", className)}>
      <div
        className={cn(
          "rounded-full flex items-center justify-center text-white font-medium bg-gradient-to-br from-blue-500 to-purple-600",
          sizeClasses[size],
        )}
      >
        {src ? (
          <img src={src || "/placeholder-logo.png"} alt={alt} className="w-full h-full rounded-full object-cover" />
        ) : (
          <span
            className={cn(
              "text-white font-semibold",
              size === "sm" ? "text-xs" : size === "md" ? "text-sm" : "text-base",
            )}
          >
            {initials}
          </span>
        )}
      </div>

      {status && (
        <div
          className={cn(
            "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background",
            statusColors[status],
          )}
        />
      )}
    </div>
  )
}
