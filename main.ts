// news-image-20261125 — "THE WORLD IN ONE DAY"
// Renders Wednesday 25 November 2026 in one 1024x1024 PNG, drawn from scratch
// with Node 22 standard library only: no network, no fonts, no external files.
// Deterministic: same input bytes every run (fixed palette, fixed layout, no
// Date/random). Writes /output/entry.png (or $MAKEFUN_OUTPUT_DIR/entry.png).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

// ---------------------------------------------------------------- palette ---
const PAPER = [247, 243, 234];
const INK = [17, 17, 17];
const RED = [179, 39, 30];
const BLUE = [29, 78, 137];
const TEAL = [14, 110, 110];
const GOLD = [176, 124, 20];
const GREY = [110, 108, 100];
const LIGHT = [232, 226, 210];
const WHITE = [255, 255, 255];
const GREEN = [34, 110, 60];
const SEA = [96, 150, 180];
const SAND = [214, 196, 150];
const DARKBLUE = [24, 48, 84];

// ------------------------------------------------------------------ canvas --
const W = 1024;
const H = 1024;
const buf = new Uint8Array(W * H * 3);
for (let i = 0; i < W * H; i++) {
  buf[i * 3] = PAPER[0]; buf[i * 3 + 1] = PAPER[1]; buf[i * 3 + 2] = PAPER[2];
}
function px(x: number, y: number, c: number[]): void {
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const o = (y * W + x) * 3;
  buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2];
}
function rect(x: number, y: number, w: number, h: number, c: number[]): void {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) px(i, j, c);
}
function hline(x: number, y: number, w: number, c: number[]): void { rect(x, y, w, 1, c); }
function vline(x: number, y: number, h: number, c: number[]): void { rect(x, y, 1, h, c); }
function box(x: number, y: number, w: number, h: number, c: number[]): void {
  hline(x, y, w, c); hline(x, y + h - 1, w, c); vline(x, y, h, c); vline(x + w - 1, y, h, c);
}
function line(x0: number, y0: number, x1: number, y1: number, c: number[]): void {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy, x = x0, y = y0;
  for (;;) { px(x, y, c); if (x === x1 && y === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x += sx; } if (e2 <= dx) { e += dx; y += sy; } }
}
function disc(cx: number, cy: number, r: number, c: number[]): void {
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
    if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) px(x, y, c);
  }
}
function ring(cx: number, cy: number, r: number, c: number[]): void {
  for (let a = 0; a < 360; a += 2) {
    const t = (a * Math.PI) / 180;
    px(Math.round(cx + r * Math.cos(t)), Math.round(cy + r * Math.sin(t)), c);
  }
}
// scanline fill of a simple polygon given as [x,y,...] pairs
function poly(pts: number[], c: number[]): void {
  let minY = 1e9, maxY = -1e9;
  for (let i = 1; i < pts.length; i += 2) { if (pts[i] < minY) minY = pts[i]; if (pts[i] > maxY) maxY = pts[i]; }
  for (let y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i += 2) {
      const x1 = pts[i], y1 = pts[i + 1];
      const x2 = pts[(i + 2) % pts.length], y2 = pts[(i + 3) % pts.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k]); x <= xs[k + 1]; x++) px(x, y, c);
  }
}

// ------------------------------------------------------------- 5x7 font ----
// Each glyph: 7 rows of 5 bits, '#' = on. Uppercase + digits + punctuation.
const FONT: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '.##..', '..#..', '.#...'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  ';': ['.....', '.##..', '.##..', '.....', '.##..', '..#..', '.#...'],
  '-': ['.....', '.....', '.....', '.###.', '.....', '.....', '.....'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  '(': ['...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'],
  ')': ['.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'],
  "'": ['..#..', '..#..', '.#...', '.....', '.....', '.....', '.....'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  '%': ['##..#', '##.#.', '...#.', '..#..', '.#...', '#.##.', '#..##'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
  '[': ['.###.', '.#...', '.#...', '.#...', '.#...', '.#...', '.###.'],
  ']': ['.###.', '...#.', '...#.', '...#.', '...#.', '...#.', '.###.'],
  '*': ['.....', '#.#.#', '.###.', '#####', '.###.', '#.#.#', '.....'],
  '#': ['.#.#.', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.#.#.'],
  '$': ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
  '"': ['.#.#.', '.#.#.', '.....', '.....', '.....', '.....', '.....'],
  '<': ['...#.', '..#..', '.#...', '#....', '.#...', '..#..', '...#.'],
  '>': ['.#...', '..#..', '...#.', '....#', '...#.', '..#..', '.#...'],
  _: ['.....', '.....', '.....', '.....', '.....', '.....', '#####'],
  '@': ['.###.', '#...#', '#.###', '#.#.#', '#.##.', '#....', '.###.'],
};
function text(str: string, x: number, y: number, s: number, c: number[]): number {
  let cx = x;
  for (const ch of str.toUpperCase()) {
    const g = FONT[ch] ?? FONT['?'];
    for (let r = 0; r < 7; r++) for (let col = 0; col < 5; col++) {
      if (g[r][col] === '#') rect(cx + col * s, y + r * s, s, s, c);
    }
    cx += 6 * s;
  }
  return cx;
}
function tw(str: string, s: number): number { return str.length * 6 * s - s; }
function textC(str: string, cx: number, y: number, s: number, c: number[]): void {
  text(str, cx - Math.floor(tw(str, s) / 2), y, s, c);
}
function wrap(str: string, maxChars: number): string[] {
  const words = str.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + (cur ? ' ' : '') + w).length > maxChars) { if (cur) lines.push(cur); cur = w; }
    else cur = cur ? cur + ' ' + w : w;
  }
  if (cur) lines.push(cur);
  return lines;
}
function para(str: string, x: number, y: number, maxChars: number, lh: number, s: number, c: number[]): number {
  const lines = wrap(str, maxChars);
  for (let i = 0; i < lines.length; i++) text(lines[i], x, y + i * lh, s, c);
  return y + lines.length * lh;
}

// ------------------------------------------------------------ PNG encoder ---
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(b: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}
function encodePNG(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) { raw[y * (1 + W * 3)] = 0; Buffer.from(buf.buffer, y * W * 3, W * 3).copy(raw, y * (1 + W * 3) + 1); }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------ data ----
// 50 stories, all happened or first reported Wed 25 Nov 2026. Sources named
// per story. Big 1-4 carry a CLAIM / CONFIRMED / REPORTED tag.
interface Story { n: number; head: string; body: string; src: string; tag: string; lon: number; lat: number; }
const BIG: Story[] = [
  { n: 1, head: 'TWO TANKERS HIT MINES IN HORMUZ', body: 'IRGC NAVY SAYS TWO OIL TANKERS STRUCK NAVAL MINES AND CAUGHT FIRE IN THE STRAIT, AND WARNS SHIPS TO COORDINATE PASSAGE OR RISK MORE MINES.', src: 'ARAB NEWS / REUTERS', tag: 'CLAIM', lon: 56, lat: 26 },
  { n: 2, head: 'PAKISTAN\'S FIRST ASTRONAUT IN ORBIT', body: 'SHENZHOU-24 LIFTS OFF FROM JIUQUAN AT 00:18 UTC WITH ZEESHAN ALI ABOARD, THE FIRST FOREIGN ASTRONAUT TO VISIT CHINA\'S TIANGONG STATION.', src: 'REUTERS / THE HINDU', tag: 'CONFIRMED', lon: 100, lat: 40 },
  { n: 3, head: 'HOUTHIS CLAIM STRIKES ON SAUDI OIL HEARTLAND', body: 'HOUTHIS SAY THEY HIT THE RAS TANURA REFINERY AND RIYADH\'S FINANCIAL DISTRICT. THE COALITION SAYS IT SHOT DOWN FOUR DRONES OVER RAS TANURA.', src: 'REUTERS', tag: 'CLAIM', lon: 47, lat: 25 },
  { n: 4, head: 'NASDAQ FUTURES SLIDE 2% ON TARIFF FEARS', body: 'REPORTS OF NEW US TARIFFS ON 16 TRADING PARTNERS HIT CHIP STOCKS: NVIDIA DOWN 4.9% BEFORE THE OPEN AS THE AI SELL-OFF SPREADS IN ASIA.', src: 'REUTERS', tag: 'CONFIRMED', lon: -74, lat: 41 },
];
const MID: Story[] = [
  { n: 5, head: 'AUSTRALIA PASSES DIGITAL DUTY OF CARE', body: 'ONLINE SERVICES MUST PROTECT USERS FROM SERIOUS HARM.', src: 'TSN', tag: 'CONFIRMED', lon: 149, lat: -35 },
  { n: 6, head: 'GAZA STRIKE KILLS FAMILY OF FOUR', body: 'STRIKE ON A HOME IN AL-SHATI CAMP KILLS A FAMILY OF FOUR.', src: 'YENI SAFAK / ANADOLU', tag: 'CONFIRMED', lon: 34, lat: 31 },
  { n: 7, head: 'AUSTRALIA-SOLOMON ISLANDS TREATY SIGNED', body: 'CANBERRA IS THE SOLOMONS\' PRIMARY SECURITY PARTNER.', src: 'REUTERS / PM.GOV.AU', tag: 'CONFIRMED', lon: 149, lat: -35 },
  { n: 8, head: 'IRAN RATIONS ELECTRICITY AS US BLOCKADE BITES', body: 'US SANCTIONS AND A NAVAL BLOCKADE FORCE POWER RATIONING.', src: 'AL JAZEERA', tag: 'REPORTED', lon: 51, lat: 36 },
  { n: 9, head: 'IRAN TIGHTENS CONTROL OVER HORMUZ STRAIT', body: 'IRAN\'S ARMY SAYS IT IS TIGHTENING CONTROL.', src: 'TASS', tag: 'CLAIM', lon: 56, lat: 27 },
  { n: 10, head: 'KOSPI PLUNGES 6.16% AS CHIP STOCKS CRASH', body: 'KOSPI CLOSES 6.16% LOWER AS CHIP STOCKS REVERSE.', src: 'UPSTOX', tag: 'CONFIRMED', lon: 127, lat: 38 },
  { n: 11, head: 'SHANGHAI SINKS 2% TO LOWEST SINCE JULY 2025', body: 'SHANGHAI DROPS 2% TO LOWEST CLOSE SINCE JULY 2025.', src: 'RTHK', tag: 'CONFIRMED', lon: 121, lat: 31 },
  { n: 12, head: 'IRAN DRONE STRIKES HIT KURDISH CAMPS IN ERBIL', body: 'DRONE STRIKES HIT KURDISH CAMPS IN ERBIL; NO CASUALTIES.', src: 'RUDAW', tag: 'REPORTED', lon: 44, lat: 36 },
  { n: 13, head: 'ISRAELI MINISTERS MOVE TO BLOCK KAN PROBE', body: 'MINISTERS DEMAND KAN HALT A PROBE; IDF OPENS INQUIRY.', src: 'PARTICLE.NEWS', tag: 'REPORTED', lon: 35, lat: 32 },
  { n: 14, head: 'HOSTAGES FREED IN COLOMBIA SUPERMARKET', body: 'POLICE STORM A CARTAGENA SUPERMARKET; ONE CAPTOR KILLED.', src: 'SCMP', tag: 'CONFIRMED', lon: -75, lat: 10 },
  { n: 15, head: 'HONG KONG MARKS YEAR SINCE TAI PO FIRE KILLED 168', body: 'RESIDENTS MARK A YEAR SINCE THE FIRE KILLED 168 PEOPLE.', src: 'REUTERS', tag: 'CONFIRMED', lon: 114, lat: 22 },
  { n: 16, head: 'FRANCE REPORTS MULTIBILLION TRAINING FRAUD', body: 'FRANCE REPORTS MULTIBILLION FRAUD IN TRAINING PAYMENTS.', src: 'THE NEW REGION', tag: 'REPORTED', lon: 2, lat: 49 },
];
const LIST: [number, string, string][] = [
  [17, 'MERZ: EUROPE WILL SHOW RUSSIA ITS LIMITS', 'YENI SAFAK'],
  [18, 'HANG SENG SLIPS 1.14% ON WEDNESDAY', 'UPSTOX'],
  [19, 'GAZA STORM THREATENS 1.76M PALESTINIANS IN TENTS', 'ANADOLU'],
  [20, 'SAUDI COALITION INTERCEPTS 4 DRONES OVER RAS TANURA', 'YENI SAFAK'],
  [21, 'SOFTBANK FALLS 10% AS ASIAN TECH TUMBLES', 'SEDAILY'],
  [22, 'KURDISH TAUGHT IN 50 SCHOOLS IN SOUTHERN IRAQ', 'RUDAW'],
  [23, 'IRAQ DEFENDS ORDERS TO TAKE OVER KURDISTAN OIL', 'RUDAW'],
  [24, 'IRAQ TOP COURT AFFIRMS POWERS OVER KURDISTAN OIL', 'SHAFAQ'],
  [25, 'RESCUE UNDER WAY FOR DOZENS IN INDONESIA MINE', 'ONETURN'],
  [26, 'KRG CABINET DEMANDS FULL CONSTITUTION APPLIED', 'THE NEW REGION'],
  [27, 'KURDISH LEADERS CLOSE RANKS AGAINST BAGHDAD', '964'],
  [28, 'IRAN SAYS IT CAN WITHSTAND US BLOCKADE', 'AL MONITOR'],
  [29, 'IRAN NOT CONCERNED ABOUT US NAVAL BLOCKADE', 'MIDDLE EAST EYE'],
  [30, 'US WARNS OF IRANIAN, HOUTHI THREATS IN REGION', 'SHAFAQ'],
  [31, 'OIL PRICES SINK AHEAD OF OPEC+ MEETING', 'SHAFAQ'],
  [32, 'OIL DOWN OVER 20% IN NOVEMBER; BRENT $87.49', 'ONETURN'],
  [33, 'BASRAH CRUDES PLUNGE AMID BENCHMARK LOSSES', 'SHAFAQ'],
  [34, 'SINGAPORE, AUSTRALIA SIGN CARBON CAPTURE DEAL', 'TSN'],
  [35, 'NIKKEI DOWN 2.78% AS AI SELL-OFF SPREADS IN ASIA', 'ONETURN'],
  [36, 'PM APOLOGISES TO LGBTQ+ VETERANS', 'GUARDIAN'],
  [37, 'IOWA BRACES FOR BLAST OF LEAD EXPLOSIVES STOCKPILE', 'REUTERS'],
  [38, 'JORDAN SENTENCES MAN TO DEATH OVER OFFICER KILLING', 'REUTERS'],
  [39, 'BULGARIA STOPS FIRST MIGRANT BOAT IN MONTHS', 'REUTERS'],
  [40, 'SAHEL INSURGENTS WAGE DRONE WAR WITH CHEAP DRONES', 'REUTERS'],
  [41, 'NSW SCALES UP FIRE ANT RESPONSE AFTER SYDNEY FIND', 'GUARDIAN'],
  [42, 'UKRAINE HITS RUSSIAN REFINERIES IN SAMARA REGION', 'ONETURN'],
  [43, 'MET POLICE STILL INSTITUTIONALLY RACIST, REPORT FINDS', 'SCMP'],
  [44, 'TWO HELD AFTER BREAK-IN AT PRINCE WILLIAM\'S HOME', 'SCMP'],
  [45, '81 MEPS URGE EU PROBE OF META NUDIFIER ADS', 'MLEX'],
  [46, 'EX-POLICE OFFICER GUILTY OF SYDNEY DOUBLE MURDER', 'ONETURN'],
  [47, 'CANADIAN ASTRONAUT\'S WIFE GIVES BIRTH IN ORBIT', 'ONETURN'],
  [48, 'GERMANY TO DOUBLE DEFENCE SPENDING TO 200BN', 'REUTERS'],
  [49, 'LIBERMAN: NETANYAHU, KATZ MAY BE USING SPY AGENCIES', 'YENI SAFAK'],
  [50, 'HOUTHIS THREATEN JEDDAH PORT IF HODEIDAH ATTACKED', 'STRIKEMAP'],
];
const TIMELINE: [string, string][] = [
  ['00:18', 'SHENZHOU-24 LIFTS OFF FROM JIUQUAN'],
  ['~01:00', 'GAZA STRIKE KILLS FAMILY OF FOUR'],
  ['~02:00', 'AUSTRALIA-SOLOMON ISLANDS TREATY SIGNED'],
  ['06:30', 'HOSTAGES FREED IN CARTAGENA'],
  ['07:55', 'IRGC: TWO TANKERS HIT MINES IN HORMUZ'],
  ['~08:00', 'HOUTHIS CLAIM STRIKES ON RAS TANURA, RIYADH'],
  ['09:32', 'NASDAQ FUTURES SLIDE 2% ON TARIFF FEARS'],
];

// -------------------------------------------------------------- scene art ---
// Each big story gets a drawn scene of the place/event, not a generic icon.
function sceneHormuz(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [168, 205, 222]);
  rect(x, y + Math.floor(h * 0.62), w, h - Math.floor(h * 0.62), [38, 90, 130]); // sea
  poly([x, y + 22, x + 30, y + 8, x + 62, y + 26, x + 40, y + 44, x + 12, y + 40], SAND); // shore
  poly([x + w - 70, y + 14, x + w - 20, y + 6, x + w - 4, y + 30, x + w - 44, y + 46, x + w - 78, y + 34], SAND);
  // tanker 1, listing, on fire
  const ty = y + Math.floor(h * 0.68);
  rect(x + 14, ty - 12, 66, 12, [120, 30, 26]); rect(x + 30, ty - 22, 18, 10, [200, 200, 200]);
  poly([x + 52, ty - 34, x + 58, ty - 22, x + 46, ty - 22], [240, 140, 20]);
  poly([x + 62, ty - 30, x + 68, ty - 22, x + 56, ty - 22], [240, 90, 10]);
  disc(x + 92, ty + 4, 3, INK); disc(x + 92, ty + 4, 1, WHITE); // mine
  disc(x + 108, ty - 6, 3, INK); disc(x + 108, ty - 6, 1, WHITE);
  // tanker 2
  rect(x + w - 92, ty - 10, 60, 10, [60, 60, 70]); rect(x + w - 76, ty - 18, 14, 8, [200, 200, 200]);
  text('HORMUZ', x + 6, y + 4, 1, DARKBLUE);
}
function sceneRocket(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [16, 24, 48]);
  for (const [sx, sy] of [[8, 8], [30, 20], [w - 14, 10], [w - 34, 26], [14, 34], [w - 8, 40]] as const) disc(x + sx, y + sy, 1, WHITE);
  disc(x + w - 26, y + 18, 9, [220, 220, 200]); // moon
  const cx = x + Math.floor(w / 2);
  poly([cx - 7, y + h - 18, cx - 7, y + 22, cx, y + 10, cx + 7, y + 22, cx + 7, y + h - 18], WHITE); // rocket
  poly([cx - 12, y + h - 30, cx - 7, y + h - 44, cx - 7, y + h - 18], RED);
  poly([cx + 12, y + h - 30, cx + 7, y + h - 44, cx + 7, y + h - 18], RED);
  poly([cx - 4, y + h - 18, cx, y + h - 4, cx + 4, y + h - 18], [240, 140, 20]); // flame
  rect(x, y + h - 6, w, 6, [90, 70, 50]);
  text('JIUQUAN', x + 6, y + 4, 1, WHITE);
}
function sceneRiyadh(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [232, 214, 170]);
  disc(x + w - 18, y + 14, 8, [240, 200, 90]); // sun
  // PIF tower
  rect(x + 18, y + 18, 26, h - 24, [40, 60, 90]);
  for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) rect(x + 22 + c * 7, y + 24 + r * 10, 4, 5, [180, 210, 230]);
  poly([x + 18, y + 18, x + 31, y + 6, x + 44, y + 18], [40, 60, 90]);
  poly([x + 30, y + 6, x + 34, y + 2, x + 28, y + 2], [240, 90, 10]); // impact flash
  // refinery tanks
  disc(x + w - 46, y + h - 16, 14, [150, 150, 150]); disc(x + w - 46, y + h - 24, 14, [190, 190, 190]);
  rect(x + w - 60, y + h - 26, 28, 20, [120, 120, 120]);
  poly([x + w - 40, y + h - 40, x + w - 34, y + h - 28, x + w - 46, y + h - 28], [240, 140, 20]);
  // drone
  rect(x + 58, y + 12, 10, 3, INK); line(x + 56, y + 10, x + 70, y + 10, INK);
  text('RIYADH', x + 58, y + 26, 1, INK);
}
function sceneMarket(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [238, 238, 232]);
  // falling chart
  const pts: [number, number][] = [[6, 18], [22, 26], [38, 22], [54, 40], [70, 48], [86, 44], [102, 62], [118, 70]];
  for (let i = 0; i + 1 < pts.length; i++) line(x + pts[i][0], y + pts[i][1], x + pts[i + 1][0], y + pts[i + 1][1], RED);
  for (const [bx, by] of pts) disc(x + bx, y + by, 2, RED);
  text('-2.2%', x + 6, y + 4, 1, RED);
  text('NASDAQ', x + w - 52, y + 4, 1, INK);
}
// small pictogram for a mid story, drawn in a 44x44 tile
function icon(kind: string, x: number, y: number): void {
  rect(x, y, 44, 44, LIGHT); box(x, y, 44, 44, GREY);
  switch (kind) {
    case 'gavel': rect(x + 12, y + 12, 20, 6, INK); rect(x + 20, y + 18, 4, 14, INK); rect(x + 12, y + 32, 20, 4, INK); break;
    case 'flag': vline(x + 12, y + 10, 26, INK); poly([x + 12, y + 10, x + 34, y + 10, x + 12, y + 22], RED); break;
    case 'treaty': rect(x + 12, y + 10, 20, 26, WHITE); box(x + 12, y + 10, 20, 26, INK); line(x + 16, y + 18, x + 28, y + 18, INK); line(x + 16, y + 24, x + 28, y + 24, INK); disc(x + 28, y + 30, 3, RED); break;
    case 'blast': disc(x + 22, y + 22, 12, [240, 140, 20]); for (let a = 0; a < 8; a++) { const t = (a * Math.PI) / 4; line(x + 22, y + 22, x + 22 + Math.round(17 * Math.cos(t)), y + 22 + Math.round(17 * Math.sin(t)), [240, 140, 20]); } break;
    case 'target': ring(x + 22, y + 22, 12, RED); ring(x + 22, y + 22, 6, RED); disc(x + 22, y + 22, 2, RED); break;
    case 'medal': disc(x + 22, y + 26, 10, GOLD); disc(x + 22, y + 26, 5, [240, 210, 120]); line(x + 16, y + 12, x + 22, y + 18, RED); line(x + 28, y + 12, x + 22, y + 18, BLUE); break;
    case 'lock': rect(x + 13, y + 20, 18, 14, INK); ring(x + 22, y + 18, 6, INK); break;
    case 'shield': poly([x + 22, y + 8, x + 34, y + 13, x + 34, y + 26, x + 22, y + 36, x + 10, y + 26, x + 10, y + 13], BLUE); text('!', x + 20, y + 16, 1, WHITE); break;
    case 'boat': poly([x + 8, y + 26, x + 36, y + 26, x + 30, y + 34, x + 14, y + 34], INK); line(x + 22, y + 10, x + 22, y + 26, INK); poly([x + 22, y + 10, x + 32, y + 24, x + 22, y + 24], WHITE); break;
    case 'court': rect(x + 10, y + 12, 24, 4, INK); rect(x + 12, y + 20, 4, 14, INK); rect(x + 28, y + 20, 4, 14, INK); rect(x + 10, y + 34, 24, 3, INK); break;
    case 'health': rect(x + 20, y + 10, 4, 24, RED); rect(x + 12, y + 18, 20, 4, RED); break;
    case 'globe': disc(x + 22, y + 22, 13, SEA); poly([x + 14, y + 14, x + 20, y + 12, x + 24, y + 18, x + 18, y + 22], [90, 170, 90]); poly([x + 26, y + 26, x + 32, y + 24, x + 32, y + 32, x + 24, y + 32], [90, 170, 90]); break;
    default: disc(x + 22, y + 22, 10, TEAL);
  }
}
const ICONS = ['lock', 'blast', 'treaty', 'blast', 'flag', 'globe', 'globe', 'target', 'court', 'shield', 'flag', 'gavel'];

// ---------------------------------------------------------------- layout ---
function tagChip(txt: string, x: number, y: number): number {
  const c = txt === 'CLAIM' ? RED : txt === 'CONFIRMED' ? GREEN : GOLD;
  const w = tw(txt, 1) + 8;
  rect(x, y, w, 11, c);
  text(txt, x + 4, y + 2, 1, WHITE);
  return x + w;
}
function srcChip(txt: string, x: number, y: number): void {
  text('- ' + txt, x, y, 1, GREY);
}

// header
rect(0, 0, W, 64, DARKBLUE);
text('THE WORLD IN ONE DAY', 16, 12, 3, WHITE);
text('WEDNESDAY 25 NOVEMBER 2026', 16, 42, 1, [200, 210, 230]);
text('50 STORIES', 1024 - 16 - tw('50 STORIES', 2), 10, 2, [255, 210, 90]);
text('7 REGIONS - 9 FIELDS', 1024 - 16 - tw('7 REGIONS - 9 FIELDS', 1), 40, 1, [200, 210, 230]);
hline(0, 64, W, INK); hline(0, 66, W, RED);
text('50 STORIES  .  7 REGIONS  .  9 FIELDS  .  EVERY ONE FROM WEDNESDAY 25 NOVEMBER 2026', 16, 72, 1, INK);

// timeline
text('THE DAY IN UTC', 16, 92, 1, RED);
{
  const tw0 = 16, tw1 = 146;
  let x = tw0;
  const colW = 144;
  for (let i = 0; i < TIMELINE.length; i++) {
    const [t, ev] = TIMELINE[i];
    text(t, x, 104, 1, BLUE);
    hline(x, 116, 120, BLUE);
    disc(x + 4, 116, 3, RED);
    const lines = wrap(ev, 21);
    for (let j = 0; j < lines.length && j < 2; j++) text(lines[j], x, 122 + j * 9, 1, INK);
    x += colW;
  }
  void tw1;
}

// big stories: 2x2 grid
const scenes = [sceneHormuz, sceneRocket, sceneRiyadh, sceneMarket];
for (let i = 0; i < 4; i++) {
  const s = BIG[i];
  const cx = 8 + (i % 2) * 506;
  const cy = 146 + Math.floor(i / 2) * 88;
  box(cx, cy, 502, 84, INK);
  rect(cx + 1, cy + 1, 500, 82, WHITE);
  scenes[i](cx + 4, cy + 4, 128, 76);
  // number badge
  rect(cx + 136, cy + 5, 16, 16, RED);
  text(String(s.n), cx + 136 + (s.n < 10 ? 5 : 2), cy + 9, 1, WHITE);
  tagChip(s.tag, cx + 156, cy + 6);
  const hl = wrap(s.head, 34);
  for (let j = 0; j < hl.length && j < 2; j++) text(hl[j], cx + 136, cy + 24 + j * 10, 1, INK);
  const bl = wrap(s.body, 56);
  for (let j = 0; j < bl.length && j < 3; j++) text(bl[j], cx + 136, cy + 46 + j * 9, 1, [60, 60, 60]);
  srcChip(s.src, cx + 136, cy + 74);
}

// mid stories 5-16: 4 cols x 3 rows
for (let i = 0; i < 12; i++) {
  const s = MID[i];
  const cx = 8 + (i % 4) * 254;
  const cy = 326 + Math.floor(i / 4) * 60;
  box(cx, cy, 250, 56, GREY);
  rect(cx + 1, cy + 1, 248, 54, WHITE);
  icon(ICONS[i], cx + 4, cy + 6);
  text(String(s.n), cx + 52, cy + 4, 1, RED);
  tagChip(s.tag, cx + 52 + 14, cy + 3);
  const hl = wrap(s.head, 30);
  for (let j = 0; j < hl.length && j < 2; j++) text(hl[j], cx + 52, cy + 15 + j * 9, 1, INK);
  const bl = wrap(s.body, 32);
  for (let j = 0; j < bl.length && j < 2; j++) text(bl[j], cx + 52, cy + 33 + j * 8, 1, [60, 60, 60]);
  srcChip(s.src, cx + 52, cy + 49);
}

// ------------------------------------------------------------- world map ---
const MAP = { x: 8, y: 516, w: 1008, h: 148 };
function lonLat(lon: number, lat: number): [number, number] {
  return [MAP.x + ((lon + 170) / 360) * MAP.w, MAP.y + ((78 - lat) / 136) * MAP.h];
}
text('WHERE IT HAPPENED', 16, 504, 1, RED);
{
  const my = 516;
  rect(8, my, 1008, 148, [214, 231, 238]);
  box(8, my, 1008, 148, INK);
  const conts: number[][] = [
    [-168, 66, -140, 70, -120, 72, -95, 80, -80, 73, -60, 60, -55, 47, -70, 42, -75, 35, -80, 26, -90, 21, -97, 16, -105, 20, -115, 28, -125, 40, -125, 49, -150, 60],
    [-55, 60, -45, 60, -30, 68, -20, 70, -35, 76, -55, 74],
    [-80, 10, -70, 12, -60, 8, -50, 0, -40, -5, -35, -10, -40, -20, -48, -28, -58, -35, -65, -40, -70, -50, -70, -55, -75, -40, -80, -20, -80, -5],
    [-17, 15, -10, 30, 0, 35, 10, 37, 20, 32, 30, 31, 35, 28, 43, 12, 51, 11, 48, 0, 40, -10, 35, -20, 30, -30, 20, -35, 15, -30, 12, -18, 9, -2, 9, 4, -8, 5],
    [-10, 36, -9, 43, -2, 48, 0, 50, 5, 53, 8, 57, 10, 59, 18, 56, 21, 55, 24, 58, 28, 60, 30, 70, 40, 68, 45, 60, 40, 55, 35, 50, 30, 45, 28, 41, 23, 40, 19, 42, 12, 44, 8, 44, 3, 43, -2, 37],
    [30, 70, 40, 68, 60, 69, 80, 73, 100, 77, 120, 73, 140, 72, 160, 70, 178, 66, 170, 60, 162, 56, 158, 52, 142, 50, 140, 40, 135, 35, 127, 33, 122, 30, 120, 25, 110, 20, 105, 10, 100, 8, 98, 15, 95, 20, 90, 22, 85, 20, 80, 15, 75, 10, 72, 20, 68, 25, 60, 25, 55, 26, 50, 28, 48, 30, 43, 35, 35, 36, 30, 36, 30, 45, 35, 50, 40, 55, 40, 60],
    [113, -22, 114, -30, 115, -35, 120, -34, 125, -32, 130, -32, 135, -35, 140, -38, 145, -38, 150, -37, 153, -32, 153, -27, 150, -22, 146, -19, 142, -15, 142, -11, 137, -12, 135, -15, 132, -12, 130, -13, 126, -14, 122, -17, 118, -20],
  ];
  for (const c of conts) {
    const pts: number[] = [];
    for (let i = 0; i < c.length; i += 2) { const [pxx, pyy] = lonLat(c[i], c[i + 1]); pts.push(pxx, pyy); }
    poly(pts, [150, 185, 140]);
  }
  // graticule
  for (let lon = -150; lon <= 150; lon += 30) { const [gx] = lonLat(lon, 78); vline(Math.round(gx), my, 148, [190, 210, 218]); }
  const all = [...BIG, ...MID];
  const offsets: Record<number, [number, number]> = { 5: [16, -12], 9: [16, -12], 13: [12, 10] };
  for (const s of all) {
    const [pxx, pyy] = lonLat(s.lon, s.lat);
    const off = offsets[s.n] ?? [0, 0];
    const x = Math.round(pxx) + off[0], y = Math.round(pyy) + off[1];
    disc(x, y, 8, RED);
    ring(x, y, 8, WHITE);
    text(String(s.n), x - (s.n < 10 ? 3 : 6), y - 3, 1, WHITE);
  }
  text('PINS 1-16 MATCH THE STORIES ABOVE', 16, my + 148 - 12, 1, INK);
}

// ------------------------------------------------------- list 17-50 --------
text('THE REST OF THE DAY - 17 TO 50', 16, 668, 1, RED);
hline(16, 680, 992, INK);
for (let i = 0; i < LIST.length; i++) {
  const [n, head, src] = LIST[i];
  const col = i < 17 ? 0 : 1;
  const row = i % 17;
  const x = 16 + col * 504;
  const y = 686 + row * 10;
  text(String(n) + '.', x, y, 1, RED);
  const maxChars = 50;
  const h = head.length > maxChars ? head.slice(0, maxChars - 1) : head;
  text(h, x + 24, y, 1, INK);
  text(src, x + 400, y, 1, GREY);
}

// ------------------------------------------------------------ date check ---
const DC_Y = 858;
rect(8, DC_Y, 1008, 110, [255, 250, 235]);
box(8, DC_Y, 1008, 110, RED);
text('DATE CHECK - WHAT WE LEFT OUT, AND WHY', 16, DC_Y + 6, 1, RED);
const LEFT: string[] = [
  'HUANG REINSTATED - MON 24 NOV',
  'NASDAQ +7% HUANG - MON 24 NOV',
  'THREE TANKERS - TUE 24 NOV',
  'RIYADH PIF TOWER - TUE 24 NOV',
  'CORVETTE SUNK - SUN 23 NOV',
  'CAF STRIPS SENEGAL - MAR 2026',
  'CHEN JINING PROBE - 24 NOV',
  'NBC IRAN STRIKE PLAN - 24 NOV',
  'EL-SAYED MEET - 24 NOV',
  'GIULIANI MEDAL - 24 NOV',
  'CAS SENEGAL TITLE - 24 NOV',
  'CIA SYSTEM BREACH - 24 NOV',
  'CANARY MIGRANTS - 24 NOV',
  'JIAN ZHAO PLEA - 23 NOV',
  'LANDMINE MONITOR - 24 NOV',
  'DEMOCRATS 259 SEATS - 24 NOV',
  'SPAIN SNAP ELECTION - 05 OCT',
  'ZAMBIA TREASON - 23 NOV',
  'KHARTOUM STRIKES - 22 NOV',
  'CONGO PLANE DOWN - 22 NOV',
  'IRAN FLOGS SINGER - 23 NOV',
  'ABREGO GARCIA - 24 NOV',
  'PENTAGON CANADA MEMO - 23 NOV',
  'COBALT EXPORT BAN - 23 NOV',
  'VENEZUELA DEBT - 24 NOV',
  'ARGENTINA RECESSION - 24 NOV',
  'STROKE PROJECTION - 23 NOV',
  'ROSSTAT WAR DEATHS - 23 NOV',
  'PELICOT PUBLISHER - 23 NOV',
  'MARKLE CHARGED - 24 NOV',
  'HUANG IN THERAPY - 24 NOV',
  'POTANIN DIVORCE - 24 NOV',
  'GAZA MENINGITIS - 24 NOV',
  '3 DEAD 15 HURT - UNSOURCED',
];
const NOTYET: string[] = [
  'US PCE DATA - 13:30 UTC TODAY',
  'IOWA BLAST RESULT - 15:00 UTC',
  'THANKSGIVING - THU 27 NOV',
  'FED RATE DECISION - DEC 2026',
  'HUANG TO CONGRESS - NEXT WK',
];
text('BEFORE 25 NOV - EXCLUDED:', 16, DC_Y + 18, 1, INK);
for (let i = 0; i < LEFT.length; i++) {
  const col = i % 5;
  const row = Math.floor(i / 5);
  text('X ' + LEFT[i], 16 + col * 200, DC_Y + 30 + row * 8, 1, [90, 60, 60]);
}
text('NOT YET - EXCLUDED:', 16, DC_Y + 92, 1, INK);
for (let i = 0; i < NOTYET.length; i++) text('O ' + NOTYET[i], 16 + i * 200, DC_Y + 100, 1, [60, 60, 90]);

// ------------------------------------------------------------------ footer -
hline(0, 972, W, INK);
para('EVERY STORY ABOVE HAPPENED OR WAS FIRST REPORTED ON WEDNESDAY 25 NOVEMBER 2026.', 16, 980, 120, 10, 1, INK);
para('SOURCES: REUTERS - ANADOLU - AL JAZEERA - TASS - RTHK - RUDAW - SCMP - YENI SAFAK - ONETURN - GUARDIAN - TSN - SHAFAQ - MLEX - AL MONITOR', 16, 992, 160, 10, 1, GREY);
text('50 STORIES - ONE DAY - 25 NOVEMBER 2026', 16, 1006, 1, RED);

// -------------------------------------------------------------------- run --
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'entry.png'), encodePNG());
