// The city itself: a grid of coastal blocks with roads, buildings, parks, a beach and a bay.
// This file only builds and queries geometry; render.js paints it and entities.js drives on it.
import { CITY, BUILDING_COLORS, COLOR } from './config.js';
import { pick, range } from './random.js';

export const ROAD = CITY.cell;
export const HALF = CITY.roadHalf;

/** Snap a coordinate to the nearest road centre line. */
export function roadLine(v) {
  return Math.round(v / ROAD) * ROAD;
}

/** True when a point sits on a vertical or horizontal road. */
export function isRoad(x, y) {
  const dx = Math.abs(x - roadLine(x));
  const dy = Math.abs(y - roadLine(y));
  return dx <= HALF || dy <= HALF;
}

/** A point on a traffic lane: axis is 'h' (horizontal) or 'v', line is the road centre. */
export function lanePoint(axis, line, offset, along) {
  return axis === 'h' ? { x: along, y: line + offset } : { x: line + offset, y: along };
}

/** Which lane offset and direction a traffic car uses on a given road. */
export function laneFor(axis, direction) {
  return direction > 0 ? 25 : -25;
}

/** Pick a random legal starting place for a traffic car. */
export function randomRoad(rng) {
  const index = Math.floor(rng() * (CITY.cells + 1));
  const line = index * ROAD;
  const axis = rng() < 0.52 ? 'h' : 'v';
  const direction = rng() < 0.5 ? 1 : -1;
  const along = rng() * CITY.size;
  const p = lanePoint(axis, line, laneFor(axis, direction), along);
  return { axis, line, direction, offset: laneFor(axis, direction), along, x: p.x, y: p.y };
}

/** Advance a traffic car along its lane, wrapping at the edge of the world. */
export function advanceTraffic(car, distance) {
  car.along += distance * car.direction;
  if (car.along > CITY.size + 80) car.along = -80;
  if (car.along < -80) car.along = CITY.size + 80;
  const p = lanePoint(car.axis, car.line, car.offset, car.along);
  car.x = p.x;
  car.y = p.y;
}

/** Walk a point toward the nearest side of the nearest road (used for pedestrians). */
export function sidewalkPoint(x, y) {
  const lineX = roadLine(x);
  const lineY = roadLine(y);
  const sideX = x >= lineX ? lineX + HALF + 14 : lineX - HALF - 14;
  const sideY = y >= lineY ? lineY + HALF + 14 : lineY - HALF - 14;
  return { x: sideX, y: sideY };
}

function makeBuilding(rng, x, y, w, h, district) {
  const style = pick(rng, BUILDING_COLORS);
  return {
    x, y, w, h,
    height: Math.round(range(rng, 26, district === 'downtown' ? 130 : 78)),
    wall: style[1], roof: style[0],
    windows: rng() < 0.82,
    rows: Math.max(1, Math.floor(h / 34)),
    cols: Math.max(1, Math.floor(w / 30)),
    seed: rng(),
    billboard: rng() < 0.07,
    sign: pick(rng, ['SUN ADE', 'PALM MOTEL', 'BAY FM', 'CAFE SOL', 'MIRA', 'OCEAN 9', 'RIO SUR', 'DOCK 6']),
    rooftop: rng() < 0.35,
  };
}

/**
 * Build a deterministic city. Parks, sand, water and four density zones give
 * every district a different silhouette so the minimap and the streets read well.
 */
export function createCity(rng) {
  const blocks = [];
  const buildings = [];
  const palms = [];
  const trees = [];
  const lamps = [];
  const props = [];

  for (let gx = 0; gx < CITY.cells; gx += 1) {
    for (let gy = 0; gy < CITY.cells; gy += 1) {
      const x0 = gx * ROAD + HALF;
      const y0 = gy * ROAD + HALF;
      const w = ROAD - HALF * 2;
      const h = ROAD - HALF * 2;
      const cx = x0 + w / 2;
      const cy = y0 + h / 2;

      const block = { gx, gy, x0, y0, w, h, kind: 'city', buildings: [] };
      if (gx === CITY.cells - 1) {
        block.kind = 'water';
      } else if (gx === CITY.cells - 2 && rng() < 0.55) {
        block.kind = 'sand';
      } else if ((gx === 5 && gy === 7) || (gx === 2 && gy === 2) || rng() < 0.09) {
        block.kind = 'park';
      } else if (gx >= 4 && gx <= 8 && gy <= 6) {
        block.kind = 'downtown';
      } else if (gx <= 2 && gy >= 8) {
        block.kind = 'docks';
      }

      if (block.kind === 'water') {
        blocks.push(block);
        if (rng() < 0.5) props.push({ kind: 'boat', x: cx + range(rng, -70, 70), y: cy + range(rng, -70, 70), hue: rng() });
        continue;
      }
      if (block.kind === 'park') {
        for (let k = 0; k < 9; k += 1) {
          trees.push({ x: x0 + range(rng, 16, w - 16), y: y0 + range(rng, 16, h - 16), r: range(rng, 12, 20) });
        }
        props.push({ kind: 'fountain', x: cx, y: cy });
        blocks.push(block);
        continue;
      }
      if (block.kind === 'sand') {
        for (let k = 0; k < 6; k += 1) {
          palms.push({ x: x0 + range(rng, 14, w - 14), y: y0 + range(rng, 14, h - 14), lean: range(rng, -0.4, 0.4), s: range(rng, 0.8, 1.25) });
        }
        blocks.push(block);
        continue;
      }

      // City blocks are split into a two-by-two or three-by-two set of lots.
      const cols = block.kind === 'downtown' && rng() < 0.55 ? 1 : 2;
      const rows = rng() < 0.3 ? 1 : 2;
      const gap = 10;
      const lotW = (w - gap * (cols + 1)) / cols;
      const lotH = (h - gap * (rows + 1)) / rows;
      for (let a = 0; a < cols; a += 1) {
        for (let b = 0; b < rows; b += 1) {
          if (block.kind === 'docks' && rng() < 0.3) {
            props.push({ kind: 'container', x: x0 + gap + a * (lotW + gap) + lotW / 2, y: y0 + gap + b * (lotH + gap) + lotH / 2, hue: rng() });
            continue;
          }
          const inset = range(rng, 0, 12);
          const building = makeBuilding(
            rng,
            x0 + gap + a * (lotW + gap) + inset,
            y0 + gap + b * (lotH + gap) + inset,
            lotW - inset * 2,
            lotH - inset * 2,
            block.kind,
          );
          building.gx = gx;
          building.gy = gy;
          buildings.push(building);
          block.buildings.push(building);
        }
      }
      for (const sx of [x0 + 6, x0 + w - 6]) lamps.push({ x: sx, y: cy });
      blocks.push(block);
    }
  }

  // Waterfront landmarks: a long pier, the marina office and a lighthouse.
  props.push({ kind: 'pier', x: 4380, y: 3700 });
  props.push({ kind: 'office', x: 4080, y: 3920 });
  props.push({ kind: 'lighthouse', x: 4630, y: 1200 });

  return { blocks, buildings, palms, trees, lamps, props };
}

/** The block containing a point, or null outside the grid. */
export function blockAt(city, x, y) {
  const gx = Math.floor(x / ROAD);
  const gy = Math.floor(y / ROAD);
  if (gx < 0 || gy < 0 || gx >= CITY.cells || gy >= CITY.cells) return null;
  return city.blocks[gy * CITY.cells + gx];
}

/** A safe open spot near a coordinate, used for respawns and mission markers. */
export function openSpotNear(x, y) {
  const gx = Math.max(1, Math.min(CITY.cells - 2, Math.floor(x / ROAD)));
  const gy = Math.max(1, Math.min(CITY.cells - 2, Math.floor(y / ROAD)));
  return { x: gx * ROAD + HALF + 48, y: gy * ROAD + HALF + 48 };
}

export function districtName(x, y) {
  if (x > CITY.beachStart) return 'THE BAY';
  const gx = Math.floor(x / ROAD);
  const gy = Math.floor(y / ROAD);
  if (gx >= 4 && gx <= 8 && gy <= 6) return 'DOWNTOWN';
  if (gx <= 2 && gy >= 8) return 'OLD DOCKS';
  if (gy >= 8) return 'SOUTH BEACH';
  if (gx <= 3) return 'WEST END';
  return 'CIELO BAY';
}

export { COLOR };
