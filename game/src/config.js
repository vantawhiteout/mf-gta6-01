// All tuning numbers, colours and story text for Cielo Bay Heat live here.
// The simulation uses a fixed 1280x720 logical field and a 1/60 second step.

export const FIELD = { width: 1280, height: 720 };
export const STEP = 1 / 60;

// The city is a 12 x 12 grid of 400 unit cells. Roads run along every grid line.
export const CITY = {
  cells: 12,
  cell: 400,
  roadHalf: 52,
  size: 4800,
  bayStart: 4350,   // the eastern edge is water: a beach and the marina
  beachStart: 4230,
};

export const PLAYER = {
  walkSpeed: 205,
  sprintSpeed: 330,
  radius: 13,
  maxHealth: 100,
  maxArmor: 100,
  enterRange: 82,
  bulletSpeed: 1250,
  fireDelay: 0.105,
  reloadTime: 1.25,
  magazine: 30,
};

export const CAR = {
  maxSpeed: 430,
  reverseSpeed: 165,
  accel: 240,
  brake: 470,
  drag: 130,
  turnRate: 2.5,
};

export const WANTED = {
  escapeDistance: 1050,
  escapeTime: [10, 14, 18, 22, 26],
  patrolSpeed: 250,
  chaseSpeed: [0, 320, 360, 400, 430, 460],
};

// A warm, sun-soaked coastal palette: sand, coral, teal, deep shadow.
export const COLOR = {
  skyTop: '#7fd4ef',
  grass: '#9dc46f',
  grassDark: '#83b15c',
  sand: '#f2d9a1',
  water: '#2e9bb5',
  waterLight: '#48bdd0',
  foam: '#e9fbf6',
  road: '#4c5561',
  roadLine: '#e9d98a',
  sidewalk: '#c9c4b3',
  curb: '#a8a493',
  shadow: 'rgba(28, 32, 44, 0.28)',
  ink: '#16202d',
  hudPanel: 'rgba(14, 22, 33, 0.78)',
  hudEdge: 'rgba(255, 236, 184, 0.35)',
  hudText: '#fff6e2',
  hudDim: '#b9c6cf',
  gold: '#ffcf5c',
  health: '#5fe08a',
  armor: '#5fb9ef',
  danger: '#ff5f6d',
  mission: '#ff8ad8',
};

export const BUILDING_COLORS = [
  ['#e8b48a', '#b9795c'], ['#f0d4a8', '#c49b70'], ['#d5a7a0', '#a46f72'],
  ['#a9c8c3', '#6e9996'], ['#cbb6d6', '#8d76a1'], ['#e0c58b', '#ad8e52'],
  ['#a7bfd8', '#6c8cae'], ['#d8b2b8', '#a57483'], ['#b9cfa0', '#7c9b66'],
  ['#e6cdb4', '#b19076'], ['#9fbccb', '#668da0'], ['#dec0a4', '#ae8a6c'],
];

export const CAR_COLORS = [
  '#e94f64', '#f2b544', '#3fb8a5', '#5a7fe0', '#e8e6df', '#343a46',
  '#d9648b', '#79c45d', '#c98a4b', '#7a5fc4', '#48b0d8', '#c33c3c',
];

// Five missions tell one original story: a courier pulls a ledger out of a
// crooked development deal and has to carry it across the bay.
export const MISSIONS = [
  {
    id: 'call', title: 'A Call From Mara',
    objective: 'Walk to the pink marker at the coffee kiosk.',
    detail: 'Mara says a developer is burying a ledger. Meet her before she leaves town.',
    type: 'goto', x: 820, y: 1180, reward: 250,
  },
  {
    id: 'wheels', title: 'Borrowed Wheels',
    objective: 'Steal any car, then drive it to the pink marker.',
    detail: 'Take a set of wheels from the street. Nobody said they had to be yours.',
    type: 'steal_drive', x: 2560, y: 1780, reward: 600,
  },
  {
    id: 'ledger', title: 'The Ledger',
    objective: 'Collect the case, then deliver it to the marina office.',
    detail: 'The case changes hands at the fountain. Expect company when you grab it.',
    type: 'pickup_deliver', x1: 3520, y1: 2960, x2: 4080, y2: 3920, reward: 1200,
  },
  {
    id: 'heat', title: 'Lose The Heat',
    objective: 'Three stars. Break line of sight and lose the police.',
    detail: 'The whole bay is looking for you. Lay low until the stars fade.',
    type: 'escape', reward: 1600,
  },
  {
    id: 'showdown', title: 'Sunset Reckoning',
    objective: 'Take down the six rivals waiting at the marina.',
    detail: 'Mara is done running. Finish this on the waterfront.',
    type: 'kill', x: 4520, y: 3380, count: 6, reward: 3200,
  },
];

export const HOSPITAL = { x: 1240, y: 720 };
export const SAVE_KEY = 'cielobay-heat.save.v1';
export const BEST_KEY = 'cielobay-heat.best.v1';
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
