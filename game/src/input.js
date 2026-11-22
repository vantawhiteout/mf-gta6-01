// Keyboard and mouse. Edge-triggered keys are consumed once per take() call;
// held keys drive walking, driving and firing.
const HELD_KEYS = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
  Space: 'handbrake',
};

const EDGE_KEYS = {
  KeyE: 'enter', Enter: 'confirm', KeyP: 'pause', Escape: 'pause',
  KeyR: 'reload', KeyC: 'continue', KeyM: 'mute',
};

export function createInput(canvas) {
  const held = Object.create(null);
  const edges = Object.create(null);
  const mouse = { x: 640, y: 360, down: false };

  window.addEventListener('keydown', (event) => {
    if (HELD_KEYS[event.code]) {
      held[HELD_KEYS[event.code]] = true;
      event.preventDefault();
    }
    if (EDGE_KEYS[event.code] && !event.repeat) {
      edges[EDGE_KEYS[event.code]] = true;
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    if (HELD_KEYS[event.code]) held[HELD_KEYS[event.code]] = false;
  });
  window.addEventListener('blur', () => {
    for (const key of Object.keys(held)) held[key] = false;
  });
  canvas.addEventListener('mousemove', (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      mouse.down = true;
      edges.confirm = true;
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    mouse,
    take() {
      const result = {
        up: !!held.up, down: !!held.down, left: !!held.left, right: !!held.right,
        sprint: !!held.sprint, handbrake: !!held.handbrake,
        shoot: mouse.down,
        enter: !!edges.enter, confirm: !!edges.confirm,
        pause: !!edges.pause, reload: !!edges.reload,
        continue: !!edges.continue, mute: !!edges.mute,
      };
      for (const key of Object.keys(edges)) edges[key] = false;
      return result;
    },
    clearEdges() {
      for (const key of Object.keys(edges)) edges[key] = false;
    },
  };
}
