import { expect, test } from '@playwright/test';
import { awaitResult, startCompress } from './helpers';

/**
 * The product promise: zero file bytes ever leave the device. Enforced here
 * as a failing test, not a checklist item — any request to a non-same-origin
 * host, or any request carrying a body, fails the suite.
 */
for (const file of ['e2e-10s.mp4', 'e2e-4s.avi']) {
  test(`no request leaves the origin during a ${file} compress (incl. engine load)`, async ({
    page,
    baseURL,
  }) => {
    if (file.endsWith('.avi')) test.slow(); // wasm encode path
    const offenders: string[] = [];
    page.on('request', (req) => {
      const url = new URL(req.url());
      const sameOrigin = `${url.protocol}//${url.host}` === baseURL;
      const local = url.protocol === 'blob:' || url.protocol === 'data:';
      if (!sameOrigin && !local) {
        offenders.push(`${req.method()} ${req.url()}`);
      }
      if (req.postData() !== null && req.postData() !== '') {
        offenders.push(`REQUEST BODY on ${req.method()} ${req.url()}`);
      }
    });

    await page.goto('/compress-video/');
    await startCompress(page, file, file.endsWith('.avi') ? 2 : 8);
    const out = await awaitResult(page, 600_000);
    expect(out.outBytes).toBeGreaterThan(0);
    expect(offenders, 'requests that violate the privacy promise').toEqual([]);
  });
}

test('no cookies or storage that would need an EU consent banner', async ({
  page,
  context,
}) => {
  await page.goto('/compress-video/');
  await startCompress(page, 'e2e-10s.mp4', 8);
  await awaitResult(page);
  expect(await context.cookies()).toEqual([]);
  const storage = await page.evaluate(() => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
  }));
  expect(storage.local).toEqual([]);
  expect(storage.session).toEqual([]);
});
