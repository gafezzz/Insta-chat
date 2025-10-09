import { cn } from "../../lib/utils"

interface NotificationBadgeProps {
  count: number
  show?: boolean
  className?: string
}

export function NotificationBadge({ count, show = true, className }: NotificationBadgeProps) {
  if (!show || count <= 0) return null

  return (
    <div
      className={cn(
        "absolute -top-1 -right-1 min-w-5 h-5 bg-red-500 text-white text-xs font-medium rounded-full flex items-center justify-center px-1",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </div>
  )
}
