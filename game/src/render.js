// The painter: a warm top-down city with a little fake height on the buildings,
// then cars, people, effects and the light of a late-afternoon sun.
import { CITY, COLOR } from './config.js';

function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amount));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (n & 255) + amount));
  return `rgb(${r},${g},${b})`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const camera = { x: 1240, y: 1240, zoom: 1 };

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(320, window.innerWidth);
    const h = Math.max(240, window.innerHeight);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h, dpr };
  }
  let view = resize();
  window.addEventListener('resize', () => { view = resize(); });

  function drawGround(state, left, top, right, bottom) {
    ctx.fillStyle = COLOR.grass;
    ctx.fillRect(left, top, right - left, bottom - top);

    // A faint grid of lawn texture keeps large empty blocks from looking flat.
    ctx.fillStyle = COLOR.grassDark;
    for (let x = Math.floor(left / 90) * 90; x < right; x += 90) {
      for (let y = Math.floor(top / 90) * 90; y < bottom; y += 90) {
        if (((x / 90) + (y / 90)) % 3 === 0) ctx.fillRect(x + 26, y + 30, 34, 20);
      }
    }

    for (const block of state.city.blocks) {
      if (block.x0 > right || block.x0 + block.w < left || block.y0 > bottom || block.y0 + block.h < top) continue;
      if (block.kind === 'park') {
        ctx.fillStyle = '#86b96c';
        ctx.fillRect(block.x0, block.y0, block.w, block.h);
        ctx.strokeStyle = 'rgba(246,232,190,0.55)';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(block.x0 + 20, block.y0 + block.h / 2);
        ctx.lineTo(block.x0 + block.w - 20, block.y0 + block.h / 2);
        ctx.moveTo(block.x0 + block.w / 2, block.y0 + 20);
        ctx.lineTo(block.x0 + block.w / 2, block.y0 + block.h - 20);
        ctx.stroke();
      } else if (block.kind === 'sand') {
        ctx.fillStyle = COLOR.sand;
        ctx.fillRect(block.x0, block.y0, block.w, block.h);
      } else if (block.kind === 'docks') {
        ctx.fillStyle = '#9a9382';
        ctx.fillRect(block.x0, block.y0, block.w, block.h);
      } else if (block.kind === 'water') {
        ctx.fillStyle = COLOR.water;
        ctx.fillRect(block.x0, block.y0, block.w, block.h);
      }
    }

    // The bay and its surf.
    const bay = CITY.bayStart;
    if (right > bay) {
      const grad = ctx.createLinearGradient(0, 0, CITY.size, 0);
      grad.addColorStop(0, COLOR.waterLight);
      grad.addColorStop(0.4, COLOR.water);
      grad.addColorStop(1, '#236f8d');
      ctx.fillStyle = grad;
      ctx.fillRect(bay, 0, CITY.size - bay, CITY.size);
      ctx.strokeStyle = 'rgba(233,251,246,0.45)';
      ctx.lineWidth = 3;
      const t = state.time;
      for (let y = Math.max(0, Math.floor(top / 50) * 50); y < Math.min(CITY.size, bottom); y += 50) {
        ctx.beginPath();
        for (let x = bay + 16; x < CITY.size; x += 34) {
          const yy = y + Math.sin(x * 0.02 + t * 1.4 + y * 0.01) * 4;
          if (x === bay + 16) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
      ctx.fillStyle = COLOR.foam;
      ctx.fillRect(bay - 8, 0, 12, CITY.size);
    }
    if (right > CITY.beachStart) {
      ctx.fillStyle = COLOR.sand;
      ctx.fillRect(CITY.beachStart, 0, bay - CITY.beachStart, CITY.size);
    }

    // Asphalt and curbs for every road line.
    ctx.fillStyle = COLOR.road;
    for (let i = 0; i <= CITY.cells; i += 1) {
      const c = i * CITY.cell;
      if (c + CITY.roadHalf >= left && c - CITY.roadHalf <= right) ctx.fillRect(left, c - CITY.roadHalf, right - left, CITY.roadHalf * 2);
      if (c + CITY.roadHalf >= top && c - CITY.roadHalf <= bottom) ctx.fillRect(c - CITY.roadHalf, top, CITY.roadHalf * 2, bottom - top);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i <= CITY.cells; i += 1) {
      const c = i * CITY.cell;
      ctx.fillRect(left, c - CITY.roadHalf, right - left, 3);
      ctx.fillRect(left, c + CITY.roadHalf - 3, right - left, 3);
      ctx.fillRect(c - CITY.roadHalf, top, 3, bottom - top);
      ctx.fillRect(c + CITY.roadHalf - 3, top, 3, bottom - top);
    }
    // Dashed lane paint and white crosswalks at each junction.
    ctx.strokeStyle = COLOR.roadLine;
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 30]);
    for (let i = 0; i <= CITY.cells; i += 1) {
      const c = i * CITY.cell;
      if (c >= top - 40 && c <= bottom + 40) {
        ctx.beginPath(); ctx.moveTo(left, c); ctx.lineTo(right, c); ctx.stroke();
      }
      if (c >= left - 40 && c <= right + 40) {
        ctx.beginPath(); ctx.moveTo(c, top); ctx.lineTo(c, bottom); ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(245,240,220,0.55)';
    for (let gx = 0; gx <= CITY.cells; gx += 1) {
      for (let gy = 0; gy <= CITY.cells; gy += 1) {
        const x = gx * CITY.cell;
        const y = gy * CITY.cell;
        if (x < left - 60 || x > right + 60 || y < top - 60 || y > bottom + 60) continue;
        for (let k = -3; k <= 3; k += 1) {
          ctx.fillRect(x - 46 + k * 13, y - 60, 7, 15);
          ctx.fillRect(x - 46 + k * 13, y + 45, 7, 15);
          ctx.fillRect(x - 60, y - 46 + k * 13, 15, 7);
          ctx.fillRect(x + 45, y - 46 + k * 13, 15, 7);
        }
      }
    }
  }

  function drawBuilding(b) {
    const dx = b.height * 0.17;
    const dy = b.height * 0.28;
    ctx.fillStyle = COLOR.shadow;
    poly(ctx, [[b.x + 12, b.y + 14], [b.x + b.w + 12, b.y + 14], [b.x + b.w + 18, b.y + b.h + 20], [b.x + 18, b.y + b.h + 20]]);
    ctx.fill();
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x - dx, b.y - dy, b.w, b.h + dy);
    ctx.fillStyle = shade(b.wall, 26);
    poly(ctx, [[b.x, b.y + b.h], [b.x - dx, b.y + b.h - dy], [b.x + b.w - dx, b.y + b.h - dy], [b.x + b.w, b.y + b.h]]);
    ctx.fill();
    ctx.fillStyle = shade(b.wall, -22);
    poly(ctx, [[b.x + b.w, b.y], [b.x + b.w - dx, b.y - dy], [b.x + b.w - dx, b.y + b.h - dy], [b.x + b.w, b.y + b.h]]);
    ctx.fill();

    if (b.windows) {
      ctx.fillStyle = 'rgba(38,58,78,0.62)';
      const rowStep = Math.max(19, b.h / b.rows);
      for (let r = 0; r < b.rows; r += 1) {
        const wy = b.y + b.h - dy + r * rowStep * 0.7;
        for (let c = 0; c < b.cols; c += 1) {
          const wx = b.x - dx + 8 + c * (b.w / b.cols);
          if (wx + 12 > b.x + b.w - dx - 4) continue;
          if ((r * 7 + c * 3 + (b.seed * 100 | 0)) % 5 !== 0) ctx.fillRect(wx, wy, Math.min(14, b.w / b.cols - 6), 8);
        }
      }
    }
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x - dx, b.y - dy, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.16)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x - dx, b.y - dy, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(b.x - dx + 6, b.y - dy + 6, b.w - 12, 5);
    if (b.rooftop) {
      ctx.fillStyle = shade(b.roof, -40);
      rr(ctx, b.x - dx + b.w * 0.25, b.y - dy + b.h * 0.3, b.w * 0.42, b.h * 0.3, 4);
      ctx.fill();
      ctx.fillStyle = shade(b.roof, 30);
      ctx.fillRect(b.x - dx + b.w * 0.3, b.y - dy + b.h * 0.36, b.w * 0.3, 4);
    }
    if (b.billboard && b.w > 90) {
      ctx.fillStyle = '#1c2635';
      ctx.fillRect(b.x - dx + 12, b.y - dy + 12, b.w - 24, 30);
      ctx.fillStyle = '#ffd76a';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.sign, b.x - dx + b.w / 2, b.y - dy + 32);
    }
  }

  function drawProps(state) {
    for (const p of state.city.props) {
      if (p.kind === 'fountain') {
        ctx.fillStyle = '#d9cdb4';
        ctx.beginPath(); ctx.ellipse(p.x, p.y, 54, 44, 0, 0, 6.29); ctx.fill();
        ctx.fillStyle = '#61c2d4';
        ctx.beginPath(); ctx.ellipse(p.x, p.y, 42, 33, 0, 0, 6.29); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(p.x, p.y, 22 + Math.sin(state.time * 2) * 3, 0, 6.29); ctx.stroke();
      } else if (p.kind === 'boat') {
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath(); ctx.ellipse(p.x + 8, p.y + 10, 36, 16, 0.3, 0, 6.29); ctx.fill();
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.sin(state.time * 0.5 + p.hue * 9) * 0.08);
        ctx.fillStyle = p.hue < 0.5 ? '#f3ece0' : '#e3c16f';
        poly(ctx, [[-38, -10], [32, -12], [46, 0], [32, 12], [-38, 10]]); ctx.fill();
        ctx.fillStyle = '#4b6f83'; ctx.fillRect(-12, -8, 22, 16);
        ctx.restore();
      } else if (p.kind === 'pier') {
        ctx.fillStyle = '#c9a878';
        ctx.fillRect(p.x - 22, p.y - 260, 44, 300);
        ctx.fillStyle = '#a47f52';
        for (let y = p.y - 250; y < p.y + 40; y += 18) ctx.fillRect(p.x - 22, y, 44, 4);
      } else if (p.kind === 'office') {
        ctx.fillStyle = '#d8d2c0'; ctx.fillRect(p.x - 60, p.y - 46, 120, 92);
        ctx.fillStyle = '#5b7890'; ctx.fillRect(p.x - 50, p.y - 36, 100, 28);
        ctx.fillStyle = '#ffdf94'; ctx.font = 'bold 15px system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('MARINA OFFICE', p.x, p.y + 24);
      } else if (p.kind === 'lighthouse') {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath(); ctx.ellipse(p.x + 12, p.y + 16, 34, 20, 0, 0, 6.29); ctx.fill();
        ctx.fillStyle = '#f1ece0';
        ctx.beginPath(); ctx.arc(p.x, p.y, 24, 0, 6.29); ctx.fill();
        ctx.strokeStyle = '#d7545a'; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(p.x, p.y, 24, 0, 6.29); ctx.stroke();
        ctx.fillStyle = '#ffe9a8';
        ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, 6.29); ctx.fill();
      } else if (p.kind === 'container') {
        ctx.fillStyle = ['#d35b56', '#4d94a8', '#e0b253', '#6c8e64'][Math.floor(p.hue * 4) % 4];
        rr(ctx, p.x - 44, p.y - 20, 88, 40, 3); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 3;
        for (let k = -32; k < 40; k += 12) { ctx.beginPath(); ctx.moveTo(p.x + k, p.y - 18); ctx.lineTo(p.x + k, p.y + 18); ctx.stroke(); }
      }
    }
    for (const t of state.city.trees) {
      ctx.fillStyle = 'rgba(34,60,40,0.22)';
      ctx.beginPath(); ctx.ellipse(t.x + 8, t.y + 10, t.r, t.r * 0.7, 0, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#4f8c52';
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#6ba662';
      ctx.beginPath(); ctx.arc(t.x - t.r * 0.25, t.y - t.r * 0.25, t.r * 0.6, 0, 6.29); ctx.fill();
    }
    for (const t of state.city.palms) {
      const s = t.s;
      ctx.fillStyle = 'rgba(60,70,50,0.25)';
      ctx.beginPath(); ctx.ellipse(t.x + 12 * s, t.y + 8 * s, 22 * s, 9 * s, 0, 0, 6.29); ctx.fill();
      ctx.strokeStyle = '#8a6847'; ctx.lineWidth = 7 * s;
      ctx.beginPath(); ctx.moveTo(t.x, t.y + 14 * s); ctx.quadraticCurveTo(t.x + t.lean * 26 * s, t.y - 6 * s, t.x + t.lean * 40 * s, t.y - 26 * s); ctx.stroke();
      const tx = t.x + t.lean * 40 * s;
      const ty = t.y - 26 * s;
      ctx.fillStyle = '#3f8a5e';
      for (let k = 0; k < 6; k += 1) {
        const a = (k / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(tx + Math.cos(a) * 16 * s, ty + Math.sin(a) * 12 * s, 19 * s, 7 * s, a, 0, 6.29);
        ctx.fill();
      }
    }
    for (const l of state.city.lamps) {
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.beginPath(); ctx.ellipse(l.x + 4, l.y + 5, 7, 4, 0, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#45505e'; ctx.fillRect(l.x - 2, l.y - 2, 4, 5);
      ctx.fillStyle = '#ffe3a0'; ctx.beginPath(); ctx.arc(l.x, l.y - 3, 4, 0, 6.29); ctx.fill();
    }
  }

  function drawCar(car, isPlayer) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    const L = 48; const W = 25;
    ctx.fillStyle = 'rgba(20,26,36,0.34)';
    rr(ctx, -L / 2 + 6, -W / 2 + 7, L, W, 8); ctx.fill();
    ctx.fillStyle = '#1c222c';
    rr(ctx, -L / 2 - 2, -W / 2 - 1, L + 4, W + 2, 8); ctx.fill();
    ctx.fillStyle = car.color;
    rr(ctx, -L / 2, -W / 2, L, W, 7); ctx.fill();
    ctx.fillStyle = shade(car.color, 24);
    rr(ctx, -L / 2 + 8, -W / 2 + 3, L - 16, W - 6, 5); ctx.fill();
    ctx.fillStyle = '#3a5a72';
    rr(ctx, -2, -W / 2 + 4, 15, W - 8, 3); ctx.fill();
    ctx.fillStyle = '#263e52';
    rr(ctx, -18, -W / 2 + 4, 12, W - 8, 3); ctx.fill();
    // Headlights and tail lamps make the direction of travel obvious.
    ctx.fillStyle = '#fff3bc';
    ctx.fillRect(L / 2 - 4, -W / 2 + 3, 5, 6);
    ctx.fillRect(L / 2 - 4, W / 2 - 9, 5, 6);
    ctx.fillStyle = '#e25050';
    ctx.fillRect(-L / 2 + 1, -W / 2 + 3, 4, 6);
    ctx.fillRect(-L / 2 + 1, W / 2 - 9, 4, 6);
    if (car.police) {
      ctx.fillStyle = '#20293a';
      ctx.fillRect(-16, -W / 2, 12, W);
      ctx.fillStyle = car.light ? '#ff3b4e' : '#3b8cff';
      ctx.fillRect(-3, -9, 12, 7);
      ctx.fillStyle = car.light ? '#3b8cff' : '#ff3b4e';
      ctx.fillRect(-3, 2, 12, 7);
      const glow = ctx.createRadialGradient(3, 0, 1, 3, 0, 30);
      glow.addColorStop(0, car.light ? 'rgba(255,60,80,0.45)' : 'rgba(70,140,255,0.45)');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(-28, -34, 66, 68);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 7px system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('POLICE', -2, 3);
    }
    if (isPlayer) {
      ctx.strokeStyle = 'rgba(255,240,190,0.75)'; ctx.lineWidth = 2;
      rr(ctx, -L / 2 - 3, -W / 2 - 3, L + 6, W + 6, 9); ctx.stroke();
    }
    ctx.restore();
  }

  function drawPerson(x, y, angle, color, phase, isPlayer, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = 'rgba(20,26,36,0.3)';
    ctx.beginPath(); ctx.ellipse(4, 5, 13 * scale, 8 * scale, 0, 0, 6.29); ctx.fill();
    const sway = Math.sin(phase) * 2.6 * scale;
    ctx.fillStyle = shade(color, -30);
    ctx.fillRect(-9 * scale + sway, 2 * scale, 6 * scale, 10 * scale);
    ctx.fillRect(3 * scale - sway, 2 * scale, 6 * scale, 10 * scale);
    ctx.fillStyle = color;
    rr(ctx, -9 * scale, -10 * scale, 18 * scale, 20 * scale, 6 * scale); ctx.fill();
    ctx.fillStyle = '#e8c49a';
    ctx.beginPath(); ctx.arc(0, -9 * scale, 7 * scale, 0, 6.29); ctx.fill();
    ctx.fillStyle = shade(color, 20);
    ctx.beginPath(); ctx.arc(-1 * scale, -11 * scale, 6.5 * scale, 0, 6.29); ctx.fill();
    if (isPlayer) {
      ctx.fillStyle = '#2b3547';
      ctx.fillRect(6 * scale, -8 * scale, 18 * scale, 4 * scale);
      ctx.strokeStyle = 'rgba(255,236,180,0.85)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 17 * scale, 0, 6.29); ctx.stroke();
    }
    ctx.restore();
  }

  function drawMarker(state) {
    const m = state.marker;
    if (!m) return;
    const pulse = 0.5 + 0.5 * Math.sin(state.markerPulse);
    ctx.save();
    ctx.translate(m.x, m.y);
    const g = ctx.createRadialGradient(0, 0, 6, 0, 0, 96);
    g.addColorStop(0, `rgba(255,138,216,${0.45 + pulse * 0.2})`);
    g.addColorStop(1, 'rgba(255,138,216,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-100, -100, 200, 200);
    ctx.strokeStyle = '#ff8ad8';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(0, 12, 34 + pulse * 6, 15 + pulse * 3, 0, 0, 6.29); ctx.stroke();
    ctx.fillStyle = 'rgba(255,138,216,0.3)';
    poly(ctx, [[-18, 8], [18, 8], [0, -62 - pulse * 8]]); ctx.fill();
    ctx.strokeStyle = 'rgba(255,190,230,0.8)'; ctx.lineWidth = 2;
    poly(ctx, [[-18, 8], [18, 8], [0, -62 - pulse * 8]]); ctx.stroke();
    ctx.restore();
  }

  function drawWorld(state) {
    const cam = camera;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = COLOR.skyTop;
    ctx.fillRect(0, 0, view.w, view.h);
    const shakeX = (Math.random() - 0.5) * state.shake;
    const shakeY = (Math.random() - 0.5) * state.shake;
    const s = cam.zoom;
    ctx.setTransform(s, 0, 0, s, view.w / 2 - cam.x * s + shakeX, view.h / 2 - cam.y * s + shakeY);
    const left = cam.x - view.w / (2 * s) - 60;
    const top = cam.y - view.h / (2 * s) - 60;
    const right = cam.x + view.w / (2 * s) + 60;
    const bottom = cam.y + view.h / (2 * s) + 60;

    drawGround(state, left, top, right, bottom);
    drawProps(state);

    const buildings = state.city.buildings.filter((b) => b.x + b.w > left - 100 && b.x - 100 < right && b.y + b.h > top - 160 && b.y - 160 < bottom);
    buildings.sort((a, b) => (a.y + a.h) - (b.y + b.h));
    for (const b of buildings) drawBuilding(b);

    drawMarker(state);

    // People and vehicles are drawn back to front so they overlap correctly.
    const actors = [];
    for (const ped of state.peds) if (ped.x > left && ped.x < right && ped.y > top - 20 && ped.y < bottom + 20) actors.push({ y: ped.y, kind: 'ped', obj: ped });
    for (const car of state.cars) {
      if (car.x === -9999) continue;
      if (car.x > left - 60 && car.x < right + 60 && car.y > top - 60 && car.y < bottom + 60) actors.push({ y: car.y, kind: 'car', obj: car });
    }
    for (const e of state.enemies) if (e.alive && e.x > left && e.x < right && e.y > top && e.y < bottom) actors.push({ y: e.y, kind: 'enemy', obj: e });
    if (!state.player.inCar) actors.push({ y: state.player.y, kind: 'player', obj: state.player });
    actors.sort((a, b) => a.y - b.y);
    for (const a of actors) {
      if (a.kind === 'ped') drawPerson(a.obj.x, a.obj.y, a.obj.angle, a.obj.color, a.obj.phase, false);
      else if (a.kind === 'enemy') {
        drawPerson(a.obj.x, a.obj.y, a.obj.angle, a.obj.color, a.obj.phase, false, 1.08);
        ctx.strokeStyle = 'rgba(255,80,90,0.75)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(a.obj.x, a.obj.y, 20, 0, 6.29); ctx.stroke();
      } else if (a.kind === 'car') drawCar(a.obj, false);
      else drawPerson(a.obj.x, a.obj.y, a.obj.angle, '#f4c951', state.player.walkPhase, true, 1.18);
    }
    if (state.player.inCar) drawCar(state.player.inCar, true);

    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.max));
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 6.29); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const b of state.bullets) {
      ctx.strokeStyle = b.friendly ? '#fff0a8' : '#ff8e8e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
      ctx.stroke();
    }

    // A warm late-afternoon wash, then a soft vignette, both in screen space.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const sun = ctx.createLinearGradient(0, 0, view.w, view.h);
    sun.addColorStop(0, 'rgba(255,214,140,0.10)');
    sun.addColorStop(0.5, 'rgba(255,240,196,0.02)');
    sun.addColorStop(1, 'rgba(70,110,150,0.14)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, view.w, view.h);
    const vig = ctx.createRadialGradient(view.w / 2, view.h / 2, view.h * 0.35, view.w / 2, view.h / 2, view.h * 0.95);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(10,16,26,0.42)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, view.w, view.h);
  }

  return {
    draw(state, screen, meta) {
      const p = state.player;
      const pos = p.inCar ?? p;
      const follow = 1 - Math.pow(0.002, 1 / 60);
      camera.x += (pos.x - camera.x) * follow;
      camera.y += (pos.y - camera.y) * follow;
      const targetZoom = meta?.zoomTarget ?? (p.inCar ? 0.88 : 1);
      camera.zoom += (targetZoom - camera.zoom) * 0.12;
      camera.x = Math.max(200, Math.min(CITY.size - 200, camera.x));
      camera.y = Math.max(200, Math.min(CITY.size - 200, camera.y));
      drawWorld(state);
      if (meta && meta.hud) meta.hud(ctx, view, state, screen, meta);
    },
    camera,
    resize,
  };
}
