const { chromium } = require('../apps/web/node_modules/@playwright/test');
const assert = require('node:assert/strict');
const base = (process.env.ROOM_TEST_URL || 'http://127.0.0.1:4321').replace(/\/$/, '');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const errors = [];
  try {
    const contexts = await Promise.all(
      [0, 1, 2, 3].map(() =>
        browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } }),
      ),
    );
    const pages = [];
    for (const context of contexts) {
      await context.addInitScript(() => {
        window.RTCPeerConnection = class {
          constructor() {
            throw new Error('WebRTC must not be used');
          }
        };
        window.WebSocket = class {
          constructor() {
            throw new Error('WebSocket must not be used');
          }
        };
      });
      const p = await context.newPage();
      p.on('pageerror', (e) => errors.push(e.message));
      pages.push(p);
    }
    const [host, ...guests] = pages;
    await host.goto(`${base}/daifugo/create/`);
    const code = await host.locator('h1').innerText({ timeout: 20000 });
    console.log('created', code);
    for (const guest of guests) {
      await guest.goto(`${base}/join/?code=${code}`);
      await guest.getByRole('heading', { name: code, exact: true }).waitFor({ timeout: 20000 });
    }
    console.log('four players joined with WebRTC and WebSocket disabled');
    await host.getByRole('button', { name: 'ローカルルールを変更する' }).click();
    await host
      .getByRole('switch', { name: '数縛り（3→4なら次は5。マーク縛りと併用可）', exact: true })
      .click();
    for (const guest of guests) {
      await guest.getByText('この部屋のローカルルールを確認', { exact: true }).click();
      await guest.waitForFunction(
        () =>
          document
            .querySelector('[role=switch][aria-label*="数縛り"]')
            ?.getAttribute('aria-checked') === 'true',
      );
    }
    console.log('rule changes synchronized');
    await host.getByTestId('start-match').click();
    try {
      for (const p of pages)
        await p.waitForFunction(
          () =>
            typeof window.render_game_to_text === 'function' &&
            JSON.parse(window.render_game_to_text()).status === 'ready',
          null,
          { timeout: 20000 },
        );
    } catch (e) {
      for (const p of pages)
        console.log(
          await p.evaluate(() => ({
            text: document.body.innerText,
            surface: window.render_game_to_text?.(),
          })),
        );
      console.log(errors);
      throw e;
    }
    console.log(
      'match started',
      await host.evaluate(() => JSON.parse(window.render_game_to_text()).activeSeat),
    );
    for (let turn = 0; turn < 6; turn++) {
      const states = await Promise.all(
        pages.map((p) => p.evaluate(() => JSON.parse(window.render_game_to_text()))),
      );
      const actor = states[0].activeSeat;
      const index = states.findIndex((s) => s.localSeat === actor);
      console.log(
        'turn',
        turn,
        states.map((s) => ({
          status: s.status,
          local: s.localSeat,
          active: s.activeSeat,
          error: s.error,
        })),
      );
      assert.ok(index >= 0);
      const page = pages[index];
      const hint = page.getByRole('button', { name: /出せる組を見る|次の出せる組/ });
      if ((await hint.count()) && (await hint.isEnabled())) {
        await hint.click();
        await page.getByRole('button', { name: /^出す/ }).click();
      } else {
        await page.getByRole('button', { name: 'パス', exact: true }).click();
      }
      await page.waitForFunction(
        (before) => {
          const s = JSON.parse(window.render_game_to_text());
          return (
            s.activeSeat !== null &&
            (s.activeSeat !== before.activeSeat || s.hand.length !== before.hand.length)
          );
        },
        states[index],
        { timeout: 20000 },
      );
      await host.waitForFunction(
        () => JSON.parse(window.render_game_to_text()).activeSeat !== null,
      );
      const active = await host.evaluate(() => JSON.parse(window.render_game_to_text()).activeSeat);
      for (const p of pages)
        await p.waitForFunction(
          (expected) => JSON.parse(window.render_game_to_text()).activeSeat === expected,
          active,
        );
    }
    console.log('six turns synchronized', errors);
    const before = await guests[0].evaluate(() => JSON.parse(window.render_game_to_text()));
    await contexts[1].setOffline(true);
    await new Promise((r) => setTimeout(r, 3000));
    await contexts[1].setOffline(false);
    await guests[0].waitForFunction(
      () => JSON.parse(window.render_game_to_text()).status === 'ready',
    );
    await new Promise((r) => setTimeout(r, 3000));
    assert.deepEqual(
      await guests[0].evaluate(() => JSON.parse(window.render_game_to_text()).hand),
      before.hand,
    );
    console.log('temporary offline preserves hand');
    await guests[0].reload();
    await guests[0].waitForFunction(
      () =>
        typeof window.render_game_to_text === 'function' &&
        JSON.parse(window.render_game_to_text()).status === 'ready',
      null,
      { timeout: 45000 },
    );
    assert.deepEqual(
      await guests[0].evaluate(() => JSON.parse(window.render_game_to_text()).hand),
      before.hand,
    );
    console.log('reload restores same seat and hand');
    if (process.env.ROOM_TEST_SCREENSHOT)
      await host.screenshot({ path: process.env.ROOM_TEST_SCREENSHOT });
    await contexts[0].close();
    await new Promise((r) => setTimeout(r, 24000));
    const after = await Promise.all(
      guests.map((p) => p.evaluate(() => JSON.parse(window.render_game_to_text()))),
    );
    console.log(
      'host departure',
      after.map((s) => ({ status: s.status, active: s.activeSeat, error: s.error })),
    );
    assert.ok(after.every((s) => s.status === 'ready' && !s.error));
    console.log('host departure keeps remaining clients ready');
    await guests[0].waitForFunction(
      () => {
        const s = JSON.parse(window.render_game_to_text());
        return s.activeSeat !== null && s.activeSeat !== 0;
      },
      null,
      { timeout: 20000 },
    );
    const leader = await guests[0].evaluate(
      () => JSON.parse(window.render_game_to_text()).activeSeat,
    );
    const mover = guests.find((p, i) => after[i].localSeat === leader);
    const original = await mover.evaluate(() => JSON.parse(window.render_game_to_text()));
    const nextHint = mover.getByRole('button', { name: /出せる組を見る|次の出せる組/ });
    if ((await nextHint.count()) && (await nextHint.isEnabled())) {
      await nextHint.click();
      await mover.getByRole('button', { name: /^出す/ }).click();
    } else await mover.getByRole('button', { name: 'パス', exact: true }).click();
    await mover.waitForFunction(
      (before) => {
        const s = JSON.parse(window.render_game_to_text());
        return (
          s.activeSeat !== null &&
          (s.activeSeat !== before.activeSeat || s.hand.length !== before.hand.length)
        );
      },
      original,
      { timeout: 20000 },
    );
    const current = await mover.evaluate(() => JSON.parse(window.render_game_to_text()).activeSeat);
    for (const p of guests)
      await p.waitForFunction(
        (seat) => JSON.parse(window.render_game_to_text()).activeSeat === seat,
        current,
      );
    console.log('a move after host migration synchronized');
    assert.equal(errors.length, 0);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
