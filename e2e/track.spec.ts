import { expect, test } from '@playwright/test';
import { awaitResult, startCompress } from './helpers';

// Analytics events must fire for the usage funnel, but must never carry file
// data. Stub window.umami and block the real script so the stub captures calls.
test('compressor fires usage events that contain no file data', async ({ page }) => {
  await page.route('**/{cloud,gateway}.umami.is/**', (r) => r.abort());
  await page.addInitScript(() => {
    (window as unknown as { __events: unknown[] }).__events = [];
    (window as unknown as { umami: { track: (e: string, d?: unknown) => void } }).umami = {
      track: (e, d) =>
        (window as unknown as { __events: unknown[] }).__events.push({ e, d }),
    };
  });

  await page.goto('/compress-video/');
  await startCompress(page, 'e2e-10s.mp4', 8);
  await awaitResult(page);

  const events = await page.evaluate(
    () => (window as unknown as { __events: { e: string; d?: Record<string, unknown> }[] }).__events,
  );
  const names = events.map((x) => x.e);
  expect(names).toContain('compressor_file_selected');
  expect(names).toContain('compressor_started');
  expect(names).toContain('compressor_completed');

  // The full payload must not leak the filename or any file metadata.
  const dump = JSON.stringify(events).toLowerCase();
  expect(dump).not.toContain('e2e-10s'); // the input filename
  expect(dump).not.toMatch(/filename|"name"|"size"|bytes|width|height|duration/);
});
