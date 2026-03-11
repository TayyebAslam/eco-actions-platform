"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface BackLinkButtonProps {
  href: string;
  label?: string;
  className?: string;
}

export function BackLinkButton({
  href,
  label = "Back",
  className = "",
}: BackLinkButtonProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 text-emerald-600 shadow-sm transition-all duration-200 hover:-translate-x-0.5 hover:bg-emerald-500/20 hover:shadow-md hover:shadow-emerald-500/20 dark:text-emerald-400",
        className,
      )}
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/20 transition-colors group-hover:bg-emerald-500/30">
        <ArrowLeft className="h-4 w-4" />
      </span>
      <span className="text-sm font-semibold">{label}</span>
    </Link>
  );
}
