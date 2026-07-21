"use client";

import { MessageSquare, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { ChatSidebarProps} from "../types";

export default function ChatSidebar({
    sessions,
    selectedSessionId,
    isLoadingSessions,
    sessionsError,
    isSending,
    onNewChat,
    onSelectSession,
    onDeleteSession,
}: ChatSidebarProps) {
    const [openMenuSessionId, setOpenMenuSessionId] = useState<string | null>(null);
    const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
   
    return (
        <aside className="flex h-full min-h-0 w-[290px] shrink-0 flex-col border-r border-[#e8ecf4] bg-[#f9fbff]">
            {/* Header */}
            <div className="border-b border-[#e8ecf4] p-4">
                <button
                    type="button"
                    onClick={onNewChat}
                    disabled={isSending}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#4f49e2] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70 hover:bg-[#433ccf] transition"
                >
                    <Plus className="h-4 w-4" />
                    New session
                </button>
                <p className="mt-3 text-xs text-[#6b7280]">User ID: user</p>
            </div>

            {/* Sessions List */}
            <div className="soft-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
                {isLoadingSessions ? (
                    <div className="space-y-2">
                        {Array.from({ length: 6 }).map((_, index) => (
                            <div
                                key={`session-skeleton-${index}`}
                                className="flex items-start gap-2 rounded-xl border border-[#e8ecf4] bg-white px-3 py-3 animate-pulse"
                            >
                                <span className="mt-0.5 h-4 w-4 rounded bg-[#edf2f9]" />
                                <div className="min-w-0 flex-1 space-y-2">
                                    <div className="h-3 w-11/12 rounded bg-[#edf2f9]" />
                                    <div className="h-3 w-7/12 rounded bg-[#edf2f9]" />
                                </div>
                                <span className="h-6 w-6 rounded-full bg-[#edf2f9]" />
                            </div>
                        ))}
                    </div>
                ) : sessions.length === 0 ? (
                    <p className="px-2 py-3 text-sm text-[#6b7280]">No sessions yet.</p>
                ) : (
                    sessions.map((session) => {
                        const isActive = session.id === selectedSessionId;

                        return (
                            <div
                                key={session.id}
                                onClick={() => {
                                    onSelectSession(session.id);
                                    setOpenMenuSessionId(null);
                                }}
                                className={`mb-2 cursor-pointer rounded-xl border px-3 py-2 transition ${isActive
                                        ? "border-[#c9d1ff] bg-[#eef2ff]"
                                        : "border-[#e8ecf4] bg-white hover:bg-[#fafbfc]"
                                    }`}
                            >
                                <div className="flex items-start gap-2">
                                    {/* Select Session Button */}
                                    <div className="flex min-w-0 flex-1 items-start gap-2 text-left">
                                        <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-[#4f49e2]" />
                                        <span className="line-clamp-2 break-all text-xs font-semibold text-[#1f2937]">
                                            {session.state?.first_message_summary || session.id}
                                        </span>
                                    </div>

                                    {/* Menu Button */}
                                    <div className="relative" data-session-menu="true">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setOpenMenuSessionId(
                                                    openMenuSessionId === session.id ? null : session.id
                                                );
                                            }}
                                            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[#6b7280] hover:bg-[#eef2ff] hover:text-[#4f49e2] transition"
                                            aria-label="Session actions"
                                        >
                                            <MoreHorizontal className="h-4 w-4" />
                                        </button>

                                        {/* Dropdown Menu */}
                                        {openMenuSessionId === session.id && (
                                            <div className="absolute right-0 z-20 mt-1 w-28 overflow-hidden rounded-lg border border-[#e5e7eb] bg-white shadow-[0_12px_24px_-20px_rgba(15,23,42,0.35)]">
                                                <button
                                                    type="button"
                                                    onClick={async (event) => {
                                                        event.stopPropagation();
                                                        setDeletingSessionId(session.id);
                                                        await onDeleteSession(session.id);
                                                        setOpenMenuSessionId(null);
                                                        setDeletingSessionId(null);
                                                    }}
                                                    disabled={deletingSessionId === session.id}
                                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-[#b91c1c] hover:bg-[#fff1f2] disabled:cursor-not-allowed disabled:opacity-70 transition"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                    {deletingSessionId === session.id ? "Deleting..." : "Delete"}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Error Message */}
            {sessionsError && (
                <p className="border-t border-[#e8ecf4] px-3 py-2 text-xs text-[#b91c1c]">
                    {sessionsError}
                </p>
            )}
        </aside>
    );
}
