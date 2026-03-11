"use client";

import { useAuth } from "@/providers/auth-provider";
import { useTheme } from "@/providers/theme-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NotificationModal } from "@/components/ui/notification-modal";
import {
  Menu,
  LogOut,
  User,
  PanelLeftClose,
  PanelLeft,
  Search,
  ChevronDown,
  Leaf,
} from "lucide-react";
import { getInitials } from "@/lib/utils";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface HeaderProps {
  onMenuClick: () => void;
  sidebarOpen?: boolean;
  onSidebarToggle?: () => void;
}

export function Header({
  onMenuClick,
  sidebarOpen,
  onSidebarToggle,
}: HeaderProps) {
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const userName =
    user?.first_name && user?.last_name
      ? `${user.first_name} ${user.last_name}`
      : user?.email || "User";

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex gap-5 h-16 items-center justify-between border-b px-4 lg:px-6 backdrop-blur-xl transition-colors duration-300",
        isDark
          ? "bg-slate-900/80 border-slate-800"
          : "bg-white/80 border-gray-100",
      )}
    >
      {/* Left side */}
      <div className="flex items-center gap-3 w-full">
        <div className="flex h-10 shrink-0 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 shadow-lg shadow-emerald-500/25 transition-shadow duration-300">
          <Leaf className="h-5 w-5 text-white" />
        </div>
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "lg:hidden",
            isDark
              ? "text-gray-400 hover:text-white hover:bg-slate-800"
              : "text-gray-500 hover:text-gray-900 hover:bg-gray-100",
          )}
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex gap-2">
          {/* Desktop sidebar toggle button */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "hidden lg:flex rounded-xl",
              isDark
                ? "text-gray-400 hover:text-white hover:bg-slate-800"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-100",
            )}
            onClick={onSidebarToggle}
            title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          >
            {sidebarOpen ? (
              <PanelLeftClose className="h-5 w-5" />
            ) : (
              <PanelLeft className="h-5 w-5" />
            )}
          </Button>
        </div>

        {/* Search bar - Desktop only */}
        <div className="hidden md:flex items-center w-full">
          <div className="relative flex-1 w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search anything..."
              className="pl-9 w-full"
            />
          </div>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1">
        {/* Notification button */}
        <NotificationModal isDark={isDark} />

        {/* Divider */}
        <div
          className={cn(
            "hidden sm:block w-px h-8 mx-2",
            isDark ? "bg-slate-700" : "bg-gray-200",
          )}
        />

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                "flex items-center gap-2 h-auto py-1.5 px-2 rounded-xl transition-all duration-200",
                isDark ? "hover:bg-slate-800" : "hover:bg-gray-100",
              )}
            >
              <div className="relative">
                <Avatar className="h-9 w-9 ring-2 ring-emerald-500/20">
                  <AvatarImage
                    src={user?.avatar_url}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-green-600 text-white text-xs font-semibold">
                    {getInitials(userName)}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-white dark:ring-slate-900" />
              </div>
              <div className="hidden sm:flex flex-col items-start max-w-[150px]">
                <span
                  className={cn(
                    "text-sm font-semibold leading-tight truncate w-full",
                    isDark ? "text-white" : "text-gray-900",
                  )}
                >
                  {userName}
                </span>
                <span
                  className={cn(
                    "text-[10px] capitalize leading-tight",
                    isDark ? "text-gray-400" : "text-gray-500",
                  )}
                >
                  {user?.job_title_name || user?.role?.replace(/_/g, " ")}
                </span>
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 hidden sm:block",
                  isDark ? "text-gray-500" : "text-gray-400",
                )}
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className={cn(
              "w-64 p-2 rounded-xl shadow-xl",
              isDark
                ? "bg-slate-800 border-slate-700"
                : "bg-white border-gray-100",
            )}
          >
            <DropdownMenuLabel className="px-2 pb-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12 ring-2 ring-emerald-500/20">
                  <AvatarImage
                    src={user?.avatar_url}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-green-600 text-white font-semibold">
                    {getInitials(userName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p
                          className={cn(
                            "font-semibold truncate cursor-default",
                            isDark ? "text-white" : "text-gray-900",
                          )}
                        >
                          {userName}
                        </p>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className={cn(
                          "text-xs font-medium shadow-lg border",
                          isDark
                            ? "bg-slate-700 text-white border-slate-600"
                            : "bg-gray-900 text-white border-gray-800",
                        )}
                      >
                        {userName}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p
                          className={cn(
                            "text-xs truncate cursor-default",
                            isDark ? "text-gray-400" : "text-gray-500",
                          )}
                        >
                          {user?.email}
                        </p>
                      </TooltipTrigger>
                      <TooltipContent
                        side="bottom"
                        className={cn(
                          "text-xs font-medium shadow-lg border",
                          isDark
                            ? "bg-slate-700 text-white border-slate-600"
                            : "bg-gray-900 text-white border-gray-800",
                        )}
                      >
                        {user?.email}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <span className="inline-flex items-center px-2 py-0.5 mt-1 text-[10px] font-medium bg-emerald-100 text-emerald-700 rounded-full capitalize dark:bg-emerald-900/50 dark:text-emerald-400">
                    {user?.job_title_name || user?.role?.replace(/_/g, " ")}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className={isDark ? "bg-slate-700" : ""} />
            <DropdownMenuItem
              asChild
              className={cn(
                "rounded-lg cursor-pointer",
                isDark ? "hover:bg-slate-700 focus:bg-slate-700" : "",
              )}
            >
              <Link
                href="/dashboard/profile"
                className="flex items-center gap-2 py-2"
              >
                <div
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-lg",
                    isDark ? "bg-slate-700" : "bg-gray-100",
                  )}
                >
                  <User
                    className={cn(
                      "h-4 w-4",
                      isDark ? "text-gray-400" : "text-gray-600",
                    )}
                  />
                </div>
                <div>
                  <p
                    className={cn(
                      "font-medium",
                      isDark ? "text-white" : "text-gray-900",
                    )}
                  >
                    Profile
                  </p>
                  <p
                    className={cn(
                      "text-xs",
                      isDark ? "text-gray-500" : "text-gray-500",
                    )}
                  >
                    View your profile
                  </p>
                </div>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className={isDark ? "bg-slate-700" : ""} />
            <DropdownMenuItem
              onClick={logout}
              className="rounded-lg cursor-pointer text-destructive hover:text-destructive-strong hover:bg-destructive/10 focus:bg-destructive/10 focus:text-destructive"
            >
              <div className="flex items-center gap-2 py-2">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-destructive/15">
                  <LogOut className="h-4 w-4 text-destructive" />
                </div>
                <div>
                  <p className="font-medium">Sign Out</p>
                  <p className="text-xs text-destructive/60">
                    End your session
                  </p>
                </div>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
