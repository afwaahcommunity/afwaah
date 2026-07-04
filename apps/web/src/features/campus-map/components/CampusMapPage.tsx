"use client";

import Link from "next/link";
import { HelpCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CampusModulePanel } from "@/components/CampusModulePanel";
import { FacilityShortcuts } from "./FacilityShortcuts";
import { FloorSelector } from "./FloorSelector";
import { MapCanvas } from "./MapCanvas";
import { RoomInfoPanel } from "./RoomInfoPanel";
import { RoomSearch } from "./RoomSearch";
import { RouteControls } from "./RouteControls";
import { RouteSummary } from "./RouteSummary";
import { useCampusMapState } from "../hooks/useCampusMapState";

export function CampusMapPage() {
  const map = useCampusMapState();
  const detailRoom = map.selectedRoom ?? map.fromRoom ?? map.toRoom;

  return (
    <AppShell maxWidth="max-w-7xl">
      <section className="min-w-0">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <CampusModulePanel />
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-tight">Campus map</h1>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Find rooms, facilities, and floor changes quickly.
              </p>
            </div>
          </div>
          <Link
            href="/map/help"
            className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <HelpCircle className="h-4 w-4" />
            Help
          </Link>
        </div>

        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-3">
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                <FloorSelector floor={map.floor} onChange={map.setFloor} route={map.route} />
                <RouteControls
                  canSwap={Boolean(map.fromId && map.toId)}
                  onReset={map.resetRoute}
                  onSwap={map.swapRoute}
                />
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <RoomSearch
                  floor={map.floor}
                  label="Current room"
                  onSelect={map.setFromId}
                  placeholder="Nearest room or room id"
                  value={map.fromRoom}
                />
                <RoomSearch
                  label="Destination"
                  onSelect={map.setToId}
                  placeholder="Destination room or room id"
                  value={map.toRoom}
                />
              </div>
            </div>

            <MapCanvas
              floor={map.floor}
              fromId={map.fromId}
              onGeometry={map.setGeometry}
              onSelectRoom={map.selectRoom}
              routeSegments={map.route?.segments ?? []}
              selectedId={map.selectedId}
              toId={map.toId}
            />
          </div>

          <aside className="min-w-0 space-y-3">
            <RoomInfoPanel room={detailRoom} onSetFrom={map.setFromId} onSetTo={map.setToId} />
            <RouteSummary from={map.fromRoom} route={map.route} to={map.toRoom} />
            <section className="rounded-lg border border-border bg-card p-4">
              <FacilityShortcuts
                disabled={!map.fromId && !map.selectedId}
                onSelect={map.useNearestFacility}
              />
            </section>
          </aside>
        </div>
      </section>
    </AppShell>
  );
}
