// Boot and the single game loop. ?seed=N fixes the city; ?shot=drive|chase|foot|mission
// stages one of the four screenshot scenes, steps the real simulation, and paints it.
import { SAVE_KEY, STEP } from './config.js';
import { applySave, createWorld, resetWorld, snapshotSave, stepWorld } from './world.js';
import { createInput } from './input.js';
import { createRenderer } from './render.js';
import { drawHud, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './hud.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';
import { markerFor } from './missions.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261122;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const state = createWorld(seed);
const renderer = createRenderer(canvas);
const inputSource = createInput(canvas);
const audio = createAudio();

function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(snapshotSave(state)));
    state.dirtySave = false;
  } catch {
    state.dirtySave = false;
  }
}

let saved = loadSave();
let screen = SCREEN_TITLE;
let lastNotification = '';
let saveTimer = 0;
let sirenTimer = 0;

function announce(message) {
  status.textContent = message;
}

function aimInWorld() {
  const cam = renderer.camera;
  const mouse = inputSource.mouse;
  return {
    x: cam.x + (mouse.x - window.innerWidth / 2) / cam.zoom,
    y: cam.y + (mouse.y - window.innerHeight / 2) / cam.zoom,
  };
}

function handleMeta(raw) {
  if (raw.mute) {
    const muted = audio.toggle();
    announce(muted ? 'Sound off.' : 'Sound on.');
  }
}

function startFresh() {
  resetWorld(state);
  renderer.camera.x = state.player.x;
  renderer.camera.y = state.player.y;
  screen = SCREEN_PLAY;
  audio.resume();
  announce('Playing. Walk to the pink marker to meet Mara.');
}

function startSaved() {
  if (!saved) return;
  resetWorld(state);
  applySave(state, saved);
  renderer.camera.x = state.player.x;
  renderer.camera.y = state.player.y;
  screen = SCREEN_PLAY;
  audio.resume();
  announce('Story resumed.');
}

// ---- Screenshot mode: stage a real world, step it, and expose a readiness flag. ----
if (shot) {
  const scene = stageShot(shot, state);
  state.marker = scene.marker;
  renderer.camera.x = state.player.x;
  renderer.camera.y = state.player.y;
  renderer.camera.zoom = state.player.inCar ? 0.88 : 1;
  let frames = 0;
  function shotFrame() {
    stepWorld(state, STEP, scene.input);
    state.marker = scene.marker;
    renderer.draw(state, SCREEN_PLAY, { hud: drawHud, hasSave: false, mouse: null, zoomTarget: scene.zoomTarget });
    frames += 1;
    if (frames < scene.frames) requestAnimationFrame(shotFrame);
    else window.__shotReady = true;
  }
  requestAnimationFrame(shotFrame);
} else {
  // ---- Interactive mode: a fixed 60 Hz simulation with a smooth painted frame. ----
  let accumulator = 0;
  let previous = performance.now();

  function handleActions(raw) {
    handleMeta(raw);
    if (raw.confirm && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) startFresh();
    else if (raw.continue && screen === SCREEN_TITLE && saved) startSaved();
    else if (raw.pause && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (raw.pause && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const elapsed = Math.min(0.25, (now - previous) / 1000);
    previous = now;
    const raw = inputSource.take();
    handleActions(raw);
    const aim = aimInWorld();

    if (screen === SCREEN_PLAY) {
      accumulator += elapsed;
      let guard = 0;
      while (accumulator >= STEP && guard < 12) {
        const control = {
          up: raw.up, down: raw.down, left: raw.left, right: raw.right,
          sprint: raw.sprint, handbrake: raw.handbrake, shoot: raw.shoot,
          enter: raw.enter, reload: raw.reload,
          aimX: aim.x, aimY: aim.y,
        };
        stepWorld(state, STEP, control);
        // An edge key must only fire on the first sub-step of a frame.
        control.enter = false;
        control.reload = false;
        accumulator -= STEP;
        guard += 1;
      }
      audio.engine(state.player.inCar?.speed ?? 0, !!state.player.inCar);
      sirenTimer -= elapsed;
      if (state.player.wanted > 0 && sirenTimer <= 0) {
        sirenTimer = 2.6;
        audio.play('siren');
      }
      const latest = state.notifications[state.notifications.length - 1];
      if (latest && latest.title !== lastNotification) {
        lastNotification = latest.title;
        if (latest.title === 'MISSION COMPLETE' || latest.title === 'STORY COMPLETE') audio.play('cash');
        else if (latest.title === 'BUSTED' || latest.title === 'WASTED') audio.play('busted');
        else audio.play('hit');
      }
      if (!state.notifications.length) lastNotification = '';
      saveTimer += elapsed;
      if (saveTimer > 8 || state.dirtySave) {
        saveTimer = 0;
        writeSave();
        saved = snapshotSave(state);
      }
      if (raw.shoot && state.player.ammo !== undefined && state.player.fireTimer > 0.09) audio.play('shot');
    } else {
      accumulator = 0;
    }

    // Marker lookup stays in the mission module so the HUD and world agree.
    state.marker = screen === SCREEN_TITLE ? null : markerFor(state);
    renderer.draw(state, screen, { hud: drawHud, hasSave: !!saved, mouse: inputSource.mouse });
  }
  announce('Cielo Bay Heat. Press Enter to start.');
  requestAnimationFrame(frame);
}
