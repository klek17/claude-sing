'use strict';
/*
 * SingCoach end-to-end smoke test.
 *
 * Launches headless Chromium with a FAKE microphone (Chromium's
 * --use-fake-device-for-media-stream feeds a synthetic audio signal), loads
 * the app from a local server, and drives every tab: lessons, tuner with the
 * mic on, an exercise run, the recording studio, and progress.
 *
 * Usage: node tests/e2e/run.js
 */

const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright-core');

const PORT = 8931;
const BASE = `http://localhost:${PORT}`;
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium';

let passed = 0;
const failures = [];

function check(name, cond, detail) {
  if (cond) {
    passed++;
    console.log(`  ok  ${name}`);
  } else {
    failures.push(name + (detail ? ` — ${detail}` : ''));
    console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`);
  }
}

function waitForServer(url, tries = 30) {
  return new Promise((resolve, reject) => {
    const attempt = n => {
      http.get(url, res => { res.resume(); resolve(); })
        .on('error', () => n > 0 ? setTimeout(() => attempt(n - 1), 200) : reject(new Error('server never came up')));
    };
    attempt(tries);
  });
}

async function main() {
  const server = spawn(process.execPath, [path.join(__dirname, '..', '..', 'tools', 'serve.js'), String(PORT)], {
    stdio: 'ignore'
  });

  let browser;
  try {
    await waitForServer(BASE + '/index.html');
    console.log('server up, launching Chromium…');

    browser = await chromium.launch({
      executablePath: CHROME,
      headless: true,
      args: [
        '--use-fake-ui-for-media-stream',     // auto-grant mic permission
        '--use-fake-device-for-media-stream', // synthetic mic signal
        '--autoplay-policy=no-user-gesture-required',
        '--no-sandbox'
      ]
    });
    const context = await browser.newContext({ permissions: ['microphone'] });
    const page = await context.newPage();

    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', e => pageErrors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });

    /* ---- load & learn tab ---- */
    await page.goto(BASE, { waitUntil: 'load' });
    check('page loads with correct title', (await page.title()).includes('SingCoach'));
    await page.waitForSelector('#lesson-list .lesson');
    const lessonCount = await page.locator('#lesson-list .lesson').count();
    check('all 7 lessons render', lessonCount === 7, `got ${lessonCount}`);

    await page.click('#lesson-list .lesson:first-child .lesson-head');
    check('lesson expands and is marked read',
      await page.locator('#lesson-list .lesson:first-child').evaluate(n => n.classList.contains('open') && n.classList.contains('read')));

    /* ---- tab switching ---- */
    for (const tab of ['tuner', 'train', 'range', 'studio', 'progress', 'learn']) {
      await page.click(`.tab-btn[data-tab="${tab}"]`);
      const visible = await page.locator(`#view-${tab}`).evaluate(n => n.classList.contains('active'));
      check(`tab "${tab}" activates`, visible);
    }

    /* ---- microphone + tuner ---- */
    await page.click('.tab-btn[data-tab="tuner"]');
    await page.click('header .mic-toggle');
    await page.waitForFunction(() => window.__singcoach.mic.running, null, { timeout: 8000 });
    check('microphone starts', true);

    // The fake device emits a synthetic signal; confirm the analysis loop
    // produces readings and measures energy on at least some frames.
    const probe = await page.evaluate(() => new Promise(resolve => {
      const readings = [];
      const unsub = window.__singcoach.mic.onReading(r => {
        readings.push({ rms: r.rms, voiced: r.voiced });
        if (readings.length >= 120) { unsub(); resolve(readings); }
      });
      setTimeout(() => { unsub(); resolve(readings); }, 5000);
    }));
    check('pitch analysis loop produces readings', probe.length >= 30, `got ${probe.length} readings`);
    check('fake mic signal has audible energy', probe.some(r => r.rms > 0.001),
      `max rms ${Math.max(...probe.map(r => r.rms)).toFixed(5)}`);

    /* ---- exercise runner (structure smoke test) ---- */
    await page.click('.tab-btn[data-tab="train"]');
    const exCount = await page.locator('#exercise-list .exercise-card').count();
    check('exercise catalog shows 4 exercises', exCount === 4, `got ${exCount}`);
    await page.locator('#exercise-list .exercise-card button').first().click();
    await page.waitForSelector('#exercise-runner .run-stage', { timeout: 8000 });
    check('exercise runner starts', true);
    await page.waitForFunction(() => {
      const el = document.querySelector('#run-phase');
      return el && el.textContent.trim().length > 0;
    }, null, { timeout: 8000 });
    check('runner shows a phase prompt', true);
    await page.click('#run-quit');
    check('quitting returns to catalog',
      await page.locator('#exercise-list').evaluate(n => n.style.display !== 'none'));

    /* ---- recording studio ---- */
    await page.click('.tab-btn[data-tab="studio"]');
    await page.click('#rec-toggle');
    await page.waitForFunction(() => document.querySelector('#rec-toggle').classList.contains('recording'), null, { timeout: 5000 });
    check('recording starts', true);
    await page.waitForTimeout(1600);
    await page.click('#rec-toggle');
    await page.waitForSelector('#recording-list .rec-card', { timeout: 8000 });
    const recInfo = await page.locator('#recording-list .rec-card').first().evaluate(card => ({
      hasAudio: !!card.querySelector('audio'),
      hasDownload: !!card.querySelector('a[download]')
    }));
    check('recording saved with player and download link', recInfo.hasAudio && recInfo.hasDownload);

    // Recording must contain actual data
    const recSize = await page.evaluate(async () => {
      const items = await window.RecordingStore.list();
      return items.length ? items[0].blob.size : 0;
    });
    check('recording blob contains data', recSize > 1000, `size ${recSize} bytes`);

    // Persistence across reload (IndexedDB)
    await page.reload({ waitUntil: 'load' });
    await page.click('.tab-btn[data-tab="studio"]');
    await page.waitForSelector('#recording-list .rec-card', { timeout: 8000 });
    check('recording persists across reload', true);

    // Delete it
    await page.click('#recording-list .rec-card .danger');
    await page.waitForFunction(() => !document.querySelector('#recording-list .rec-card'), null, { timeout: 8000 });
    check('recording can be deleted', true);

    /* ---- progress ---- */
    await page.evaluate(() => {
      window.__singcoach.store.addSession('pitch-match', 82, 2);
      window.__singcoach.store.addSession('scale-5', 71, 2);
    });
    await page.click('.tab-btn[data-tab="progress"]');
    const progTotal = await page.locator('#prog-total').textContent();
    check('progress counts sessions', progTotal.trim() === '2', `got "${progTotal}"`);
    const streak = await page.locator('#prog-streak').textContent();
    check('streak shows 1 day after practising today', streak.trim() === '1 day', `got "${streak}"`);
    const tableRows = await page.locator('#prog-table tr').count();
    check('per-exercise table renders', tableRows === 3, `got ${tableRows} rows`); // header + 2

    /* ---- range personalisation plumbing ---- */
    await page.evaluate(() => window.__singcoach.store.setRange(50, 71));
    await page.click('.tab-btn[data-tab="range"]');
    const rangeTxt = await page.locator('#range-current').textContent();
    check('saved range is displayed', rangeTxt.includes('D3') && rangeTxt.includes('B4'), `got "${rangeTxt}"`);

    /* ---- console cleanliness ---- */
    check('no uncaught page errors', pageErrors.length === 0, pageErrors.join(' | '));
    check('no console errors', consoleErrors.length === 0, consoleErrors.join(' | '));

  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill();
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    failures.forEach(f => console.log('  ✗ ' + f));
    process.exit(1);
  }
}

main().catch(err => {
  console.error('E2E run crashed:', err);
  process.exit(1);
});
