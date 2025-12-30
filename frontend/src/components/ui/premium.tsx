import React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export const LabelPremium = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <div className={cn("text-[11px] font-bold text-muted-foreground/60 uppercase tracking-[0.08em] mb-1.5 flex items-center gap-2", className)}>
    {children}
  </div>
);

export const SectionPremium = ({ title, children, icon: Icon, className }: { title?: string, children: React.ReactNode, icon?: LucideIcon, className?: string }) => (
  <div className={cn("space-y-3 p-4 rounded-2xl bg-muted/20 border border-muted/30 transition-all hover:bg-muted/30 group/section", className)}>
    {title && (
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon className="h-3.5 w-3.5 text-primary/60 group-hover/section:text-primary transition-colors" />}
        <LabelPremium className="mb-0">{title}</LabelPremium>
      </div>
    )}
    <div className="space-y-4">
      {children}
    </div>
  </div>
);

export interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export const GlassCard = ({ children, className, hover = true }: GlassCardProps) => (
  <div className={cn(
    "rounded-xl border border-muted/30 bg-background/50 backdrop-blur-xl",
    hover && "transition-all hover:bg-muted/30 hover:border-muted/40",
    className
  )}>
    {children}
  </div>
);

export const PremiumBadge = ({ children, variant = "blue", className }: { children: React.ReactNode, variant?: "blue" | "gray" | "green" | "red" | "orange", className?: string }) => {
  const variants = {
    blue: "bg-blue-50 text-blue-700 ring-blue-700/10 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-400/30",
    gray: "bg-gray-50 text-gray-600 ring-gray-500/10 dark:bg-gray-800/50 dark:text-gray-300 dark:ring-gray-400/30",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-700/10 dark:bg-emerald-900/30 dark:text-emerald-400 dark:ring-emerald-500/30",
    red: "bg-red-50 text-red-700 ring-red-700/10 dark:bg-red-900/30 dark:text-red-400 dark:ring-red-500/30",
    orange: "bg-orange-50 text-orange-700 ring-orange-700/10 dark:bg-orange-900/30 dark:text-orange-400 dark:ring-orange-500/30",
  };


  return (
    <span className={cn(
      "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
      variants[variant],
      className
    )}>
      {children}
    </span>
  );
};

export const ValuePremium = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <div className={cn("text-base font-medium text-foreground", className)}>
    {children}
  </div>
);
