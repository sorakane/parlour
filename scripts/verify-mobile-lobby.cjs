const { chromium } = require('../apps/web/node_modules/@playwright/test');
const assert = require('node:assert/strict');
const forceRelay = process.env.ROOM_TEST_FORCE_RELAY === '1';
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
      await context.addInitScript((forceRelay) => {
        const Native = window.RTCPeerConnection;
        window.__testConnections = [];
        window.RTCPeerConnection = class extends Native {
          constructor(config) {
            super(forceRelay ? { ...config, iceTransportPolicy: 'relay' } : config);
            window.__testConnections.push(this);
          }
        };
      }, forceRelay);
      const p = await context.newPage();
      p.on('request', (request) => {
        if (request.url().includes('chatgpt.site') || request.url().includes('/api/room-relay'))
          errors.push('Unexpected Sites request');
      });
      p.on('pageerror', (e) => errors.push(e.message));
      pages.push(p);
    }
    const [host, ...guests] = pages;
    await host.goto(`${base}/daifugo/create/`);
    await host.waitForTimeout(2500);
    await host.getByRole('textbox', { name: 'あなたの名前', exact: true }).fill('主催者');

    await host.getByRole('button', { name: '4人の部屋を作る', exact: true }).click();
    const heading = host.getByRole('heading', {
      name: /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/,
      exact: true,
    });
    await heading.waitFor({ timeout: 45000 });
    const code = await heading.innerText();
    console.log('created', code);
    for (const guest of guests) {
      if (guest === guests[1]) {
        const cdp = await contexts[0].newCDPSession(host);
        await cdp.send('Page.setWebLifecycleState', { state: 'frozen' });
        console.log('host frozen while second guest joins');
        setTimeout(async () => {
          await cdp.send('Page.setWebLifecycleState', { state: 'active' });
          await host.evaluate(() => window.dispatchEvent(new Event('pageshow')));
          console.log('host resumed after 15 seconds');
        }, 15000);
      }
      await guest.goto(`${base}/join/?code=${code}`);
      await guest.waitForTimeout(2000);
      await guest
        .getByRole('textbox', { name: 'あなたの名前', exact: true })
        .fill('友だち' + (guests.indexOf(guest) + 1));
      await guest.locator('input[maxlength="4"]').fill(code);
      await guest.waitForTimeout(1500);
      const submit = guest.getByTestId('join-submit');
      if ((await submit.count()) && (await submit.isEnabled())) await submit.click();
      try {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await guest
              .getByRole('heading', { name: code, exact: true })
              .waitFor({ timeout: 45000 });
            break;
          } catch (error) {
            if (attempt === 2) throw error;
            console.log('retry joining', attempt + 1);
            await guest.reload();
            await guest.waitForTimeout(2500);
            await guest
              .getByRole('textbox', { name: 'あなたの名前', exact: true })
              .fill('友だち' + (guests.indexOf(guest) + 1));
            await guest.locator('input[maxlength="4"]').fill(code);
            await guest.getByTestId('join-submit').click({ timeout: 20000 });
          }
        }
      } catch (e) {
        console.log(
          'url/input/pcs',
          guest.url(),
          await guest.locator('input[maxlength="4"]').inputValue(),
          await guest.evaluate(() =>
            window.__testConnections.map((p) => ({
              state: p.connectionState,
              ice: p.iceConnectionState,
            })),
          ),
        );
        console.log('join screen', await guest.locator('body').innerText());
        console.log('host screen', await host.locator('body').innerText());
        console.log(errors);
        throw e;
      }
    }
    assert.ok((await host.locator('body').innerText()).includes('友だち3'));

    for (const page of pages) await page.getByText('主催者', { exact: true }).waitFor();
    console.log('four named players joined over WebRTC after host suspension');
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
    for (const p of pages) {
      const types = await p.evaluate(async () => {
        const results = [];
        for (const pc of window.__testConnections) {
          const stats = await pc.getStats();
          for (const item of stats.values())
            if (item.type === 'candidate-pair' && item.state === 'succeeded' && item.nominated)
              results.push(stats.get(item.localCandidateId)?.candidateType);
        }
        return results;
      });
      assert.ok(types.length > 0);
      if (forceRelay) assert.ok(types.every((t) => t === 'relay'));
      console.log('selected WebRTC paths', types);
    }
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
    assert.equal(errors.length, 0);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
