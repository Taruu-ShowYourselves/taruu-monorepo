import { test, expect, type Page } from '@playwright/test';

/**
 * The live map's pins are placed by geography, so the Gush Dan towns overlap:
 * Bat Yam and Holon land under three pixels apart on a phone. Selection used
 * to be decided by SVG paint order, which handed those taps to whichever town
 * was drawn last - so tapping Holon, Bat Yam or Lod all opened Rishon
 * LeZion's docket. These drive the real map in a real browser and assert the
 * thing a reader cares about: the town you touched is the town that opens.
 */

const MAP = 'svg[aria-label*="מפת ישראל"], svg[aria-label*="Map of Israel"]';
const SECTION = 'section:has(#israel-map-headline)';

/** Every pin's name and the exact screen point of its centre. */
async function pinCentres(page: Page) {
  return page.evaluate((mapSelector) => {
    const svg = document.querySelector(mapSelector);
    if (!svg) return [];
    return [...svg.querySelectorAll('g')].map((group) => {
      /* The hit circle is concentric with the pin; the group's own box would
         include the active town's label and sit off-centre. */
      const circle = group.querySelector('circle');
      const box = (circle ?? group).getBoundingClientRect();
      return {
        name: (group.querySelector('title')?.textContent ?? '').split(' · ')[0],
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
      };
    });
  }, MAP);
}

/** The town whose docket is open, read off the map's own selected pin. */
async function activeTown(page: Page) {
  return page.evaluate((mapSelector) => {
    const active = document
      .querySelector(mapSelector)
      ?.querySelector('g[data-active] title');
    return (active?.textContent ?? '').split(' · ')[0] || null;
  }, MAP);
}

async function openMap(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.locator(MAP).first().waitFor({ state: 'visible' });
  await page.locator(MAP).first().scrollIntoViewIfNeeded();
  /* The section reveals on intersection; the pins fade in with it. */
  await page.waitForTimeout(1200);
}

test.describe('live map pin selection', () => {
  test('every pin opens its own docket, whatever the paint order', async ({
    page,
  }) => {
    await openMap(page, '/he');
    const pins = await pinCentres(page);
    test.skip(
      pins.length < 2,
      'no live ledger behind this build - nothing pinned to the map'
    );

    const missed: string[] = [];
    for (const pin of pins) {
      await page.mouse.click(pin.x, pin.y);
      await page.waitForTimeout(150);
      const active = await activeTown(page);
      if (active !== pin.name) missed.push(`${pin.name} -> ${active}`);
    }
    expect(missed, 'pins whose tap opened another town').toEqual([]);
  });

  test('the docket names the town the pin names', async ({ page }) => {
    await openMap(page, '/he');
    const pins = await pinCentres(page);
    test.skip(pins.length < 2, 'no live ledger behind this build');

    /* The densest pair on the map, and one town on its own in the Negev. */
    const wanted = ['בת ים', 'חולון', 'ראשון לציון', 'באר שבע'];
    for (const name of wanted.filter((town) =>
      pins.some((pin) => pin.name === town)
    )) {
      const pin = pins.find((entry) => entry.name === name)!;
      await page.mouse.click(pin.x, pin.y);
      await page.waitForTimeout(150);
      await expect(
        page.locator(`${SECTION} h3`).first(),
        `docket heading after tapping ${name}`
      ).toContainText(name);
    }
  });

  test('a tap on empty map selects nothing new', async ({ page }) => {
    await openMap(page, '/he');
    const pins = await pinCentres(page);
    test.skip(pins.length < 2, 'no live ledger behind this build');

    const first = pins[0];
    await page.mouse.click(first.x, first.y);
    await page.waitForTimeout(150);
    expect(await activeTown(page)).toBe(first.name);

    /* Out at sea: inside the map's own box, far from every pin. */
    const box = (await page.locator(MAP).first().boundingBox())!;
    await page.mouse.click(box.x + 4, box.y + box.height - 4);
    await page.waitForTimeout(150);
    expect(await activeTown(page)).toBe(first.name);
  });

  test('the English edition selects the same way', async ({ page }) => {
    await openMap(page, '/en');
    const pins = await pinCentres(page);
    test.skip(pins.length < 2, 'no live ledger behind this build');

    const pin = pins[Math.min(3, pins.length - 1)];
    await page.mouse.click(pin.x, pin.y);
    await page.waitForTimeout(150);
    expect(await activeTown(page)).toBe(pin.name);
  });
});
