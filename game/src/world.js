// The simulation: one fixed step moves the player, traffic, police, bullets and missions.
// Screenshots reuse this same step through shots.js, so every frame is a real game frame.
import {
  CITY, CAR, HOSPITAL, MISSIONS, PLAYER, STEP, WANTED,
} from './config.js';
import { blockAt, createCity, isRoad, openSpotNear } from './city.js';
import { createRandom } from './random.js';
import {
  burst, maintainPolice, makeTrafficCar, spawnInitialTraffic,
  updateBullets, updateEnemies, updateParticles, updatePolice, updatePeds, updateTraffic,
} from './entities.js';
import { notify, startMission, updateMissions } from './missions.js';

export const EVENT_NONE = 0;
export const EVENT_BUSTED = 1;
export const EVENT_WASTED = 2;

function freshPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2,
    health: PLAYER.maxHealth, armor: 45,
    money: 450, inCar: null,
    ammo: PLAYER.magazine, reserve: 180, reload: 0, fireTimer: 0,
    wanted: 0, hiddenTime: 0, sprinting: false, walkPhase: 0,
  };
}

/** Build a whole new world from a seed. */
export function createWorld(seed = 1) {
  const rng = createRandom(seed | 0);
  const state = {
    seed, rng,
    city: createCity(createRandom((seed | 0) + 991)),
    player: freshPlayer(1240, 1240),
    cars: [], peds: [], bullets: [], particles: [], enemies: [],
    time: 0, shake: 0, markerPulse: 0, policeNearest: Infinity,
    missionIndex: 0, missionStage: 0, stolenDistance: 0,
    targetsKilled: 0, lastKilled: 0,
    notifications: [], statusLine: '', dirtySave: false,
    event: EVENT_NONE,
  };
  spawnInitialTraffic(state);
  startMission(state);
  return state;
}

/** Reset without changing the city, for a fresh run or a staged screenshot. */
export function resetWorld(state) {
  const rng = createRandom(state.seed | 0);
  state.rng = rng;
  state.player = freshPlayer(1240, 1240);
  state.city = createCity(createRandom((state.seed | 0) + 991));
  state.cars = [];
  state.peds = [];
  state.bullets = [];
  state.particles = [];
  state.enemies = [];
  state.time = 0;
  state.shake = 0;
  state.markerPulse = 0;
  state.policeNearest = Infinity;
  state.missionIndex = 0;
  state.missionStage = 0;
  state.stolenDistance = 0;
  state.targetsKilled = 0;
  state.lastKilled = 0;
  state.notifications = [];
  state.statusLine = '';
  state.event = EVENT_NONE;
  spawnInitialTraffic(state);
  startMission(state);
}

function hitsBuilding(state, x, y) {
  const block = blockAt(state.city, x, y);
  if (!block || block.kind === 'park' || block.kind === 'sand' || block.kind === 'water') return false;
  for (const b of block.buildings) {
    if (x > b.x + 3 && x < b.x + b.w - 3 && y > b.y + 3 && y < b.y + b.h - 3) return true;
  }
  return false;
}

function driveCar(state, car, input, dt) {
  const p = state.player;
  const steer = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (input.up) car.speed += CAR.accel * dt;
  else if (input.down) car.speed -= CAR.accel * dt;
  if (input.handbrake) car.speed *= 1 - Math.min(0.9, dt * 3.2);
  if (!input.up && !input.down) {
    const drag = CAR.drag * dt;
    car.speed = Math.abs(car.speed) <= drag ? 0 : car.speed - Math.sign(car.speed) * drag;
  }
  car.speed = Math.max(-CAR.reverseSpeed, Math.min(CAR.maxSpeed, car.speed));
  const grip = 0.35 + Math.min(1, Math.abs(car.speed) / 180) * 0.65;
  car.angle += steer * CAR.turnRate * grip * dt * (car.speed < -5 ? -1 : 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (hitsBuilding(state, nx, ny)) {
    if (Math.abs(car.speed) > 120) {
      burst(state, nx, ny, '#ffd58a', 9, 140);
      state.shake = Math.max(state.shake, 4);
    }
    car.speed *= -0.18;
  } else {
    car.x = Math.max(12, Math.min(CITY.size - 12, nx));
    car.y = Math.max(12, Math.min(CITY.size - 12, ny));
  }
  if (car.x > CITY.beachStart && state.rng() < dt * 12) burst(state, car.x, car.y, '#e9fbf6', 2, 90);
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
}

function leaveCar(state) {
  const p = state.player;
  const car = p.inCar;
  if (!car) return;
  const side = car.angle + Math.PI / 2;
  const ox = car.x + Math.cos(side) * 34;
  const oy = car.y + Math.sin(side) * 34;
  p.x = Math.max(20, Math.min(CITY.size - 20, ox));
  p.y = Math.max(20, Math.min(CITY.size - 20, oy));
  p.inCar = null;
  car.speed *= 0.25;
  p.angle = car.angle;
}

function enterCar(state) {
  const p = state.player;
  let best = null;
  let bestD = PLAYER.enterRange;
  for (const car of state.cars) {
    if (car.police) continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) { best = car; bestD = d; }
  }
  if (best) {
    p.inCar = best;
    p.x = best.x;
    p.y = best.y;
    best.speed = 0;
    notify(state, 'INSIDE VEHICLE', 'WASD to drive · Space handbrake · E to exit', 3.5);
  }
}

function shoot(state, input, dt) {
  const p = state.player;
  if (p.reload > 0) {
    p.reload -= dt;
    if (p.reload <= 0) { p.ammo = PLAYER.magazine; p.reserve -= PLAYER.magazine; }
    return;
  }
  if (p.fireTimer > 0) return;
  if (p.ammo <= 0) {
    if (p.reserve > 0) p.reload = PLAYER.reloadTime;
    return;
  }
  const angle = Math.atan2(input.aimY - p.y, input.aimX - p.x);
  p.angle = angle;
  p.ammo -= 1;
  p.fireTimer = PLAYER.fireDelay;
  const muzzleX = p.x + Math.cos(angle) * 24;
  const muzzleY = p.y + Math.sin(angle) * 24;
  state.bullets.push({
    x: muzzleX, y: muzzleY,
    vx: Math.cos(angle) * PLAYER.bulletSpeed,
    vy: Math.sin(angle) * PLAYER.bulletSpeed,
    life: 1.05, friendly: true,
  });
  burst(state, muzzleX, muzzleY, '#fff0b0', 4, 130);
  state.shake = Math.max(state.shake, 2.4);
}

function respawn(state, busted) {
  const p = state.player;
  p.inCar = null;
  p.x = HOSPITAL.x;
  p.y = HOSPITAL.y;
  p.health = PLAYER.maxHealth;
  p.armor = 25;
  p.wanted = 0;
  p.hiddenTime = 0;
  p.money = Math.max(0, p.money - (busted ? 180 : 120));
  state.cars = state.cars.filter((c) => !c.police);
  state.bullets.length = 0;
  state.shake = 10;
  state.event = busted ? EVENT_BUSTED : EVENT_WASTED;
  notify(state, busted ? 'BUSTED' : 'WASTED', 'You wake up at Cielo General. Some money went missing.', 5, '#ff6b78');
  state.dirtySave = true;
}

/**
 * Advance one 1/60 s tick. `input` has up/down/left/right/sprint/shoot/aimX/aimY/
 * handbrake/enter/reload flags. The same function runs in the game and in shot scenes.
 */
export function stepWorld(state, dt, input) {
  if (dt <= 0) return state.event;
  const p = state.player;
  state.event = EVENT_NONE;
  state.time += dt;
  p.fireTimer = Math.max(0, p.fireTimer - dt);

  if (input.enter) {
    if (p.inCar) leaveCar(state);
    else enterCar(state);
  }
  if (input.reload) p.reload = PLAYER.reloadTime;

  if (p.inCar) {
    driveCar(state, p.inCar, input, dt);
    if (p.inCar.hp <= 0) {
      burst(state, p.inCar.x, p.inCar.y, '#ff9a4d', 34, 260);
      state.shake = 14;
      p.inCar.x = -9999;
      p.inCar.y = -9999;
      p.inCar = null;
      p.health = 0;
    }
  } else {
    let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const len = Math.hypot(mx, my);
    p.sprinting = !!input.sprint && len > 0;
    const speed = (p.sprinting ? PLAYER.sprintSpeed : PLAYER.walkSpeed) * dt;
    if (len > 0) {
      mx /= len;
      my /= len;
      const nx = p.x + mx * speed;
      const ny = p.y + my * speed;
      if (!hitsBuilding(state, nx, p.y)) p.x = Math.max(14, Math.min(CITY.size - 14, nx));
      if (!hitsBuilding(state, p.x, ny)) p.y = Math.max(14, Math.min(CITY.size - 14, ny));
      p.walkPhase += dt * (p.sprinting ? 13 : 9);
      if (state.rng() < dt * 2.5) burst(state, p.x, p.y + 8, 'rgba(255,244,214,0.5)', 1, 25);
    }
    if (typeof input.aimX === 'number') {
      const a = Math.atan2(input.aimY - p.y, input.aimX - p.x);
      let diff = a - p.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      p.angle += Math.max(-9 * dt, Math.min(9 * dt, diff));
    }
    if (input.shoot) shoot(state, input, dt);
  }

  updateTraffic(state, dt);
  maintainPolice(state);
  updatePolice(state, dt);
  updatePeds(state, dt);
  updateEnemies(state, dt);
  updateBullets(state, dt);
  updateParticles(state, dt);
  updateMissions(state, dt);

  if (p.wanted > 0) {
    if (state.policeNearest > WANTED.escapeDistance) p.hiddenTime += dt;
    else p.hiddenTime = Math.max(0, p.hiddenTime - dt * 2);
    const limit = WANTED.escapeTime[Math.min(5, p.wanted)] ?? 20;
    if (p.hiddenTime > limit) {
      p.wanted -= 1;
      p.hiddenTime = 0;
      notify(state, 'WANTED LEVEL DROPPED', `${p.wanted} star${p.wanted === 1 ? '' : 's'} remaining.`, 2.5);
      state.dirtySave = true;
    }
    if (!p.inCar && state.policeNearest < 52) {
      respawn(state, true);
    }
  }
  if (p.health <= 0) respawn(state, false);

  state.shake = Math.max(0, state.shake - dt * 22);
  for (let i = state.notifications.length - 1; i >= 0; i -= 1) {
    state.notifications[i].life -= dt;
    if (state.notifications[i].life <= 0) state.notifications.splice(i, 1);
  }
  return state.event;
}

/** Apply a saved snapshot to a world, choosing a safe roadside start. */
export function applySave(state, save) {
  if (!save || typeof save !== 'object') return;
  const p = state.player;
  p.money = Number(save.money) || 0;
  p.health = Math.max(1, Math.min(PLAYER.maxHealth, Number(save.health) || PLAYER.maxHealth));
  p.armor = Number(save.armor) || 0;
  p.wanted = 0;
  const spot = openSpotNear(Number(save.x) || 1240, Number(save.y) || 1240);
  p.x = spot.x;
  p.y = spot.y;
  state.player.inCar = null;
  state.missionIndex = Math.max(0, Math.min(MISSIONS.length, Number(save.mission) || 0));
  state.missionStage = 0;
  state.notifications.length = 0;
  startMission(state);
}

export function snapshotSave(state) {
  return {
    money: Math.round(state.player.money),
    health: Math.round(state.player.health),
    armor: Math.round(state.player.armor),
    x: Math.round(state.player.x),
    y: Math.round(state.player.y),
    mission: state.missionIndex,
  };
}

export { MISSIONS, STEP, isRoad, makeTrafficCar };
