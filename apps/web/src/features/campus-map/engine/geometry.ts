import type { GeometryIndex, Point, ViewBox } from "../types";

function numberAttribute(element: Element, name: string) {
  const value = element.getAttribute(name);
  if (value == null) return null;

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getBoxPoint(element: SVGElement): Point | null {
  if (!("getBBox" in element)) return null;

  try {
    const box = (element as SVGGraphicsElement).getBBox();
    return {
      id: element.id || undefined,
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    };
  } catch {
    return null;
  }
}

function getElementPoint(element: SVGElement): Point | null {
  const x = numberAttribute(element, "x");
  const y = numberAttribute(element, "y");

  if (x != null && y != null) {
    return { id: element.id || undefined, x, y };
  }

  return getBoxPoint(element);
}

function parseViewBox(svg: SVGSVGElement): ViewBox {
  const viewBox = svg.getAttribute("viewBox")?.trim();
  if (viewBox) {
    const values = viewBox.split(/\s+/).map(Number);
    const [minX, minY, width, height] = values;
    if ([minX, minY, width, height].every(Number.isFinite)) {
      return {
        height: height as number,
        minX: minX as number,
        minY: minY as number,
        width: width as number,
      };
    }
  }

  const width = svg.viewBox.baseVal.width || svg.clientWidth || 1000;
  const height = svg.viewBox.baseVal.height || svg.clientHeight || 800;
  return { height, minX: 0, minY: 0, width };
}

export function readGeometryFromSvg(svg: SVGSVGElement): GeometryIndex {
  const elements: Record<string, Point> = {};
  const rooms: Record<string, Point> = {};

  svg.querySelectorAll<SVGElement>("[id]").forEach((element) => {
    const point = getElementPoint(element);
    if (!point || !element.id) return;
    elements[element.id] = point;
  });

  svg.querySelectorAll<SVGElement>(".room[id]").forEach((element) => {
    const point = getBoxPoint(element) ?? getElementPoint(element);
    if (!point || !element.id) return;
    rooms[element.id] = point;
  });

  return {
    elements,
    rooms,
    viewBox: parseViewBox(svg),
  };
}

export function pointForId(geometry: GeometryIndex, id: string): Point | null {
  return geometry.rooms[id] ?? geometry.elements[id] ?? null;
}

export function distanceBetween(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
