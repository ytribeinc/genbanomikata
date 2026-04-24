"use client";

import { signOut } from "next-auth/react";
import { Button } from "./Button";

interface DashboardHeaderProps {
  userName?: string | null;
  onMenuToggle?: () => void;
}

export function DashboardHeader({ userName, onMenuToggle }: DashboardHeaderProps) {
  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6 flex-shrink-0">
      {/* Mobile hamburger */}
      <button
        className="lg:hidden p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
        onClick={onMenuToggle}
        aria-label="メニューを開く"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="hidden lg:block" />

      <div className="flex items-center gap-3">
        {userName && (
          <span className="text-sm text-gray-700 hidden sm:block">
            <span className="font-medium">{userName}</span> さん
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          ログアウト
        </Button>
      </div>
    </header>
  );
}
