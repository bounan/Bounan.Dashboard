"use client";

import { ChevronLeft, ChevronRight, Database, Settings2, ShieldCheck } from "lucide-react";
import type { DashboardView } from "../../lib/types";
import { cn } from "../../lib/ui";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

const items = [
  {
    value: "config" as const,
    label: "Config",
    description: "Credentials and access checks",
    icon: Settings2,
  },
  {
    value: "backup-analyzer" as const,
    label: "Backup",
    description: "Snapshot tables and live refresh",
    icon: Database,
  },
  {
    value: "rules" as const,
    label: "Rules",
    description: "Validation catalog and violations",
    icon: ShieldCheck,
  },
];

export function Sidebar({
  collapsed,
  view,
  onToggle,
  onNavigate,
}: {
  collapsed: boolean;
  view: DashboardView;
  onToggle: () => void;
  onNavigate: (next: DashboardView) => void;
}) {
  return (
    <aside
      className={cn(
        "flex h-full flex-col justify-between border-r border-slate-900 bg-slate-950/95 px-4 py-5",
        collapsed ? "w-20" : "w-72",
      )}
    >
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-3">
          {!collapsed ? (
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Bounan Ops
              </p>
              <h1 className="text-xl font-semibold text-white">Control surface</h1>
            </div>
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-sky-300">
              BO
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={onToggle} className="h-10 w-10 px-0">
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        <nav className="space-y-2">
          {items.map((item) => {
            const Icon = item.icon;
            const active = view === item.value;

            return (
              <button
                key={item.value}
                type="button"
                onClick={() => onNavigate(item.value)}
                data-testid={`nav-${item.value}`}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition",
                  active
                    ? "border-slate-700 bg-slate-900 text-white"
                    : "border-transparent text-slate-400 hover:border-slate-800 hover:bg-slate-900/60 hover:text-white",
                  collapsed && "justify-center px-0",
                )}
              >
                <div
                  className={cn(
                    "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    active ? "bg-sky-600 text-white" : "bg-slate-900 text-slate-300",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                {!collapsed ? (
                  <div className="min-w-0 space-y-1">
                    <div className="text-sm font-medium">{item.label}</div>
                    <div className="text-xs text-slate-500">{item.description}</div>
                  </div>
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>

      {!collapsed ? (
        <div className="rounded-xl border border-slate-900 bg-slate-950 p-4">
          <div className="space-y-2">
            <Badge variant="secondary">Static web app</Badge>
            <p className="text-sm text-slate-300">
              Config, backup inspection, and AWS recovery tools.
            </p>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
