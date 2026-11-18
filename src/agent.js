import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import config from './config.js';

// ---------- utilidades ----------
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LOGIN_MODE = args.includes('--login');
const minutesArg = args.find((a) => a.startsWith('--minutes='));

const rand = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const pickRange = ([a, b]) => rand(a, b);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pause = (secMin, secMax) => sleep(rand(secMin, secMax) * 1000);

fs.mkdirSync('logs', { recursive: true });
const logFile = path.join('logs', `session-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`);
function log(event, data = {}) {
  const entry = { t: new Date().toISOString(), event, ...data };
  fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
  const extra = Object.keys(data).length ? ' ' + JSON.stringify(data) : '';
  console.log(`[${entry.t.slice(11, 19)}] ${event}${extra}`);
}

// Contador diário de curtidas (persistido em state.json)
const STATE_FILE = 'state.json';
function loadState() {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (s.date === today) return s;
  } catch {}
  return { date: today, likes: 0 };
}
function saveState(s) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2));
}

const stats = { reelsWatched: 0, postsSeen: 0, likes: 0 };
let state = loadState();

// ---------- interação "humana" ----------
async function humanMove(page, x, y) {
  await page.mouse.move(x + rand(-4, 4), y + rand(-4, 4), { steps: randInt(12, 30) });
}

async function humanScroll(page, totalPx) {
  let done = 0;
  while (done < totalPx) {
    const step = Math.min(totalPx - done, randInt(60, 160));
    await page.mouse.wheel(0, step);
    done += step;
    await sleep(rand(15, 60));
  }
}

async function dismissPopups(page) {
  const labels = ['Agora não', 'Not Now', 'Not now'];
  for (const label of labels) {
    const btn = page.getByRole('button', { name: label, exact: true });
    if (await btn.first().isVisible().catch(() => false)) {
      await pause(0.8, 2);
      await btn.first().click().catch(() => {});
      log('popup_dismissed', { label });
    }
  }
}

// Encontra o botão de curtir (não curtido) mais próximo do centro da tela.
async function findVisibleLikeButton(page) {
  return page.evaluate(() => {
    const svgs = [...document.querySelectorAll('svg[aria-label="Curtir"], svg[aria-label="Like"]')];
    const vh = window.innerHeight;
    let best = null;
    for (const svg of svgs) {
      const r = svg.getBoundingClientRect();
      // ignora corações pequenos (curtir comentários) e itens fora da tela
      if (r.width < 20 || r.top < 60 || r.bottom > vh - 20) continue;
      const dist = Math.abs(r.top + r.height / 2 - vh / 2);
      if (!best || dist < best.dist) {
        best = { x: r.left + r.width / 2, y: r.top + r.height / 2, dist };
      }
    }
    return best;
  });
}

async function maybeLike(page, context) {
  if (Math.random() > config.likeProbability) return;
  if (stats.likes >= config.maxLikesPerSession) return;
  if (state.likes >= config.maxLikesPerDay) return;

  const target = await findVisibleLikeButton(page);
  if (!target) return;

  await pause(0.6, 2.2); // "decidindo"
  await humanMove(page, target.x, target.y);
  await pause(0.15, 0.5);

  if (DRY_RUN) {
    log('like_skipped_dry_run', { context });
    return;
  }
  await page.mouse.click(target.x, target.y, { delay: randInt(40, 120) });
  stats.likes++;
  state.likes++;
  saveState(state);
  log('liked', { context, sessionLikes: stats.likes, dayLikes: state.likes });
  await pause(0.5, 1.5);
}

// ---------- atividades ----------
async function browseReels(page, untilMs) {
  log('activity_start', { activity: 'reels' });
  await page.goto('https://www.instagram.com/reels/', { waitUntil: 'domcontentloaded' });
  await pause(3, 5);
  await dismissPopups(page);

  // posiciona o mouse sobre o vídeo
  const vp = page.viewportSize();
  await humanMove(page, vp.width / 2, vp.height / 2);

  while (Date.now() < untilMs) {
    const full = Math.random() < config.reelFullWatchChance;
    const watch = pickRange(full ? config.reelFullWatchSeconds : config.reelWatchSeconds);
    log('reel_watching', { seconds: Math.round(watch) });

    // curtir pode acontecer no meio do vídeo
    const likeAt = rand(0.3, 0.8) * watch;
    await sleep(likeAt * 1000);
    await maybeLike(page, 'reel');
    await sleep((watch - likeAt) * 1000);
    stats.reelsWatched++;

    // ocasionalmente volta um reel (como gente faz)
    if (Math.random() < 0.05) {
      await page.keyboard.press('ArrowUp');
      log('reel_back');
      await pause(3, 8);
    }
    await page.keyboard.press('ArrowDown');
    await pause(0.8, 2);
  }
}

async function browseFeed(page, untilMs) {
  log('activity_start', { activity: 'feed' });
  await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' });
  await pause(3, 5);
  await dismissPopups(page);

  const vp = page.viewportSize();
  await humanMove(page, vp.width / 2, vp.height / 2);

  while (Date.now() < untilMs) {
    await humanScroll(page, randInt(350, 900));
    await pause(...config.feedDwellSeconds);
    stats.postsSeen++;
    await maybeLike(page, 'feed');

    // às vezes rola um pouco pra cima
    if (Math.random() < 0.08) {
      await page.mouse.wheel(0, -randInt(150, 400));
      await pause(1, 3);
    }
    // pausa mais longa ocasional ("distraído")
    if (Math.random() < 0.06) {
      log('idle_pause');
      await pause(8, 20);
    }
  }
}

// ---------- main ----------
async function main() {
  const context = await chromium.launchPersistentContext(config.userDataDir, {
    headless: LOGIN_MODE ? false : config.headless,
    locale: config.locale,
    viewport: config.viewport,
    executablePath: process.env.CHROME_PATH || undefined,
  });
  const page = context.pages()[0] ?? (await context.newPage());

  const shutdown = async (reason) => {
    log('session_end', { reason, ...stats });
    await context.close().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('interrompido (Ctrl+C)'));

  if (LOGIN_MODE) {
    await page.goto('https://www.instagram.com/accounts/login/');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    await rl.question('\nFaça login no navegador que abriu (incluindo 2FA). Depois aperte ENTER aqui...');
    rl.close();
    console.log('Sessão salva em', config.userDataDir);
    await context.close();
    return;
  }

  await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded' });
  await pause(3, 5);
  if (page.url().includes('/accounts/login') || (await page.locator('input[name="password"]').count()) > 0) {
    console.error('Não está logado. Rode primeiro: npm run login');
    await context.close();
    process.exit(1);
  }

  const minutes = minutesArg ? Number(minutesArg.split('=')[1]) : pickRange(config.sessionMinutes);
  const sessionEnd = Date.now() + minutes * 60_000;
  log('session_start', { minutes: Math.round(minutes), dryRun: DRY_RUN, dayLikesSoFar: state.likes });

  while (Date.now() < sessionEnd) {
    const blockEnd = Math.min(sessionEnd, Date.now() + pickRange(config.blockMinutes) * 60_000);
    const activity = Math.random() < config.activities.reels ? 'reels' : 'feed';
    try {
      if (activity === 'reels') await browseReels(page, blockEnd);
      else await browseFeed(page, blockEnd);
    } catch (err) {
      log('error', { activity, message: err.message });
      await pause(3, 6);
    }
  }

  await shutdown('tempo da sessão concluído');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
