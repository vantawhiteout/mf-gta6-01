// Deterministic screenshot scenes. Each one sets up a real world state, then the
// normal simulation is stepped forward so the frame is an honest game frame.
import { burst, clusterAround, makeEnemy, makePoliceCar } from './entities.js';
import { markerFor } from './missions.js';
import { MISSIONS } from './config.js';

function placePolice(state, count, radius, around) {
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2 + 0.7;
    const car = makePoliceCar(state.rng, around.x + Math.cos(a) * radius, around.y + Math.sin(a) * radius);
    car.angle = a + Math.PI;
    car.speed = 320;
    state.cars.push(car);
  }
}

function driving(state, x, y, angle, speed) {
  state.cars = state.cars.filter((c) => !c.police);
  const car = state.cars.find((c) => Math.abs(c.x - x) < 900 && Math.abs(c.y - y) < 900 && !c.police) || state.cars[0];
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.speed = speed;
  car.color = '#e94f64';
  state.player.inCar = car;
  state.player.x = x;
  state.player.y = y;
  state.player.angle = angle;
  state.player.health = 100;
  state.player.armor = 70;
  state.player.money = 2480;
  clusterAround(state, x, y, 16, 18);
}

/**
 * Put the world into one of the four documented scenes and return the scripted
 * control held while the scene settles. Names: drive, chase, foot, mission.
 */
export function stageShot(name, state) {
  state.notifications.length = 0;
  state.bullets.length = 0;
  state.particles.length = 0;
  state.shake = 0;
  const input = { up: true, down: false, left: false, right: false, sprint: false, handbrake: false, shoot: false, aimX: 0, aimY: 0 };

  if (name === 'chase') {
    driving(state, 2440, 2400, 0.02, 420);
    state.missionIndex = 1;
    state.missionStage = 1;
    state.player.wanted = 4;
    state.player.ammo = 27;
    state.player.reserve = 150;
    placePolice(state, 6, 250, state.player);
    for (let i = 0; i < 46; i += 1) burst(state, state.player.x - 30, state.player.y + 18, 'rgba(235,235,220,0.6)', 1, 90);
    state.notifications.push({ title: 'WANTED: 4 STARS', body: 'Every cruiser in the bay is after you.', life: 60, color: '#ffcf5c' });
    input.aimX = state.player.x + 400;
    input.aimY = state.player.y - 100;
    return { input, frames: 46, marker: { x: state.player.x + 360, y: state.player.y - 210, label: 'PARK THE CAR' }, zoomTarget: 1.15 };
  }

  if (name === 'foot') {
    state.player.inCar = null;
    state.player.x = 2140;
    state.player.y = 2960;
    state.player.angle = 0.15;
    state.player.wanted = 3;
    state.player.health = 82;
    state.player.armor = 46;
    state.player.money = 3120;
    state.player.ammo = 22;
    state.player.reserve = 140;
    state.missionIndex = 4;
    state.enemies.length = 0;
    for (let i = 0; i < 4; i += 1) {
      const a = -0.9 + i * 0.55;
      state.enemies.push(makeEnemy(state.rng, state.player.x + Math.cos(a) * (130 + i * 22), state.player.y + Math.sin(a) * (130 + i * 18)));
    }
    clusterAround(state, state.player.x, state.player.y, 12, 18);
    placePolice(state, 4, 430, state.player);
    input.up = false;
    input.shoot = true;
    input.aimX = state.player.x + 260;
    input.aimY = state.player.y - 40;
    state.notifications.push({ title: 'SUNSET RECKONING', body: 'Four rivals left. Keep moving.', life: 60, color: '#ff8ad8' });
    return { input, frames: 34, marker: { x: 2260, y: 2960, label: 'FINISH THE DEAL' }, zoomTarget: 1.15 };
  }

  if (name === 'mission') {
    driving(state, 4025, 3690, Math.PI / 2, 350);
    state.missionIndex = 2;
    state.missionStage = 1;
    state.player.wanted = 2;
    state.player.money = 1840;
    state.player.ammo = 29;
    placePolice(state, 3, 480, state.player);
    state.notifications.push({ title: 'CASE TAKEN', body: 'Get the ledger to the marina office.', life: 60, color: '#ff8ad8' });
    input.aimX = state.player.x + 120;
    input.aimY = state.player.y + 300;
    return { input, frames: 40, marker: markerFor(state), zoomTarget: 1.15 };
  }

  // The cover: a clean drive through downtown with traffic, walkers and a mission.
  driving(state, 2020, 2400, 0.05, 330);
  state.missionIndex = 1;
  state.missionStage = 1;
  state.player.wanted = 0;
  state.player.money = 1240;
  state.player.ammo = 30;
  state.player.reserve = 180;
  input.aimX = state.player.x + 360;
  input.aimY = state.player.y - 60;
  return { input, frames: 42, marker: { x: state.player.x + 340, y: state.player.y - 200, label: 'PARK THE CAR' }, zoomTarget: 1.15 };
}

export const SHOT_NAMES = ['drive', 'chase', 'foot', 'mission'];
export const SHOT_MISSIONS = MISSIONS.length;
