"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Maximize2, Minus, Plus } from "lucide-react";
import { FLOOR_SVGS } from "../data/floor-svgs";
import { getRoom, readGeometryFromSvg } from "../engine";
import type { FloorId, GeometryIndex, RouteSegment } from "../types";

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 3.5;

interface Point {
  x: number;
  y: number;
}

interface DragState {
  pointerId: number;
  roomId: string | null;
  startOffset: Point;
  startPoint: Point;
}

interface PinchState {
  contentPoint: Point;
  startDistance: number;
  startZoom: number;
}

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function distance(first: Point, second: Point) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function midpoint(first: Point, second: Point): Point {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
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
  const viewportRef = useRef<HTMLElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const activePointersRef = useRef(new Map<number, Point>());
  const dragRef = useRef<DragState | null>(null);
  const pinchRef = useRef<PinchState | null>(null);
  const dragMovedRef = useRef(false);
  const zoomRef = useRef(1);
  const offsetRef = useRef<Point>({ x: 0, y: 0 });
  const [geometry, setGeometry] = useState<GeometryIndex | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });

  const commitView = useCallback((nextZoom: number, nextOffset: Point) => {
    zoomRef.current = nextZoom;
    offsetRef.current = nextOffset;
    setZoom(nextZoom);
    setOffset(nextOffset);
  }, []);

  const resetView = useCallback(() => {
    commitView(1, { x: 0, y: 0 });
  }, [commitView]);

  const zoomAt = useCallback(
    (requestedZoom: number, center?: Point) => {
      const viewport = viewportRef.current;
      if (!viewport) return;

      const nextZoom = clampZoom(requestedZoom);
      const currentZoom = zoomRef.current;
      const currentOffset = offsetRef.current;
      const focus = center ?? {
        x: viewport.clientWidth / 2,
        y: viewport.clientHeight / 2,
      };
      const ratio = nextZoom / currentZoom;

      commitView(nextZoom, {
        x: focus.x - (focus.x - currentOffset.x) * ratio,
        y: focus.y - (focus.y - currentOffset.y) * ratio,
      });
    },
    [commitView],
  );

  useEffect(() => {
    const svg = mapRef.current?.querySelector("svg");
    if (!(svg instanceof SVGSVGElement)) return;

    const nextGeometry = readGeometryFromSvg(svg);
    setGeometry(nextGeometry);
    onGeometry(nextGeometry);
    resetView();
  }, [floor, onGeometry, resetView]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();

      const bounds = viewport.getBoundingClientRect();
      const center = {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      };
      zoomAt(zoomRef.current * Math.exp(-event.deltaY * 0.01), center);
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  }, [zoomAt]);

  const roomIdFromTarget = (target: EventTarget | null) => {
    const room = target instanceof Element ? target.closest(".room[id]") : null;
    return room instanceof SVGElement && getRoom(room.id) ? room.id : null;
  };

  const localPoint = (event: ReactPointerEvent<HTMLElement>): Point => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
  };

  const startPinch = () => {
    const pointers = [...activePointersRef.current.values()];
    const first = pointers[0];
    const second = pointers[1];
    if (!first || !second) return;

    const center = midpoint(first, second);
    const currentOffset = offsetRef.current;
    pinchRef.current = {
      contentPoint: {
        x: (center.x - currentOffset.x) / zoomRef.current,
        y: (center.y - currentOffset.y) / zoomRef.current,
      },
      startDistance: distance(first, second),
      startZoom: zoomRef.current,
    };
    dragRef.current = null;
    dragMovedRef.current = true;
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    const point = localPoint(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointersRef.current.set(event.pointerId, point);

    if (activePointersRef.current.size === 1) {
      dragMovedRef.current = false;
      dragRef.current = {
        pointerId: event.pointerId,
        roomId: roomIdFromTarget(event.target),
        startOffset: offsetRef.current,
        startPoint: point,
      };
      return;
    }

    startPinch();
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (!activePointersRef.current.has(event.pointerId)) return;

    const point = localPoint(event);
    activePointersRef.current.set(event.pointerId, point);

    if (activePointersRef.current.size >= 2) {
      if (!pinchRef.current) startPinch();
      const pinch = pinchRef.current;
      const pointers = [...activePointersRef.current.values()];
      const first = pointers[0];
      const second = pointers[1];
      if (!pinch || !first || !second || pinch.startDistance === 0) return;

      const center = midpoint(first, second);
      const nextZoom = clampZoom(
        pinch.startZoom * (distance(first, second) / pinch.startDistance),
      );
      commitView(nextZoom, {
        x: center.x - pinch.contentPoint.x * nextZoom,
        y: center.y - pinch.contentPoint.y * nextZoom,
      });
      return;
    }

    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = point.x - drag.startPoint.x;
    const deltaY = point.y - drag.startPoint.y;
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      dragMovedRef.current = true;
    }

    commitView(zoomRef.current, {
      x: drag.startOffset.x + deltaX,
      y: drag.startOffset.y + deltaY,
    });
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const completedDrag = dragRef.current;
    const roomId =
      completedDrag?.pointerId === event.pointerId && !dragMovedRef.current
        ? completedDrag.roomId
        : null;

    activePointersRef.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (activePointersRef.current.size === 1) {
      const remainingPointer = [...activePointersRef.current.entries()][0];
      if (!remainingPointer) return;
      const [pointerId, point] = remainingPointer;
      pinchRef.current = null;
      dragRef.current = {
        pointerId,
        roomId: null,
        startOffset: offsetRef.current,
        startPoint: point,
      };
    } else {
      dragRef.current = null;
      pinchRef.current = null;
    }

    if (roomId) onSelectRoom(roomId);
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLElement>) => {
    activePointersRef.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    pinchRef.current = null;
    dragMovedRef.current = true;
  };

  const markers = useMemo(() => {
    const routeMarkerIds = new Set([fromId, toId].filter(Boolean));
    return [
      {
        className: "fill-success stroke-background",
        id: fromId,
        label: "Start",
        symbol: "S",
      },
      {
        className: "fill-warning stroke-background",
        id: toId,
        label: "Destination",
        symbol: "D",
      },
      ...(selectedId && !routeMarkerIds.has(selectedId)
        ? [
            {
              className: "fill-primary stroke-background",
              id: selectedId,
              label: "Selected",
              symbol: null,
            },
          ]
        : []),
    ];
  }, [fromId, selectedId, toId]);

  const mapUnit = geometry
    ? Math.min(geometry.viewBox.width, geometry.viewBox.height) / 310
    : 1;

  return (
    <section
      ref={viewportRef}
      aria-label="Interactive campus map"
      className="relative min-h-[420px] touch-none overflow-hidden overscroll-contain rounded-lg border border-border bg-card sm:min-h-[560px]"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      <div
        ref={mapRef}
        className="campus-map-canvas pointer-events-auto absolute inset-0 cursor-grab select-none will-change-transform active:cursor-grabbing"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          transformOrigin: "0 0",
        }}
        dangerouslySetInnerHTML={{ __html: FLOOR_SVGS[floor] }}
      />

      {geometry ? (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full will-change-transform"
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
              strokeWidth={2.25 * mapUnit}
            />
          ))}

          {markers.map((marker) => {
            const point = marker.id
              ? (geometry.rooms[marker.id] ?? geometry.elements[marker.id])
              : null;
            if (!point) return null;

            return (
              <g key={`${marker.label}-${marker.id}`}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={4 * mapUnit}
                  className={`${marker.className} opacity-90`}
                  strokeWidth={1.2 * mapUnit}
                />
                {marker.symbol ? (
                  <text
                    x={point.x}
                    y={point.y + 1.5 * mapUnit}
                    className="fill-background font-bold"
                    style={{ fontSize: `${4.25 * mapUnit}px` }}
                    textAnchor="middle"
                  >
                    {marker.symbol}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      ) : null}

      <div
        className="absolute right-3 top-3 z-10 flex gap-1 rounded-lg border border-border-strong bg-background/95 p-1 shadow-sm backdrop-blur"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => zoomAt(zoomRef.current - 0.2)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Reset map view"
          onClick={resetView}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => zoomAt(zoomRef.current + 0.2)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
