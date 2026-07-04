"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import { FLOOR_SVGS } from "../data/floor-svgs";
import { getRoom, readGeometryFromSvg } from "../engine";
import type { FloorId, GeometryIndex, RouteSegment } from "../types";

interface DragState {
  startOffsetX: number;
  startOffsetY: number;
  startX: number;
  startY: number;
}

export function MapCanvas({
  floor,
  fromId,
  onGeometry,
  onSelectRoom,
  routeSegments,
  selectedId,
  toId,
}: {
  floor: FloorId;
  fromId: string | null;
  onGeometry: (geometry: GeometryIndex) => void;
  onSelectRoom: (roomId: string) => void;
  routeSegments: RouteSegment[];
  selectedId: string | null;
  toId: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragMovedRef = useRef(false);
  const [geometry, setGeometry] = useState<GeometryIndex | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<DragState | null>(null);

  useEffect(() => {
    const svg = containerRef.current?.querySelector("svg");
    if (!(svg instanceof SVGSVGElement)) return;

    const nextGeometry = readGeometryFromSvg(svg);
    setGeometry(nextGeometry);
    onGeometry(nextGeometry);
  }, [floor, onGeometry]);

  const resetView = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }

    const target = event.target instanceof Element ? event.target.closest(".room[id]") : null;
    if (!(target instanceof SVGElement) || !target.id || !getRoom(target.id)) return;
    onSelectRoom(target.id);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragMovedRef.current = false;
    setDrag({
      startOffsetX: offset.x,
      startOffsetY: offset.y,
      startX: event.clientX,
      startY: event.clientY,
    });
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    if (Math.abs(event.clientX - drag.startX) > 3 || Math.abs(event.clientY - drag.startY) > 3) {
      dragMovedRef.current = true;
    }
    setOffset({
      x: drag.startOffsetX + event.clientX - drag.startX,
      y: drag.startOffsetY + event.clientY - drag.startY,
    });
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    window.setTimeout(() => setDrag(null), 0);
  };

  const markerIds = [
    { className: "fill-primary stroke-background", id: selectedId, label: "Selected" },
    { className: "fill-success stroke-background", id: fromId, label: "Start" },
    { className: "fill-warning stroke-background", id: toId, label: "Destination" },
  ];

  return (
    <section className="relative min-h-[420px] overflow-hidden rounded-lg border border-border bg-card sm:min-h-[560px]">
      <div
        ref={containerRef}
        className="campus-map-canvas absolute inset-0 cursor-grab select-none active:cursor-grabbing"
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
        }}
        dangerouslySetInnerHTML={{ __html: FLOOR_SVGS[floor] }}
      />

      {geometry ? (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
          preserveAspectRatio="xMidYMid meet"
          viewBox={`${geometry.viewBox.minX} ${geometry.viewBox.minY} ${geometry.viewBox.width} ${geometry.viewBox.height}`}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        >
          {routeSegments.map((item, index) => (
            <line
              key={`${item.kind}-${index}`}
              x1={item.from.x}
              x2={item.to.x}
              y1={item.from.y}
              y2={item.to.y}
              className="stroke-primary"
              strokeLinecap="round"
              strokeWidth={6}
            />
          ))}

          {markerIds.map((marker) => {
            const point = marker.id ? geometry.rooms[marker.id] ?? geometry.elements[marker.id] : null;
            if (!point) return null;

            return (
              <g key={`${marker.label}-${marker.id}`}>
                <circle cx={point.x} cy={point.y} r={15} className={`${marker.className} opacity-90`} strokeWidth={5} />
                <text
                  x={point.x}
                  y={point.y - 24}
                  className="fill-foreground text-[18px] font-semibold"
                  textAnchor="middle"
                >
                  {marker.label}
                </text>
              </g>
            );
          })}
        </svg>
      ) : null}

      <div className="absolute right-3 top-3 flex gap-1 rounded-lg border border-border bg-background/90 p-1 backdrop-blur">
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => setZoom((value) => Math.max(0.55, value - 0.15))}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Reset map view"
          onClick={resetView}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => setZoom((value) => Math.min(2.2, value + 0.15))}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
