// The five-mission story: each mission advances in stages, places a marker in
// the world, and pays out when its objective is met. Free roam follows the story.
import { MISSIONS } from './config.js';
import { makeEnemy, burst } from './entities.js';
import { openSpotNear } from './city.js';

export function currentMission(state) {
  return MISSIONS[state.missionIndex] ?? null;
}

/** The pink objective's world position, or null during an escape/free roam. */
export function markerFor(state) {
  const m = currentMission(state);
  if (!m) return null;
  switch (m.type) {
    case 'goto': return { x: m.x, y: m.y, label: 'MEET MARA' };
    case 'steal_drive': return state.missionStage === 0 ? null : { x: m.x, y: m.y, label: 'PARK THE CAR' };
    case 'pickup_deliver': return state.missionStage === 0
      ? { x: m.x1, y: m.y1, label: 'TAKE THE CASE' }
      : { x: m.x2, y: m.y2, label: 'DELIVER THE LEDGER' };
    case 'kill': return { x: m.x, y: m.y, label: 'FINISH THE DEAL' };
    default: return null;
  }
}

/** Called once when a mission becomes active. */
export function startMission(state) {
  const m = currentMission(state);
  if (!m) return;
  state.missionStage = 0;
  state.stolenDistance = 0;
  state.targetsKilled = 0;
  if (m.type === 'kill') {
    state.enemies.length = 0;
    for (let i = 0; i < m.count; i += 1) {
      const a = (i / m.count) * Math.PI * 2 + 0.4;
      state.enemies.push(makeEnemy(state.rng, m.x + Math.cos(a) * (90 + i * 16), m.y + Math.sin(a) * (90 + i * 16)));
    }
  }
  if (m.type === 'heat') {
    state.player.wanted = 3;
    state.player.hiddenTime = 0;
  }
  notify(state, m.title.toUpperCase(), m.detail, 5.5);
}

function payout(state, m) {
  state.player.money += m.reward;
  state.notifications.push({ title: 'MISSION COMPLETE', body: `${m.title}  +$${m.reward}`, life: 5, color: '#ffcf5c' });
  burst(state, state.player.x, state.player.y, '#ffcf5c', 22, 220);
  state.missionIndex += 1;
  state.missionStage = 0;
  if (state.missionIndex >= MISSIONS.length) {
    state.notifications.push({ title: 'STORY COMPLETE', body: 'The ledger is safe. Cielo Bay is yours.', life: 8, color: '#ff8ad8' });
    state.enemies.length = 0;
  } else {
    startMission(state);
  }
  state.dirtySave = true;
}

/** Advance the active mission by one fixed step. */
export function updateMissions(state, dt) {
  const m = currentMission(state);
  if (!m) return;
  const p = state.player;
  const pos = p.inCar ?? p;
  const target = markerFor(state);

  if (m.type === 'goto') {
    if (!p.inCar && Math.hypot(p.x - m.x, p.y - m.y) < 66) payout(state, m);
  } else if (m.type === 'steal_drive') {
    if (state.missionStage === 0 && p.inCar && !p.inCar.police) {
      state.missionStage = 1;
      notify(state, 'WHEELS ACQUIRED', 'Drive the car to the marked spot.', 4);
    }
    if (state.missionStage === 1 && p.inCar && !p.inCar.police) {
      state.stolenDistance += Math.abs(p.inCar.speed) * dt;
      if (Math.hypot(pos.x - m.x, pos.y - m.y) < 90 && state.stolenDistance > 420) payout(state, m);
    }
  } else if (m.type === 'pickup_deliver') {
    if (state.missionStage === 0 && Math.hypot(pos.x - m.x1, pos.y - m.y1) < 70) {
      state.missionStage = 1;
      p.wanted = Math.max(p.wanted, 2);
      notify(state, 'CASE TAKEN', 'The alarm is out. Get the ledger to the marina.', 4.5);
      burst(state, pos.x, pos.y, '#7be8ff', 16, 140);
    } else if (state.missionStage === 1 && Math.hypot(pos.x - m.x2, pos.y - m.y2) < 90) {
      payout(state, m);
    }
  } else if (m.type === 'heat') {
    if (p.wanted === 0) payout(state, m);
  } else if (m.type === 'kill') {
    if (state.targetsKilled >= m.count) payout(state, m);
    else if (state.targetsKilled > state.lastKilled) {
      state.lastKilled = state.targetsKilled;
      notify(state, 'RIVAL DOWN', `${m.count - state.targetsKilled} left.`, 2.5);
    }
  }
  if (target && dt > 0) state.markerPulse += dt * 3;
}

/** A mission marker is unreachable when the player is in the water. */
export function missionSpawnPoint(state) {
  const m = currentMission(state);
  if (!m) return openSpotNear(state.player.x, state.player.y);
  return openSpotNear(m.x ?? m.x1 ?? state.player.x, m.y ?? m.y1 ?? state.player.y);
}

export function notify(state, title, body, life = 4, color = '#ffffff') {
  state.notifications.push({ title, body, life, color });
  if (state.notifications.length > 5) state.notifications.shift();
  state.statusLine = title;
}
