"use client";

import Link from "next/link";
import { ArrowLeft, MousePointer2, Route, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CampusModulePanel } from "@/components/CampusModulePanel";

const HELP_ITEMS = [
  {
    icon: Search,
    title: "Search by name or id",
    body: "Use the current room and destination inputs. Room ids like G10-style lab entries are also searchable through the original locator data.",
  },
  {
    icon: MousePointer2,
    title: "Click the map",
    body: "Click any room shape to inspect it. Use Start or Destination from the room card to build a route.",
  },
  {
    icon: Route,
    title: "Floor changes",
    body: "For cross-floor routes, the page marks involved floors. Switch floors to view each floor segment.",
  },
];

export function CampusMapHelpPage() {
  return (
    <AppShell maxWidth="max-w-4xl">
      <section className="min-w-0">
        <div className="mb-5 flex items-center gap-3">
          <CampusModulePanel />
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight">Map help</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Quick guidance for finding rooms and facilities.
            </p>
          </div>
        </div>

        <Link
          href="/map"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to map
        </Link>

        <div className="grid gap-3 sm:grid-cols-3">
          {HELP_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="rounded-lg border border-border bg-card p-4">
                <span className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <h2 className="text-sm font-semibold">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
              </article>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}
