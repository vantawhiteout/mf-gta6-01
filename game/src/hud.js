// The HUD and the four screens. Everything is painted on the canvas so the
// screenshots show exactly what a player sees, at any window size.
import { CITY, COLOR, FIELD, FONT, MISSIONS, PLAYER } from './config.js';
import { districtName } from './city.js';
import { currentMission } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

function panel(ctx, x, y, w, h, r = 12) {
  ctx.fillStyle = COLOR.hudPanel;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.strokeStyle = COLOR.hudEdge;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function bar(ctx, x, y, w, h, value, max, color, label) {
  ctx.fillStyle = 'rgba(8,14,22,0.82)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 5); ctx.fill();
  const p = Math.max(0, Math.min(1, value / max));
  if (p > 0) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect(x + 2, y + 2, Math.max(3, (w - 4) * p), h - 4, 3); ctx.fill();
  }
  ctx.fillStyle = COLOR.hudText;
  ctx.font = `bold 12px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(label, x, y - 5);
}

function stars(ctx, x, y, count) {
  ctx.textAlign = 'left';
  ctx.font = `bold 26px ${FONT}`;
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < count ? COLOR.gold : 'rgba(255,255,255,0.20)';
    ctx.fillText('★', x + i * 25, y);
  }
}

function minimap(ctx, view, state) {
  const size = Math.min(210, Math.max(132, view.h * 0.28));
  const x = view.w - size - 22;
  const y = 20;
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x, y, size, size, 14); ctx.clip();
  ctx.fillStyle = '#20303a';
  ctx.fillRect(x, y, size, size);
  const scale = size / (CITY.size * 0.46);
  const p = state.player.inCar ?? state.player;
  const ox = x + size / 2 - p.x * scale;
  const oy = y + size / 2 - p.y * scale;

  // Water, sand, parks, then the street grid.
  ctx.fillStyle = '#2b8ba6';
  ctx.fillRect(ox + CITY.bayStart * scale, y, size, size);
  ctx.fillStyle = '#e7cf9a';
  ctx.fillRect(ox + CITY.beachStart * scale, y, (CITY.bayStart - CITY.beachStart) * scale, size);
  ctx.fillStyle = '#5f915b';
  for (const b of state.city.blocks) {
    if (b.kind === 'park') ctx.fillRect(ox + b.x0 * scale, oy + b.y0 * scale, b.w * scale, b.h * scale);
  }
  ctx.fillStyle = '#6d7884';
  for (let i = 0; i <= CITY.cells; i += 1) {
    const c = i * CITY.cell;
    ctx.fillRect(ox + (c - CITY.roadHalf) * scale, y, CITY.roadHalf * 2 * scale, size);
    ctx.fillRect(x, oy + (c - CITY.roadHalf) * scale, size, CITY.roadHalf * 2 * scale);
  }
  ctx.fillStyle = 'rgba(210,224,228,0.75)';
  ctx.fillRect(x, oy + p.y * scale - 1, size, 2);
  ctx.fillRect(ox + p.x * scale - 1, y, 2, size);

  for (const car of state.cars) {
    if (car.x === -9999) continue;
    const cx = ox + car.x * scale;
    const cy = oy + car.y * scale;
    if (cx < x - 4 || cx > x + size + 4 || cy < y - 4 || cy > y + size + 4) continue;
    ctx.fillStyle = car.police ? '#ff4f62' : '#d7e0e4';
    ctx.fillRect(cx - 2, cy - 2, 4, 4);
  }
  if (state.marker) {
    const mx = ox + state.marker.x * scale;
    const my = oy + state.marker.y * scale;
    ctx.fillStyle = COLOR.mission;
    ctx.beginPath(); ctx.arc(mx, my, 7, 0, 6.29); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(mx, my, 10 + Math.sin(state.markerPulse) * 2, 0, 6.29); ctx.stroke();
  }
  // The player arrow always points where the car or character faces.
  ctx.save();
  ctx.translate(ox + p.x * scale, oy + p.y * scale);
  ctx.rotate(p.angle + Math.PI / 2);
  ctx.fillStyle = '#ffd45e';
  ctx.strokeStyle = '#16202d';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(7, 8); ctx.lineTo(-7, 8); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.restore();
  ctx.strokeStyle = COLOR.hudEdge;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(x, y, size, size, 14); ctx.stroke();
  ctx.fillStyle = COLOR.hudText;
  ctx.font = `bold 12px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(districtName(p.x, p.y), x + size / 2, y + size - 10);
}

function missionBanner(ctx, view, state) {
  const m = currentMission(state);
  if (!m) return;
  const w = Math.min(560, view.w - 460);
  if (w < 220) return;
  const x = view.w / 2 - w / 2;
  panel(ctx, x, 18, w, 62, 10);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLOR.mission;
  ctx.font = `bold 13px ${FONT}`;
  ctx.fillText(`MISSION ${state.missionIndex + 1}/${MISSIONS.length}  ·  ${m.title.toUpperCase()}`, view.w / 2, 40);
  ctx.fillStyle = COLOR.hudText;
  ctx.font = `bold 16px ${FONT}`;
  ctx.fillText(m.objective, view.w / 2, 64);
}

function notifications(ctx, view, state) {
  // Keep notices on the left so they never cover an objective marker or a chase.
  let y = view.h - 164;
  for (let i = state.notifications.length - 1; i >= 0 && i > state.notifications.length - 4; i -= 1) {
    const n = state.notifications[i];
    const alpha = Math.min(1, n.life * 1.6);
    ctx.globalAlpha = alpha;
    ctx.font = `bold 20px ${FONT}`;
    const w = Math.max(230, ctx.measureText(n.title).width + 40);
    panel(ctx, 22, y - 26, w, 50, 8);
    ctx.textAlign = 'left';
    ctx.fillStyle = n.color;
    ctx.fillText(n.title, 36, y + 2);
    ctx.font = `13px ${FONT}`;
    ctx.fillStyle = COLOR.hudText;
    ctx.fillText(n.body, 36, y + 21);
    ctx.globalAlpha = 1;
    y -= 58;
  }
}

function readout(ctx, view, state) {
  const p = state.player;
  const car = p.inCar;
  // Ammo and speed live in the lower right, away from the minimap.
  const w = 210;
  const x = view.w - w - 22;
  const y = view.h - 96;
  panel(ctx, x, y, w, 76, 10);
  ctx.textAlign = 'left';
  if (car) {
    const mph = Math.round(Math.abs(car.speed) * 0.55);
    ctx.fillStyle = COLOR.gold;
    ctx.font = `bold 34px ${FONT}`;
    ctx.fillText(String(mph), x + 16, y + 48);
    ctx.fillStyle = COLOR.hudDim;
    ctx.font = `bold 12px ${FONT}`;
    ctx.fillText('MPH', x + 16 + ctx.measureText(String(mph)).width + 34, y + 46);
    ctx.fillStyle = car.hp < 45 ? COLOR.danger : COLOR.hudText;
    ctx.font = `bold 13px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(`VEHICLE ${Math.max(0, Math.round(car.hp))}%`, x + w - 14, y + 46);
    ctx.fillStyle = COLOR.hudDim;
    ctx.textAlign = 'left';
    ctx.font = `12px ${FONT}`;
    ctx.fillText('E exit  ·  Space handbrake', x + 16, y + 66);
  } else {
    ctx.fillStyle = p.reload > 0 ? COLOR.hudDim : COLOR.hudText;
    ctx.font = `bold 30px ${FONT}`;
    ctx.fillText(p.reload > 0 ? 'RELOAD' : `${p.ammo} / ${p.reserve}`, x + 16, y + 44);
    ctx.fillStyle = COLOR.gold;
    ctx.font = `bold 12px ${FONT}`;
    ctx.fillText('SIDEARM  ·  LMB FIRE  ·  R RELOAD', x + 16, y + 66);
  }

  // Money, health, armour and stars in the lower left.
  const px = 22;
  const py = view.h - 104;
  panel(ctx, px - 8, py - 30, 316, 116, 12);
  ctx.fillStyle = COLOR.gold;
  ctx.font = `bold 26px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(`$${p.money.toLocaleString()}`, px + 8, py);
  stars(ctx, px + 176, py + 1, p.wanted);
  bar(ctx, px + 8, py + 20, 286, 13, p.health, PLAYER.maxHealth, COLOR.health, 'HEALTH');
  bar(ctx, px + 8, py + 58, 286, 13, p.armor, PLAYER.maxArmor, COLOR.armor, 'ARMOUR');

  ctx.fillStyle = 'rgba(255,246,226,0.75)';
  ctx.font = `12px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('WASD move/drive · E enter/exit · LMB fire · Shift run · P pause', 24, view.h - 12);
}

function crosshair(ctx, view, meta) {
  if (!meta || !meta.mouse || meta.screen !== SCREEN_PLAY) return;
  const { x, y } = meta.mouse;
  ctx.strokeStyle = 'rgba(255,246,226,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 12, y); ctx.lineTo(x - 4, y);
  ctx.moveTo(x + 4, y); ctx.lineTo(x + 12, y);
  ctx.moveTo(x, y - 12); ctx.lineTo(x, y - 4);
  ctx.moveTo(x, y + 4); ctx.lineTo(x, y + 12);
  ctx.stroke();
}

function dim(ctx, view) {
  ctx.fillStyle = 'rgba(9,14,22,0.72)';
  ctx.fillRect(0, 0, view.w, view.h);
}

function titleScreen(ctx, view, state, meta) {
  dim(ctx, view);
  const cx = view.w / 2;
  const cy = view.h / 2;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffcf5c';
  ctx.font = `900 ${Math.min(88, Math.max(46, view.w * 0.068))}px ${FONT}`;
  ctx.fillText('CIELO BAY HEAT', cx, cy - 92);
  ctx.fillStyle = '#ff8ad8';
  ctx.font = `bold 22px ${FONT}`;
  ctx.fillText('A SUN-SOAKED OPEN-WORLD CRIME STORY', cx, cy - 52);
  ctx.fillStyle = COLOR.hudText;
  ctx.font = `17px ${FONT}`;
  ctx.fillText('Steal a car. Outrun the law. Sell the story.', cx, cy - 14);
  const blink = Math.sin(state.time * 3) > -0.3;
  if (blink) {
    ctx.fillStyle = COLOR.gold;
    ctx.font = `bold 26px ${FONT}`;
    ctx.fillText('PRESS ENTER TO START', cx, cy + 54);
  }
  if (meta && meta.hasSave) {
    ctx.fillStyle = '#9be7c4';
    ctx.font = `bold 17px ${FONT}`;
    ctx.fillText('C  continue your saved story', cx, cy + 92);
  }
  ctx.fillStyle = COLOR.hudDim;
  ctx.font = `14px ${FONT}`;
  ctx.fillText('WASD / arrows  walk & drive    ·    Mouse  aim    ·    Click  fire    ·    E  enter / exit    ·    P  pause', cx, cy + 140);
  ctx.fillStyle = 'rgba(255,246,226,0.55)';
  ctx.font = `13px ${FONT}`;
  ctx.fillText('Original city, characters, music and story. Nothing from any commercial game.', cx, view.h - 28);
}

function pauseScreen(ctx, view, state) {
  dim(ctx, view);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLOR.gold;
  ctx.font = `900 64px ${FONT}`;
  ctx.fillText('PAUSED', view.w / 2, view.h / 2 - 10);
  ctx.fillStyle = COLOR.hudText;
  ctx.font = `20px ${FONT}`;
  ctx.fillText('Press P to get back out there', view.w / 2, view.h / 2 + 36);
}

function overScreen(ctx, view, state) {
  dim(ctx, view);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLOR.danger;
  ctx.font = `900 72px ${FONT}`;
  ctx.fillText('WASTED', view.w / 2, view.h / 2 - 6);
  ctx.fillStyle = COLOR.hudText;
  ctx.font = `20px ${FONT}`;
  ctx.fillText('Press Enter to get back up', view.w / 2, view.h / 2 + 40);
}

/** Paint the whole overlay for a screen. */
export function drawHud(ctx, view, state, screen, meta) {
  if (screen === SCREEN_TITLE) { titleScreen(ctx, view, state, meta); return; }
  missionBanner(ctx, view, state);
  minimap(ctx, view, state);
  readout(ctx, view, state);
  notifications(ctx, view, state);
  crosshair(ctx, view, { ...meta, screen });
  if (screen === SCREEN_PAUSED) pauseScreen(ctx, view, state);
  if (screen === SCREEN_OVER) overScreen(ctx, view, state);
}
