import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Network assets are optional; exercise the offline image/font fallback too.
  await page.route(
    /https:\/\/(?:static\.encyclopedia\.warthunder\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//,
    (route) => route.abort(),
  );
});

test('selection, groups, search, details, route and export work in the static production build', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('美国');
  const first = page.locator('[data-vehicle-id="us_m2a4"]');
  await expect(first).toBeVisible();
  await first.getByRole('button', { name: '选择 M2A4', exact: true }).click();
  await expect(first.getByRole('button', { name: '选择 M2A4', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('region', { name: '研发计划' })).toContainText('1 辆');
  const group = page.getByRole('button', { name: /展开 .*载具组/ }).first();
  await group.scrollIntoViewIfNeeded();
  const treePositions = () =>
    page.locator('.tree-canvas .vehicle-card').evaluateAll((cards) =>
      cards.map((card) => ({
        id: card.getAttribute('data-vehicle-id'),
        left: (card as HTMLElement).style.left,
        top: (card as HTMLElement).style.top,
      })),
    );
  const positions = await treePositions();
  const canvasHeight = await page
    .locator('.tree-size')
    .evaluate((element) => (element as HTMLElement).style.height);
  const before = await page.locator('.vehicle-card').count();
  await group.click();
  await expect(page.locator('.group-popover')).toBeVisible();
  expect(await treePositions()).toEqual(positions);
  expect(
    await page.locator('.tree-size').evaluate((element) => (element as HTMLElement).style.height),
  ).toBe(canvasHeight);
  expect(await page.locator('.vehicle-card').count()).toBeGreaterThan(before);
  const floatingCard = page.locator('.group-popover .vehicle-select').first();
  await floatingCard.click();
  await expect(floatingCard).toHaveAttribute('aria-pressed', 'true');
  await floatingCard.click({ button: 'right' });
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await group.click();
  await expect(page.locator('.group-popover')).toBeVisible();
  await page
    .getByRole('button', { name: /折叠 .*载具组/ })
    .first()
    .click();
  expect(await page.locator('.vehicle-card').count()).toBe(before);
  await page.getByRole('button', { name: '街机 AB', exact: true }).click();
  await expect(page.getByRole('button', { name: '街机 AB', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: '中文名称' }).click();
  await page.getByRole('textbox', { name: '搜索载具', exact: true }).fill('us_m1a2_sep3_abrams');
  await expect(page.locator('.vehicle-card')).toHaveCount(1);
  await page.getByRole('button', { name: /查看 .* 详情/ }).click();
  const dialog = page.locator('dialog.vehicle-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('M1A2 SEPv3');
  await expect(page.getByRole('tab', { name: '挂载数据' })).toHaveCount(0);
  await page.getByRole('tab', { name: '辅助设备' }).click();
  await expect(dialog).toContainText('双向稳定器');
  await page.getByRole('tab', { name: '车辆性能' }).click();
  await expect(dialog).toContainText('76 km/h');
  await page.getByRole('tab', { name: '弹药数据' }).click();
  await expect(dialog).toContainText('M829A3');
  await expect(dialog).toContainText('633');
  await page.getByRole('tab', { name: '改装件' }).click();
  await expect(dialog.locator('.mod-grid button').first()).toBeVisible();
  await expect(dialog.locator('.mod-icon').first()).toBeVisible();
  await page.getByRole('tab', { name: '改装件' }).press('ArrowLeft');
  await expect(page.getByRole('tab', { name: '弹药数据' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('tab', { name: '改装件' }).click();
  const firstMod = dialog.locator('.mod-grid button').first();
  await firstMod.click();
  await expect(firstMod).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.mod-detail-popover')).toHaveCount(0);
  await expect(dialog).toContainText('已选择 1 项');
  await firstMod.click({ button: 'right' });
  await expect(page.locator('.mod-detail-popover')).toBeVisible();
  await expect(page.locator('.mod-detail-popover')).toContainText('研发点');
  await expect(page.locator('.mod-detail-popover')).toContainText('已选为目标');
  await expect(dialog).toContainText('已选择 1 项');
  await page.keyboard.press('Escape');
  await expect(page.locator('.mod-detail-popover')).not.toBeVisible();
  await expect(dialog).toBeVisible();
  await page.getByRole('button', { name: '选择最快研发路径' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.plan-panel')).toContainText('M1A2 SEPv3');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 JSON' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('wt-plan-usa-ground.json');
  await page.getByRole('button', { name: '关闭计划' }).click();
  await page.getByRole('button', { name: '清空选择', exact: true }).click();
  await expect(page.getByRole('region', { name: '研发计划' })).toContainText('0 辆');
  await page.screenshot({
    path: 'artifacts/verification/frontend-desktop.png',
    animations: 'disabled',
  });
  expect(errors).toEqual([]);
});

test('country and type switching, 13-slot loadouts, mobile layout and escape', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /苏联 USSR/ }).click();
  await page.getByRole('button', { name: '空军', exact: true }).click();
  await page.getByRole('textbox', { name: '搜索载具', exact: true }).fill('su_30sm2');
  await expect(page.locator('.vehicle-card')).toHaveCount(1);
  await page.getByRole('button', { name: /查看 .* 详情/ }).click();
  await page.getByRole('tab', { name: '挂载数据' }).click();
  await expect(page.getByRole('combobox', { name: '挂点筛选' })).toContainText('全部 13 个挂点');
  await page.getByRole('textbox', { name: '搜索挂载武器' }).fill('R-77-1 air-to-air');
  await expect(page.locator('.loadout-table tbody tr')).toHaveCount(2);
  await page.getByRole('combobox', { name: '挂点筛选' }).selectOption('2');
  await expect(page.locator('.loadout-table tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: 'R-77-1 air-to-air missiles', exact: true }).click();
  const popup = page.locator('.weapon-detail-popover');
  await expect(popup).toBeVisible();
  await expect(popup).toContainText('50 G');
  await expect(popup).toContainText('190 kg');
  await expect(page.locator('.loadout-table .weapon-icon').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(popup).not.toBeVisible();
  await expect(page.locator('dialog.vehicle-dialog')).toBeVisible();
  const slotButton = page.getByRole('button', {
    name: 'R-77-1 air-to-air missiles 挂点 2 参数',
    exact: true,
  });
  const tableHeight = await page
    .locator('.loadout-table')
    .evaluate((element) => element.scrollHeight);
  await slotButton.click();
  await expect(popup).toBeVisible();
  await expect(popup).toContainText('当前挂点');
  await expect(popup).toContainText('50 G');
  expect(await page.locator('.loadout-table').evaluate((element) => element.scrollHeight)).toBe(
    tableHeight,
  );
  await page.getByRole('button', { name: '关闭挂载详情' }).click();
  await expect(popup).not.toBeVisible();
  await slotButton.click();
  await page.getByRole('tab', { name: '挂载数据' }).click();
  await expect(popup).not.toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button', { name: '直升机', exact: true }).click();
  await expect(page.locator('.tree-title')).toContainText('15 辆载具');
  await page
    .getByRole('button', { name: /查看 .* 详情/ })
    .first()
    .click();
  await expect(page.getByRole('tab')).toHaveText(['载具资料', '辅助设备', '挂载数据', '改装件']);
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /中国/ }).click();
  await expect(page.locator('.tree-title')).toContainText('13 辆载具');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/verification/frontend-mobile.png', fullPage: true });
});

test('failed data requests expose a retry and recover', async ({ page }) => {
  let failed = false;
  await page.route('**/usa-ground.json', (route) => {
    if (!failed) {
      failed = true;
      return route.fulfill({ status: 503, body: 'Unavailable' });
    }
    return route.continue();
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('数据读取失败');
  await page.getByRole('button', { name: '重新加载' }).click();
  await expect(page.locator('[data-vehicle-id="us_m2a4"]')).toBeVisible();
});

test('quick research works without a manual selection and includes prerequisite costs', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('[data-vehicle-id="us_m2a4"]')).toBeVisible();
  await page.getByRole('button', { name: '快速研发', exact: true }).click();
  const quick = page.getByRole('region', { name: '快速研发计算' });
  await expect(quick).toBeVisible();
  await page.getByRole('textbox', { name: '搜索研发目标' }).fill('no_such_vehicle');
  await expect(page.getByRole('button', { name: '计算研发路线' })).toBeDisabled();
  await page.getByRole('textbox', { name: '搜索研发目标' }).fill('us_m3_stuart');
  await page.getByRole('combobox', { name: '目标载具' }).selectOption('us_m3_stuart');
  await page.getByRole('button', { name: '计算研发路线' }).click();
  await expect(quick).not.toBeVisible();
  const resources = page.getByRole('group', { name: '到达目标所需资源' });
  await expect(resources).toContainText('2 辆');
  await expect(resources).toContainText('2,900 RP');
  await expect(resources).toContainText('700 SL');
  await expect(page.locator('.plan-panel')).toContainText('M3 轻型坦克');
  await expect(page.locator('[data-vehicle-id="us_m2a4"] .vehicle-select')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('[data-vehicle-id="us_m3_stuart"] .vehicle-select')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: '快速研发', exact: true }).click();
  await expect(page.getByRole('combobox', { name: '目标载具' })).toHaveValue('us_m3_stuart');
  await page.keyboard.press('Escape');
  await expect(quick).not.toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '快速研发', exact: true }).click();
  await expect(quick).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: 'artifacts/verification/frontend-quick-research-mobile.png',
    fullPage: true,
  });
});

test('aircraft ground battle ratings update cards and details and reset on type changes', async ({
  page,
}) => {
  await page.goto('/');
  const trb = page.getByRole('button', { name: '历史（陆战） TRB', exact: true });
  const tsb = page.getByRole('button', { name: '全真（陆战） TSB', exact: true });
  await expect(trb).toHaveCount(0);
  await expect(tsb).toHaveCount(0);
  await page.getByRole('button', { name: '空军', exact: true }).click();
  await page.getByRole('textbox', { name: '搜索载具', exact: true }).fill('f_16c_block_50');
  const rating = page.locator('.vehicle-card .card-top b');
  await expect(rating).toHaveCount(1);
  await page.getByRole('button', { name: '历史 RB', exact: true }).click();
  await expect(rating).toHaveText('13.7');
  await trb.click();
  await expect(rating).toHaveText('12.7');
  await page.getByRole('button', { name: /查看 .* 详情/ }).click();
  const dialog = page.locator('dialog.vehicle-dialog');
  await expect(dialog.locator('.detail-heading')).toContainText('TRB 12.7');
  await expect(dialog).toContainText('历史（陆战）权重 TRB');
  await expect(dialog).toContainText('全真（陆战）权重 TSB');
  await expect(page.getByRole('tab')).toHaveText(['载具资料', '辅助设备', '挂载数据', '改装件']);
  await page.keyboard.press('Escape');
  await tsb.click();
  await expect(rating).toHaveText('12.7');
  await page.reload();
  await expect(tsb).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '直升机', exact: true }).click();
  await expect(trb).toHaveCount(0);
  await expect(tsb).toHaveCount(0);
  await expect(page.getByRole('button', { name: '全真 SB', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: '空军', exact: true }).click();
  await trb.click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: '陆军', exact: true }).click();
  await expect(trb).toHaveCount(0);
  await expect(page.getByRole('button', { name: '历史 RB', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('modification prerequisite arrows follow the real chain and resize with the grid', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: /苏联 USSR/ }).click();
  await page.getByRole('button', { name: '空军', exact: true }).click();
  await page.getByRole('textbox', { name: '搜索载具', exact: true }).fill('su_30sm2');
  await page.getByRole('button', { name: /查看 .* 详情/ }).click();
  await page.getByRole('tab', { name: '改装件' }).click();
  await expect(page.locator('.mod-connection')).toHaveCount(5);
  for (const [from, to] of [
    ['mig_29_r_27et', 'mig_29_r_73'],
    ['mig_29_r_73', 'mig_29_r_27er'],
    ['mig_29_r_27er', 'su_r_77_1'],
  ]) {
    await expect(page.locator(`.mod-connection[data-from="${from}"][data-to="${to}"]`)).toHaveCount(
      1,
    );
  }
  await expect(page.locator('.mod-connection[data-to="su_x29td_x59m"]')).toHaveCount(0);
  const alignment = () =>
    page.locator('.mod-grid').evaluate((grid) => {
      const from = grid.querySelector<HTMLButtonElement>('[data-mod-id="mig_29_r_27et"]')!;
      const to = grid.querySelector<HTMLButtonElement>('[data-mod-id="mig_29_r_73"]')!;
      const path = grid.querySelector('.mod-connection[data-to="mig_29_r_73"]')!;
      return (
        path.getAttribute('d') ===
        `M ${from.offsetLeft + from.offsetWidth / 2} ${from.offsetTop + from.offsetHeight} V ${to.offsetTop}`
      );
    });
  await expect.poll(alignment).toBe(true);
  await page.setViewportSize({ width: 900, height: 844 });
  await expect.poll(alignment).toBe(true);
  const target = page.getByRole('button', { name: '选择 R-77-1 改装件', exact: true });
  const resources = page.getByRole('region', { name: '改装件所需资源' });
  await target.click({ button: 'right' });
  const popup = page.locator('.mod-detail-popover');
  await expect(popup).toContainText('前置改装件');
  await expect(popup).toContainText('R-27ER');
  await expect(popup).toContainText('第 III 层需 3 项');
  await expect(page.locator('.mod-grid button.chosen')).toHaveCount(0);
  await expect(resources).toContainText('0 RP');
  await page.keyboard.press('Escape');
  await target.click();
  await expect(popup).not.toBeVisible();
  await expect(target).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.mod-plan-note')).toContainText('目标 1 项 · 自动补齐 7 项');
  await expect(page.locator('.mod-grid button.chosen')).toHaveCount(8);
  await expect(page.locator('.mod-tier-progress.ready')).toHaveCount(4);
  await expect(resources).toContainText('95,000 RP');
  await expect(resources).toContainText('145,000 SL');
  expect(
    await resources.evaluate(
      (summary) =>
        summary.getBoundingClientRect().top >=
        document.querySelector('.mod-grid')!.getBoundingClientRect().bottom,
    ),
  ).toBe(true);
  await target.press('Shift+F10');
  await expect(popup).toBeVisible();
  await expect(popup).toContainText('已选为目标');
  await expect(page.locator('.mod-grid button.chosen')).toHaveCount(8);
  await page.keyboard.press('Escape');
  await target.click();
  await expect(target).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.mod-grid button.chosen')).toHaveCount(0);
  await expect(page.locator('.mod-plan-note')).toHaveCount(0);
  await expect(popup).not.toBeVisible();
  await expect(resources).toContainText('0 RP');
  await expect(resources).toContainText('0 SL');
  await expect(page.locator('dialog.vehicle-dialog')).toBeVisible();
});

test('premium vehicle modifications are already unlocked and do not create research costs', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: /英国 Great Britain/ }).click();
  await page.getByRole('button', { name: '空军', exact: true }).click();
  await page.getByRole('textbox', { name: '搜索载具', exact: true }).fill('cf_188a_canada');
  await page.getByRole('button', { name: /查看 .* 详情/ }).click();
  await page.getByRole('tab', { name: '改装件' }).click();
  const cards = page.locator('.mod-grid button');
  await expect(cards).toHaveCount(18);
  await expect(page.locator('.mod-grid button.unlocked')).toHaveCount(18);
  await expect(page.locator('.mod-chosen-mark')).toHaveCount(18);
  await expect(page.locator('.mod-grid button.tier-locked')).toHaveCount(0);
  await expect(page.locator('.mod-connection')).toHaveCount(0);
  await expect(page.locator('.mod-tier-progress')).toHaveText([
    '等级 I全部已解锁',
    '等级 II全部已解锁',
    '等级 III全部已解锁',
    '等级 IV全部已解锁',
  ]);
  const resources = page.getByRole('region', { name: '改装件所需资源' });
  await expect(resources).toContainText('无需研发或购买');
  await expect(resources).toContainText('0 RP');
  await expect(resources).toContainText('0 SL');
  await cards.last().click();
  await expect(page.locator('.mod-grid button.chosen')).toHaveCount(0);
  await expect(page.locator('.mod-detail-popover')).toHaveCount(0);
  await expect(page.locator('.mod-plan-note')).toHaveCount(0);
  await cards.last().click({ button: 'right' });
  const popup = page.locator('.mod-detail-popover');
  await expect(popup).toBeVisible();
  await expect(popup).toContainText('已解锁');
  await expect(popup).toContainText('0 RP');
  await expect(popup).toContainText('0 SL');
  await expect(popup).not.toContainText('本层解锁');
  await expect(popup).not.toContainText('金鹰替代费用');
  await page.keyboard.press('Escape');
  await page.screenshot({ path: 'artifacts/verification/frontend-premium-modifications.png' });
});
