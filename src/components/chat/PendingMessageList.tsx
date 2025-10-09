"use client";

import { Message } from "@/types/chat";
import { Loader2, AlertCircle, X, RefreshCw } from "lucide-react";
import { Button } from "../ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface PendingMessagesListProps {
    messages: Message[];
    onRetry: (clientContext: string) => void;
    onRemove: (clientContext: string) => void;
}

export function PendingMessagesList({ messages, onRetry, onRemove }: PendingMessagesListProps) {
    if (messages.length === 0) return null;

    return (
        <div className="border border-border bg-card rounded-lg shadow-lg p-2 space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
            <div className="text-xs font-semibold text-muted-foreground mb-1 pl-1 select-none">發送中訊息</div>
            <AnimatePresence>
                {messages.map((msg) => (
                    <motion.div
                        key={msg.id}
                        layout
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0, transition: { duration: 0.15 } }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="overflow-hidden"
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            {msg.status === "sending" && (
                                <Loader2 className="h-4 w-4 text-muted-foreground animate-spin flex-shrink-0" />
                            )}
                            {msg.status === "failed" && (
                                <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                            )}
                            <p className="truncate text-muted-foreground">{msg.content}</p>
                        </div>

                        {msg.status === "failed" && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <Button size="sm" variant="ghost" onClick={() => onRetry(msg.clientContext!)} className="h-7 w-7 p-0">
                                    <RefreshCw className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => onRemove(msg.clientContext!)} className="h-7 w-7 p-0">
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        )}
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}