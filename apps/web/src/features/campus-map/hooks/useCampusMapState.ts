"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FLOOR_SVGS } from "../data/floor-svgs";
import {
  calculateRoute,
  findNearestFacilityRoute,
  getRoom,
  readGeometryFromSvgMarkup,
} from "../engine";
import type {
  FacilityType,
  FloorId,
  GeometryByFloor,
  GeometryIndex,
} from "../types";

function readInitialParams(): {
  floor: FloorId;
  fromId: string | null;
  selectedId: string | null;
  toId: string | null;
} {
  if (typeof window === "undefined") {
    return {
      floor: "ground" as FloorId,
      fromId: null,
      selectedId: null,
      toId: null,
    };
  }

  const params = new URLSearchParams(window.location.search);
  const floor = params.get("floor");

  return {
    floor:
      floor === "first" || floor === "second" || floor === "backside"
        ? floor
        : "ground",
    fromId: params.get("from"),
    selectedId: params.get("room"),
    toId: params.get("to"),
  };
}

export function useCampusMapState() {
  const [floor, setFloorValue] = useState<FloorId>("ground");
  const [fromId, setFromIdValue] = useState<string | null>(null);
  const [toId, setToIdValue] = useState<string | null>(null);
  const [selectedId, setSelectedIdValue] = useState<string | null>(null);
  const [geometryByFloor, setGeometryByFloor] = useState<GeometryByFloor>({});
  const [ready, setReady] = useState(false);

  const fromRoom = getRoom(fromId);
  const toRoom = getRoom(toId);
  const selectedRoom = getRoom(selectedId);
  const activeGeometry = geometryByFloor[floor] ?? null;

  useEffect(() => {
    const initial = readInitialParams();
    setFloorValue(initial.floor);
    setFromIdValue(initial.fromId);
    setToIdValue(initial.toId);
    setSelectedIdValue(initial.selectedId);
    setReady(true);
  }, []);

  useEffect(() => {
    const sourceFloor = fromRoom?.floor;
    if (!sourceFloor || geometryByFloor[sourceFloor]) return;

    const sourceGeometry = readGeometryFromSvgMarkup(FLOOR_SVGS[sourceFloor]);
    if (!sourceGeometry) return;

    setGeometryByFloor((current) =>
      current[sourceFloor]
        ? current
        : { ...current, [sourceFloor]: sourceGeometry },
    );
  }, [fromRoom?.floor, geometryByFloor]);

  useEffect(() => {
    if (!ready) return;

    const params = new URLSearchParams();
    if (floor !== "ground") params.set("floor", floor);
    if (fromId) params.set("from", fromId);
    if (toId) params.set("to", toId);
    if (selectedId) params.set("room", selectedId);

    const query = params.toString();
    const nextUrl = query
      ? `${window.location.pathname}?${query}`
      : window.location.pathname;
    window.history.replaceState(null, "", nextUrl);
  }, [floor, fromId, ready, selectedId, toId]);

  const setFloor = useCallback((nextFloor: FloorId) => {
    setFloorValue(nextFloor);
  }, []);

  const setActiveGeometry = useCallback(
    (nextGeometry: GeometryIndex) => {
      setGeometryByFloor((current) => ({ ...current, [floor]: nextGeometry }));
    },
    [floor],
  );

  const setFromId = useCallback((roomId: string | null) => {
    setFromIdValue(roomId);
    setSelectedIdValue(roomId);
    const room = getRoom(roomId);
    if (room) setFloorValue(room.floor);
  }, []);

  const setToId = useCallback(
    (roomId: string | null) => {
      setToIdValue(roomId);
      setSelectedIdValue(roomId);

      const room = getRoom(roomId);
      const source = getRoom(fromId);
      if (room && (!source || room.floor === source.floor)) {
        setFloorValue(room.floor);
      }
    },
    [fromId],
  );

  const selectRoom = useCallback(
    (roomId: string) => {
      setSelectedIdValue(roomId);
      if (!fromId) {
        setFromId(roomId);
        return;
      }
      if (!toId && roomId !== fromId) {
        setToId(roomId);
      }
    },
    [fromId, setFromId, setToId, toId],
  );

  const resetRoute = useCallback(() => {
    setFromIdValue(null);
    setToIdValue(null);
    setSelectedIdValue(null);
  }, []);

  const swapRoute = useCallback(() => {
    setFromIdValue(toId);
    setToIdValue(fromId);
    const room = getRoom(toId);
    if (room) setFloorValue(room.floor);
  }, [fromId, toId]);

  const useNearestFacility = useCallback(
    (facility: FacilityType) => {
      const source = fromId ?? selectedId;
      const nearest = findNearestFacilityRoute(
        source,
        facility,
        activeGeometry,
      );
      if (!nearest) return null;

      setToIdValue(nearest.room.id);
      setSelectedIdValue(nearest.room.id);
      return nearest.room;
    },
    [activeGeometry, fromId, selectedId],
  );

  const route = useMemo(
    () =>
      calculateRoute({
        activeFloor: floor,
        fromId,
        geometry: activeGeometry,
        geometryByFloor,
        toId,
      }),
    [activeGeometry, floor, fromId, geometryByFloor, toId],
  );

  return {
    floor,
    fromId,
    fromRoom,
    geometry: activeGeometry,
    resetRoute,
    route,
    selectRoom,
    selectedId,
    selectedRoom,
    setFloor,
    setFromId,
    setGeometry: setActiveGeometry,
    setToId,
    swapRoute,
    toId,
    toRoom,
    useNearestFacility,
  };
}
