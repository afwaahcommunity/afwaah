import { LEGACY_ADDITIONAL_PATHS, LEGACY_GREEN_CONNECTIONS, LEGACY_ROOM_PATHS } from "../data/path-data";
import { CAMPUS_ROOM_BY_ID } from "../data/rooms";
import type {
  CampusRoom,
  FloorId,
  GeometryIndex,
  LegacyFloorId,
  Point,
  RouteResult,
  RouteSegment,
  RouteStep,
} from "../types";
import { distanceBetween, pointForId } from "./geometry";
import { getFloorLabel } from "./floors";

interface RouteInput {
  activeFloor: FloorId;
  fromId: string | null;
  geometry: GeometryIndex | null;
  toId: string | null;
}

interface SameFloorRoute {
  distance: number;
  segments: RouteSegment[];
}

function roomById(roomId: string | null): CampusRoom | null {
  if (!roomId) return null;
  return CAMPUS_ROOM_BY_ID[roomId] ?? null;
}

function makeStep(floor: FloorId, label: string): RouteStep {
  return { floor, label };
}

function intersectionPoint(
  geometry: GeometryIndex,
  legacyFloor: LegacyFloorId,
  xNode: string,
  yNode: string,
): Point | null {
  const connections = LEGACY_GREEN_CONNECTIONS[legacyFloor];
  if (!connections) return null;

  const foundX = Object.values(connections.x).find((group) => group.includes(xNode));
  const foundY = Object.values(connections.y).find((group) => group.includes(yNode));
  const commonNode = foundX?.find((node) => foundY?.includes(node));

  return commonNode ? pointForId(geometry, commonNode) : null;
}

function segment(floor: FloorId, from: Point, to: Point, kind: RouteSegment["kind"]): RouteSegment {
  return { floor, from, kind, to };
}

function appendAdditionalSegments(
  geometry: GeometryIndex,
  floor: FloorId,
  roomId: string,
  segments: RouteSegment[],
) {
  const paths = LEGACY_ADDITIONAL_PATHS[roomId];
  if (!paths) return;

  Object.values(paths).forEach(([fromId, toId]) => {
    if (!fromId || !toId) return;
    const from = pointForId(geometry, fromId);
    const to = pointForId(geometry, toId);
    if (from && to) segments.push(segment(floor, from, to, "extra"));
  });
}

export function calculateSameFloorRoute(
  sourceId: string,
  destinationId: string,
  floor: FloorId,
  legacyFloor: LegacyFloorId,
  geometry: GeometryIndex,
): SameFloorRoute | null {
  const sourcePoint = pointForId(geometry, sourceId);
  const destinationPoint = pointForId(geometry, destinationId);
  const sourcePaths = LEGACY_ROOM_PATHS[legacyFloor]?.[sourceId];
  const destinationPaths = LEGACY_ROOM_PATHS[legacyFloor]?.[destinationId];

  if (!sourcePoint || !destinationPoint) return null;

  if (!sourcePaths || !destinationPaths) {
    return {
      distance: distanceBetween(sourcePoint, destinationPoint),
      segments: [segment(floor, sourcePoint, destinationPoint, "direct")],
    };
  }

  const candidates: SameFloorRoute[] = [];

  Object.entries(sourcePaths).forEach(([sourceGreenId, sourceEdgeId]) => {
    Object.entries(destinationPaths).forEach(([destinationGreenId, destinationEdgeId]) => {
      const sourceEdge = pointForId(geometry, sourceEdgeId);
      const sourceGreen = pointForId(geometry, sourceGreenId);
      const destinationGreen = pointForId(geometry, destinationGreenId);
      const destinationEdge = pointForId(geometry, destinationEdgeId);
      const intersection =
        intersectionPoint(geometry, legacyFloor, sourceGreenId, destinationGreenId) ??
        intersectionPoint(geometry, legacyFloor, destinationGreenId, sourceGreenId);

      if (!sourceEdge || !sourceGreen || !destinationGreen || !destinationEdge || !intersection) {
        return;
      }

      const routeSegments = [
        segment(floor, sourceEdge, sourceGreen, "room"),
        segment(floor, sourceGreen, intersection, "hall"),
        segment(floor, intersection, destinationGreen, "hall"),
        segment(floor, destinationGreen, destinationEdge, "room"),
      ];

      appendAdditionalSegments(geometry, floor, sourceId, routeSegments);
      appendAdditionalSegments(geometry, floor, destinationId, routeSegments);

      candidates.push({
        distance:
          distanceBetween(sourceEdge, sourceGreen) +
          distanceBetween(sourceGreen, intersection) +
          distanceBetween(intersection, destinationGreen) +
          distanceBetween(destinationGreen, destinationEdge),
        segments: routeSegments,
      });
    });
  });

  if (!candidates.length) {
    return {
      distance: distanceBetween(sourcePoint, destinationPoint),
      segments: [segment(floor, sourcePoint, destinationPoint, "direct")],
    };
  }

  return candidates.sort((a, b) => a.distance - b.distance)[0] ?? null;
}

function crossFloorConnectorId(room: CampusRoom) {
  const paths = LEGACY_ROOM_PATHS[room.legacyFloor]?.[room.id];
  return paths ? Object.keys(paths)[0] ?? null : null;
}

function routeToConnector(
  room: CampusRoom,
  activeFloor: FloorId,
  geometry: GeometryIndex,
): SameFloorRoute | null {
  const connectorId = crossFloorConnectorId(room);
  if (!connectorId) return null;

  return calculateSameFloorRoute(room.id, connectorId, activeFloor, room.legacyFloor, geometry);
}

function routeFromConnector(
  room: CampusRoom,
  activeFloor: FloorId,
  geometry: GeometryIndex,
): SameFloorRoute | null {
  const connectorId = crossFloorConnectorId(room);
  if (!connectorId) return null;

  return calculateSameFloorRoute(connectorId, room.id, activeFloor, room.legacyFloor, geometry);
}

export function calculateRoute(input: RouteInput): RouteResult | null {
  const from = roomById(input.fromId);
  const to = roomById(input.toId);

  if (!from || !to || !input.geometry) return null;

  const crossFloor = from.floor !== to.floor;
  const floorsInvolved = crossFloor ? [from.floor, to.floor] : [from.floor];
  const steps: RouteStep[] = crossFloor
    ? [
        makeStep(from.floor, `Start on ${getFloorLabel(from.floor)} at ${from.name}.`),
        makeStep(from.floor, "Move to the nearest stair/lift connector."),
        makeStep(to.floor, `Switch to ${getFloorLabel(to.floor)}.`),
        makeStep(to.floor, `Continue to ${to.name}.`),
      ]
    : [
        makeStep(from.floor, `Start at ${from.name}.`),
        makeStep(to.floor, `Follow the highlighted route to ${to.name}.`),
      ];

  if (!crossFloor && input.activeFloor === from.floor) {
    const route = calculateSameFloorRoute(from.id, to.id, from.floor, from.legacyFloor, input.geometry);
    if (!route) return null;

    return {
      crossFloor,
      distance: route.distance,
      floorsInvolved,
      fromId: from.id,
      segments: route.segments,
      steps,
      toId: to.id,
    };
  }

  if (!crossFloor) {
    return {
      crossFloor,
      distance: 0,
      floorsInvolved,
      fromId: from.id,
      segments: [],
      steps,
      toId: to.id,
      warning: `Switch to ${getFloorLabel(from.floor)} to view this route.`,
    };
  }

  let activeRoute: SameFloorRoute | null = null;
  if (input.activeFloor === from.floor) activeRoute = routeToConnector(from, from.floor, input.geometry);
  if (input.activeFloor === to.floor) activeRoute = routeFromConnector(to, to.floor, input.geometry);

  return {
    crossFloor,
    distance: activeRoute?.distance ?? 0,
    floorsInvolved,
    fromId: from.id,
    segments: activeRoute?.segments ?? [],
    steps,
    toId: to.id,
    warning: activeRoute ? undefined : `Switch to ${getFloorLabel(from.floor)} or ${getFloorLabel(to.floor)} to view the route.`,
  };
}
