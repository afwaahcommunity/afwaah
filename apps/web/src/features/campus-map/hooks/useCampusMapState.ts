"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FacilityType, FloorId, GeometryIndex } from "../types";
import { calculateRoute, findNearestFacilityRoute, getRoom } from "../engine";

function readInitialParams(): {
  floor: FloorId;
  fromId: string | null;
  selectedId: string | null;
  toId: string | null;
} {
  if (typeof window === "undefined") {
    return { floor: "ground" as FloorId, fromId: null, selectedId: null, toId: null };
  }

  const params = new URLSearchParams(window.location.search);
  const floor = params.get("floor");

  return {
    floor: floor === "first" || floor === "second" || floor === "backside" ? floor : "ground",
    fromId: params.get("from"),
    selectedId: params.get("room"),
    toId: params.get("to"),
  };
}

export function useCampusMapState() {
  const initial = useMemo(readInitialParams, []);
  const [floor, setFloorValue] = useState<FloorId>(initial.floor);
  const [fromId, setFromIdValue] = useState<string | null>(initial.fromId);
  const [toId, setToIdValue] = useState<string | null>(initial.toId);
  const [selectedId, setSelectedIdValue] = useState<string | null>(initial.selectedId);
  const [geometry, setGeometry] = useState<GeometryIndex | null>(null);
  const [ready, setReady] = useState(false);

  const fromRoom = getRoom(fromId);
  const toRoom = getRoom(toId);
  const selectedRoom = getRoom(selectedId);

  useEffect(() => setReady(true), []);

  useEffect(() => {
    if (!ready) return;

    const params = new URLSearchParams();
    if (floor !== "ground") params.set("floor", floor);
    if (fromId) params.set("from", fromId);
    if (toId) params.set("to", toId);
    if (selectedId) params.set("room", selectedId);

    const query = params.toString();
    const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState(null, "", nextUrl);
  }, [floor, fromId, ready, selectedId, toId]);

  const setFloor = useCallback((nextFloor: FloorId) => {
    setFloorValue(nextFloor);
    setGeometry(null);
  }, []);

  const setFromId = useCallback((roomId: string | null) => {
    setFromIdValue(roomId);
    setSelectedIdValue(roomId);
    const room = getRoom(roomId);
    if (room) setFloorValue(room.floor);
  }, []);

  const setToId = useCallback((roomId: string | null) => {
    setToIdValue(roomId);
    setSelectedIdValue(roomId);
    const room = getRoom(roomId);
    if (room) setFloorValue(room.floor);
  }, []);

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
      const nearest = findNearestFacilityRoute(source, facility, geometry);
      if (!nearest) return null;

      setToIdValue(nearest.room.id);
      setSelectedIdValue(nearest.room.id);
      return nearest.room;
    },
    [fromId, geometry, selectedId],
  );

  const route = useMemo(
    () => calculateRoute({ activeFloor: floor, fromId, geometry, toId }),
    [floor, fromId, geometry, toId],
  );

  return {
    floor,
    fromId,
    fromRoom,
    geometry,
    resetRoute,
    route,
    selectRoom,
    selectedId,
    selectedRoom,
    setFloor,
    setFromId,
    setGeometry,
    setToId,
    swapRoute,
    toId,
    toRoom,
    useNearestFacility,
  };
}
