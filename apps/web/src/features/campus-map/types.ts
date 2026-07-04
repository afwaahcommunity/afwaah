export type FloorId = "ground" | "first" | "second" | "backside";

export type LegacyFloorId = "0" | "1" | "2" | "3";

export type LegacyServiceKey = "S" | "L" | "LT" | "GT" | "G" | "B";

export type RoomType = "facility" | "hall" | "lab" | "office" | "room";

export type FacilityType =
  "stairs" | "lift" | "ladies_toilet" | "gents_toilet" | "gate" | "backside";

export interface CampusRoom {
  details: string;
  floor: FloorId;
  id: string;
  keywords: string[];
  legacyFloor: LegacyFloorId;
  name: string;
  type: RoomType;
}

export interface Point {
  id?: string;
  x: number;
  y: number;
}

export interface ViewBox {
  height: number;
  minX: number;
  minY: number;
  width: number;
}

export interface GeometryIndex {
  elements: Record<string, Point>;
  rooms: Record<string, Point>;
  viewBox: ViewBox;
}

export type GeometryByFloor = Partial<Record<FloorId, GeometryIndex>>;

export interface RouteSegment {
  floor: FloorId;
  from: Point;
  kind: "connector" | "direct" | "extra" | "hall" | "room";
  to: Point;
}

export interface RouteStep {
  floor: FloorId;
  label: string;
}

export interface RouteResult {
  crossFloor: boolean;
  distance: number;
  floorsInvolved: FloorId[];
  fromId: string;
  segments: RouteSegment[];
  steps: RouteStep[];
  toId: string;
  warning?: string;
}
