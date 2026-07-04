import {
  LEGACY_ADDITIONAL_PATHS,
  LEGACY_GREEN_CONNECTIONS,
  LEGACY_ROOM_PATHS,
} from "../data/path-data";
import { CAMPUS_ROOM_BY_ID } from "../data/rooms";
import { LEGACY_SERVICES } from "../data/services";
import type {
  CampusRoom,
  FloorId,
  GeometryByFloor,
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
  geometryByFloor?: GeometryByFloor;
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

  const foundX = Object.values(connections.x).find((group) =>
    group.includes(xNode),
  );
  const foundY = Object.values(connections.y).find((group) =>
    group.includes(yNode),
  );
  const commonNode = foundX?.find((node) => foundY?.includes(node));

  return commonNode ? pointForId(geometry, commonNode) : null;
}

function segment(
  floor: FloorId,
  from: Point,
  to: Point,
  kind: RouteSegment["kind"],
): RouteSegment {
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

function directRouteBetween(
  source: CampusRoom,
  destination: CampusRoom,
  geometry: GeometryIndex,
): SameFloorRoute | null {
  const sourcePoint = pointForId(geometry, source.id);
  const destinationPoint = pointForId(geometry, destination.id);
  if (!sourcePoint || !destinationPoint) return null;

  return {
    distance: distanceBetween(sourcePoint, destinationPoint),
    segments: [segment(source.floor, sourcePoint, destinationPoint, "direct")],
  };
}

function routeBetweenRooms(
  source: CampusRoom,
  destination: CampusRoom,
  geometry: GeometryIndex,
): SameFloorRoute | null {
  return (
    calculateSameFloorRoute(
      source.id,
      destination.id,
      source.floor,
      source.legacyFloor,
      geometry,
    ) ?? directRouteBetween(source, destination, geometry)
  );
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
    Object.entries(destinationPaths).forEach(
      ([destinationGreenId, destinationEdgeId]) => {
        const sourceEdge = pointForId(geometry, sourceEdgeId);
        const sourceGreen = pointForId(geometry, sourceGreenId);
        const destinationGreen = pointForId(geometry, destinationGreenId);
        const destinationEdge = pointForId(geometry, destinationEdgeId);
        const intersection =
          intersectionPoint(
            geometry,
            legacyFloor,
            sourceGreenId,
            destinationGreenId,
          ) ??
          intersectionPoint(
            geometry,
            legacyFloor,
            destinationGreenId,
            sourceGreenId,
          );

        if (
          !sourceEdge ||
          !sourceGreen ||
          !destinationGreen ||
          !destinationEdge ||
          !intersection
        ) {
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
      },
    );
  });

  if (!candidates.length) {
    return {
      distance: distanceBetween(sourcePoint, destinationPoint),
      segments: [segment(floor, sourcePoint, destinationPoint, "direct")],
    };
  }

  return candidates.sort((a, b) => a.distance - b.distance)[0] ?? null;
}

type VerticalConnectorService = "S" | "L";

interface ConnectorCandidate {
  connector: CampusRoom;
  key: string;
  service: VerticalConnectorService;
}

interface PairedConnectorRoute {
  destinationConnector: CampusRoom;
  sourceConnector: CampusRoom;
  sourceRoute: SameFloorRoute;
}

function connectorCandidates(room: CampusRoom): ConnectorCandidate[] {
  const services: VerticalConnectorService[] = ["S", "L"];

  return services.flatMap((service) => {
    const group = LEGACY_SERVICES[service][room.legacyFloor];
    if (!group) return [];

    return Object.entries(group).flatMap(([key, ids]) =>
      ids
        .map((id) => CAMPUS_ROOM_BY_ID[id])
        .filter((candidate): candidate is CampusRoom =>
          Boolean(candidate && candidate.floor === room.floor),
        )
        .map((connector) => ({ connector, key, service })),
    );
  });
}

function connectorCandidateKey(
  candidate: Pick<ConnectorCandidate, "key" | "service">,
) {
  return `${candidate.service}:${candidate.key}`;
}

function bestPairedConnectorRoute(
  source: CampusRoom,
  destination: CampusRoom,
  sourceGeometry: GeometryIndex,
): PairedConnectorRoute | null {
  const destinationConnectors = new Map(
    connectorCandidates(destination).map((candidate) => [
      connectorCandidateKey(candidate),
      candidate.connector,
    ]),
  );

  const ranked = connectorCandidates(source)
    .map((sourceCandidate) => {
      const destinationConnector = destinationConnectors.get(
        connectorCandidateKey(sourceCandidate),
      );
      if (!destinationConnector) return null;

      const sourceRoute = routeBetweenRooms(
        source,
        sourceCandidate.connector,
        sourceGeometry,
      );
      if (!sourceRoute) return null;

      return {
        destinationConnector,
        sourceConnector: sourceCandidate.connector,
        sourceRoute,
      };
    })
    .filter((candidate): candidate is PairedConnectorRoute =>
      Boolean(candidate),
    )
    .sort((a, b) => a.sourceRoute.distance - b.sourceRoute.distance);

  return ranked[0] ?? null;
}

function geometryForFloor(
  floor: FloorId,
  activeFloor: FloorId,
  activeGeometry: GeometryIndex,
  geometryByFloor: GeometryByFloor | undefined,
) {
  return (
    geometryByFloor?.[floor] ?? (floor === activeFloor ? activeGeometry : null)
  );
}

export function calculateRoute(input: RouteInput): RouteResult | null {
  const from = roomById(input.fromId);
  const to = roomById(input.toId);
  const activeGeometry =
    input.geometry ?? input.geometryByFloor?.[input.activeFloor] ?? null;

  if (!from || !to || !activeGeometry) return null;

  const crossFloor = from.floor !== to.floor;
  const floorsInvolved = crossFloor ? [from.floor, to.floor] : [from.floor];
  let steps: RouteStep[] = [
    makeStep(from.floor, `Start at ${from.name}.`),
    makeStep(to.floor, `Follow the highlighted route to ${to.name}.`),
  ];

  if (!crossFloor && input.activeFloor === from.floor) {
    const route = calculateSameFloorRoute(
      from.id,
      to.id,
      from.floor,
      from.legacyFloor,
      activeGeometry,
    );
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

  if (crossFloor) {
    const sourceGeometry = geometryForFloor(
      from.floor,
      input.activeFloor,
      activeGeometry,
      input.geometryByFloor,
    );
    const pairedRoute = sourceGeometry
      ? bestPairedConnectorRoute(from, to, sourceGeometry)
      : null;

    steps = pairedRoute
      ? [
          makeStep(
            from.floor,
            `Start on ${getFloorLabel(from.floor)} at ${from.name}.`,
          ),
          makeStep(
            from.floor,
            `Follow the highlighted path to ${pairedRoute.sourceConnector.name}.`,
          ),
          makeStep(
            to.floor,
            `Switch to ${getFloorLabel(to.floor)} via ${pairedRoute.destinationConnector.name}.`,
          ),
          makeStep(
            to.floor,
            `Follow the destination-floor path to ${to.name}.`,
          ),
        ]
      : [
          makeStep(
            from.floor,
            `Start on ${getFloorLabel(from.floor)} at ${from.name}.`,
          ),
          makeStep(
            from.floor,
            "Follow the highlighted path to the nearest stair/lift.",
          ),
          makeStep(to.floor, `Switch to ${getFloorLabel(to.floor)}.`),
          makeStep(
            to.floor,
            `Follow the destination-floor path to ${to.name}.`,
          ),
        ];

    let activeRoute: SameFloorRoute | null = null;

    if (pairedRoute && input.activeFloor === from.floor) {
      activeRoute = pairedRoute.sourceRoute;
    }

    if (pairedRoute && input.activeFloor === to.floor) {
      activeRoute = routeBetweenRooms(
        pairedRoute.destinationConnector,
        to,
        activeGeometry,
      );
    }

    const activeFloorIsRouteFloor =
      input.activeFloor === from.floor || input.activeFloor === to.floor;

    return {
      crossFloor,
      distance: activeRoute?.distance ?? 0,
      floorsInvolved,
      fromId: from.id,
      segments: activeRoute?.segments ?? [],
      steps,
      toId: to.id,
      warning: activeRoute
        ? undefined
        : activeFloorIsRouteFloor
          ? "Calculating the matching stair/lift for this floor change."
          : `Switch to ${getFloorLabel(from.floor)} or ${getFloorLabel(to.floor)} to view the route.`,
    };
  }

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
