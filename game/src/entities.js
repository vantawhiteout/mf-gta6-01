// Moving things: traffic, pedestrians, police, bullets and particles.
// Each helper mutates the world state; world.js owns the order of operations.
import { CITY, CAR, CAR_COLORS, WANTED } from './config.js';
import { advanceTraffic, isRoad, laneFor, lanePoint, randomRoad, roadLine, sidewalkPoint } from './city.js';
import { pick, range } from './random.js';

export function makeTrafficCar(rng, x, y) {
  const road = randomRoad(rng);
  return {
    x: x ?? road.x, y: y ?? road.y,
    angle: road.axis === 'h' ? (road.direction > 0 ? 0 : Math.PI) : (road.direction > 0 ? Math.PI / 2 : -Math.PI / 2),
    speed: range(rng, 70, 150) * (road.direction > 0 ? 1 : 1),
    color: pick(rng, CAR_COLORS),
    model: Math.floor(rng() * 4),
    road, police: false, hp: 60, wobble: rng() * 6.28,
  };
}

export function makePoliceCar(rng, x, y) {
  return {
    x, y, angle: rng() * 6.28, speed: 0,
    color: '#e9edf2', model: 3, police: true,
    light: rng() < 0.5 ? 0 : 1, hp: 120,
    steerTimer: 0, sirenPhase: rng() * 6.28,
  };
}

export function makePed(rng, x, y) {
  return {
    x, y, angle: rng() * 6.28,
    speed: range(rng, 42, 78),
    color: pick(rng, ['#f2c15b', '#e7757c', '#79c9e8', '#b9e07d', '#d5a2dd', '#e9e2d4', '#7d9fd6']),
    phase: rng() * 6.28, goalX: 0, goalY: 0,
    body: rng() < 0.5 ? 0 : 1,
  };
}

export function makeEnemy(rng, x, y) {
  return {
    x, y, angle: rng() * 6.28, health: 60,
    color: pick(rng, ['#c0455c', '#3f5f8c', '#4b4b55']),
    fireTimer: range(rng, 0.5, 2.2), alive: true, phase: rng() * 6.28,
  };
}

/** Traffic follows its lane and wraps around the grid. */
export function updateTraffic(state, dt) {
  for (const car of state.cars) {
    if (car.police || car.parked) continue;
    advanceTraffic(car.road, car.speed * dt);
    car.x = car.road.x;
    car.y = car.road.y;
    car.wobble += dt;
  }
}

/** Pedestrians wander between sidewalks around their block. */
export function updatePeds(state, dt) {
  const { rng } = state;
  for (const ped of state.peds) {
    const dx = ped.goalX - ped.x;
    const dy = ped.goalY - ped.y;
    const d = Math.hypot(dx, dy);
    if (d < 12) {
      const lx = roadLine(ped.x) + (rng() < 0.5 ? -CITY.roadHalf - 14 : CITY.roadHalf + 14);
      const ly = roadLine(ped.y) + (rng() < 0.5 ? -CITY.roadHalf - 14 : CITY.roadHalf + 14);
      if (rng() < 0.5) { ped.goalX = lx; ped.goalY = ped.y + range(rng, -180, 180); }
      else { ped.goalX = ped.x + range(rng, -180, 180); ped.goalY = ly; }
      ped.goalX = Math.max(20, Math.min(CITY.size - 20, ped.goalX));
      ped.goalY = Math.max(20, Math.min(CITY.size - 20, ped.goalY));
    } else {
      const a = Math.atan2(dy, dx);
      // Smooth turning keeps the little walkers from snapping direction.
      let diff = a - ped.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      ped.angle += Math.max(-3 * dt, Math.min(3 * dt, diff));
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
      ped.phase += dt * 9;
      if (!isRoad(ped.x, ped.y)) ped.speed = Math.min(78, ped.speed + dt * 20);
    }
  }
}

/** Find a road-aligned approach point for a police car chasing a target far away. */
function approachPoint(x, y, tx, ty) {
  const lineX = roadLine(x);
  const lineY = roadLine(y);
  const nearX = Math.abs(x - lineX) < Math.abs(y - lineY);
  if (nearX) {
    const dir = Math.sign(tx - x) || 1;
    return { x: lineX + laneFor('v', dir), y: lineY };
  }
  const dir = Math.sign(ty - y) || 1;
  return { x: lineX, y: lineY + laneFor('h', dir) };
}

/** Police chase the player on streets, then close in directly when nearby. */
export function updatePolice(state, dt) {
  const target = state.player.inCar ?? state.player;
  let nearest = Infinity;
  for (const car of state.cars) {
    if (!car.police) continue;
    const d = Math.hypot(car.x - target.x, car.y - target.y);
    nearest = Math.min(nearest, d);
    let aimX = target.x;
    let aimY = target.y;
    if (d > 820) {
      const p = approachPoint(car.x, car.y, target.x, target.y);
      aimX = p.x;
      aimY = p.y;
    }
    const desired = Math.atan2(aimY - car.y, aimX - car.x);
    let diff = desired - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const turn = (d < 820 ? 2.6 : 1.9) * dt;
    car.angle += Math.max(-turn, Math.min(turn, diff));
    const wanted = WANTED.chaseSpeed[Math.min(5, state.player.wanted)] ?? 400;
    const goalSpeed = d > 60 ? wanted : wanted * 0.35;
    car.speed += Math.max(-CAR.brake * dt, Math.min(CAR.accel * 1.5 * dt, goalSpeed - car.speed));
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = Math.max(10, Math.min(CITY.size - 10, car.x));
    car.y = Math.max(10, Math.min(CITY.size - 10, car.y));
    car.light = Math.floor(state.time * 7 + car.sirenPhase) % 2;
    car.sirenPhase += dt * 0.6;
  }
  state.policeNearest = nearest;
}

/** Keep a wanted level's police entourage roughly proportional to the stars. */
export function maintainPolice(state) {
  const wanted = state.player.wanted;
  const police = state.cars.filter((c) => c.police);
  const desired = wanted === 0 ? 0 : Math.min(2 + wanted * 2, 12);
  if (police.length < desired) {
    const p = state.player.inCar ?? state.player;
    const a = state.rng() * Math.PI * 2;
    const dist = 700 + state.rng() * 260;
    const car = makePoliceCar(state.rng, p.x + Math.cos(a) * dist, p.y + Math.sin(a) * dist);
    car.angle = a + Math.PI;
    state.cars.push(car);
  } else if (police.length > desired + 1) {
    const extra = police[police.length - 1];
    state.cars.splice(state.cars.indexOf(extra), 1);
  }
}

/** Bullets travel, expire on impact, and damage whatever they hit. */
export function updateBullets(state, dt) {
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const b = state.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let hit = false;
    if (b.life <= 0 || b.x < 0 || b.y < 0 || b.x > CITY.size || b.y > CITY.size) hit = true;

    if (!hit && b.friendly) {
      for (const enemy of state.enemies) {
        if (!enemy.alive) continue;
        if (Math.hypot(enemy.x - b.x, enemy.y - b.y) < 20) {
          enemy.health -= 24;
          burst(state, b.x, b.y, '#ffd27a', 5, 80);
          if (enemy.health <= 0) {
            enemy.alive = false;
            state.targetsKilled += 1;
            burst(state, enemy.x, enemy.y, '#ff7b5e', 14, 180);
            state.shake = Math.max(state.shake, 6);
          }
          hit = true;
          break;
        }
      }
    }
    if (!hit && !b.friendly) {
      const p = state.player.inCar ?? state.player;
      if (Math.hypot(p.x - b.x, p.y - b.y) < 22) {
        if (state.player.inCar) state.player.inCar.hp -= 6;
        else state.player.health -= 9;
        burst(state, b.x, b.y, '#ff9f6e', 6, 90);
        hit = true;
      }
    }
    if (hit) state.bullets.splice(i, 1);
  }
}

/** A short-lived spray of colour: sparks, smoke, glass and tyre dust. */
export function burst(state, x, y, color, count, speed) {
  for (let i = 0; i < count; i += 1) {
    const a = state.rng() * Math.PI * 2;
    const s = speed * (0.25 + state.rng() * 0.75);
    state.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 0.35 + state.rng() * 0.5, max: 0.85,
      color, size: 2 + state.rng() * 4,
    });
  }
  if (state.particles.length > 420) state.particles.splice(0, state.particles.length - 420);
}

export function updateParticles(state, dt) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const p = state.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - dt * 2.2;
    p.vy *= 1 - dt * 2.2;
    p.life -= dt;
    if (p.life <= 0) state.particles.splice(i, 1);
  }
}

/** Rival gunmen shoot at the player and keep their distance a little. */
export function updateEnemies(state, dt) {
  const p = state.player.inCar ?? state.player;
  for (const e of state.enemies) {
    if (!e.alive) continue;
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    e.angle = Math.atan2(p.y - e.y, p.x - e.x);
    e.phase += dt * 6;
    if (d < 900 && d > 70) {
      e.x += Math.cos(e.angle) * 46 * dt;
      e.y += Math.sin(e.angle) * 46 * dt;
    }
    e.fireTimer -= dt;
    if (e.fireTimer <= 0 && d < 700) {
      e.fireTimer = 1.1 + state.rng() * 1.3;
      const jitter = (state.rng() - 0.5) * 0.14;
      const a = e.angle + jitter;
      state.bullets.push({
        x: e.x + Math.cos(a) * 18, y: e.y + Math.sin(a) * 18,
        vx: Math.cos(a) * 720, vy: Math.sin(a) * 720,
        life: 1.3, friendly: false,
      });
      burst(state, e.x + Math.cos(a) * 20, e.y + Math.sin(a) * 20, '#ffe08a', 3, 60);
    }
  }
}

/** Muzzle flashes and siren chatter are visual only; no audio nodes are created here. */
export function spawnInitialTraffic(state) {
  for (let i = 0; i < 120; i += 1) state.cars.push(makeTrafficCar(state.rng));
  for (let i = 0; i < 44; i += 1) {
    // Parked cars make the kerbs feel lived in and give the player something to steal.
    const car = makeTrafficCar(state.rng);
    car.parked = true;
    car.speed = 0;
    const r = car.road;
    r.offset = r.direction > 0 ? 34 : -34;
    const p = lanePoint(r.axis, r.line, r.offset, r.along);
    car.x = p.x;
    car.y = p.y;
    state.cars.push(car);
  }
  for (let i = 0; i < 180; i += 1) {
    const x = 60 + state.rng() * (CITY.size - 120);
    const y = 60 + state.rng() * (CITY.size - 120);
    if (x > CITY.bayStart) continue;
    state.peds.push(makePed(state.rng, x, y));
  }
}

/** Gather a few moving cars and walkers around a point for a busier screenshot. */
export function clusterAround(state, cx, cy, cars = 14, peds = 16) {
  const movers = state.cars.filter((c) => !c.police && !c.parked);
  for (let i = 0; i < Math.min(cars, movers.length); i += 1) {
    const car = movers[i];
    const r = car.road;
    r.axis = state.rng() < 0.5 ? 'h' : 'v';
    const base = r.axis === 'h' ? cy : cx;
    r.line = Math.round(base / CITY.cell) * CITY.cell + (state.rng() < 0.5 ? 0 : CITY.cell);
    r.direction = state.rng() < 0.5 ? 1 : -1;
    r.offset = laneFor(r.axis, r.direction);
    r.along = (r.axis === 'h' ? cx : cy) + (state.rng() - 0.5) * 900;
    const p = lanePoint(r.axis, r.line, r.offset, r.along);
    car.x = p.x;
    car.y = p.y;
    car.angle = r.axis === 'h' ? (r.direction > 0 ? 0 : Math.PI) : (r.direction > 0 ? Math.PI / 2 : -Math.PI / 2);
    car.speed = 90 + state.rng() * 90;
  }
  for (let i = 0; i < Math.min(peds, state.peds.length); i += 1) {
    const ped = state.peds[i];
    const spot = sidewalkPoint(cx + (state.rng() - 0.5) * 900, cy + (state.rng() - 0.5) * 700);
    ped.x = spot.x;
    ped.y = spot.y;
    ped.goalX = spot.x + (state.rng() - 0.5) * 220;
    ped.goalY = spot.y + (state.rng() - 0.5) * 220;
  }
}

export { lanePoint, laneFor };
