const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const moduleCache = new Map();
function loadTs(filename) {
  const resolved = path.resolve(filename);
  if (moduleCache.has(resolved)) return moduleCache.get(resolved).exports;
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename,
  }).outputText;
  const module = { exports: {} };
  moduleCache.set(resolved, module);
  const localRequire = (specifier) => {
    if (!specifier.startsWith('.')) return require(specifier);
    if (specifier === './viewport') return { readViewportMetrics: () => { throw new Error('Browser viewport must not be read in Node contract QA'); } };
    const candidate = path.resolve(path.dirname(resolved), specifier);
    return loadTs(path.extname(candidate) ? candidate : `${candidate}.ts`);
  };
  new Function('exports', 'require', 'module', '__filename', '__dirname', output)(module.exports, localRequire, module, resolved, path.dirname(resolved));
  return module.exports;
}

const { createMission7SceneLayout, createMission8SceneLayout, createResponsiveLayout, createStartSceneLayout, createTransitionSceneLayout } = loadTs(path.join(__dirname, '..', 'src', 'game', 'ui', 'responsiveLayout.ts'));

const matrix = [
  ['360x600', 360, 600, 'PHONE_PORTRAIT_SHORT'], ['360x640', 360, 640, 'PHONE_PORTRAIT_SHORT'],
  ['390x650', 390, 650, 'PHONE_PORTRAIT_SHORT'], ['390x700', 390, 700, 'PHONE_PORTRAIT'],
  ['390x844', 390, 844, 'PHONE_PORTRAIT_TALL'], ['393x852', 393, 852, 'PHONE_PORTRAIT_TALL'],
  ['412x915', 412, 915, 'PHONE_PORTRAIT_TALL'], ['430x932', 430, 932, 'PHONE_PORTRAIT_TALL'],
  ['740x360', 740, 360, 'PHONE_LANDSCAPE_SHORT'], ['844x390', 844, 390, 'PHONE_LANDSCAPE_SHORT'],
  ['932x430', 932, 430, 'PHONE_LANDSCAPE_SHORT'], ['768x1024', 768, 1024, 'TABLET_PORTRAIT'],
  ['1024x768', 1024, 768, 'TABLET_LANDSCAPE'], ['1280x720', 1280, 720, 'DESKTOP'],
  ['1438x914', 1438, 914, 'DESKTOP'],
  ['390x844-ios-safe', 390, 844, 'PHONE_PORTRAIT', { top: 47, right: 0, bottom: 34, left: 0 }],
  ['844x390-ios-safe', 844, 390, 'PHONE_LANDSCAPE_SHORT', { top: 0, right: 47, bottom: 21, left: 47 }],
];

const reports = matrix.map(([name, width, height, expected, insets]) => {
  const viewport = insets ? {
    innerWidth: width, innerHeight: height, visualViewportWidth: width, visualViewportHeight: height,
    visualViewportOffsetLeft: 0, visualViewportOffsetTop: 0,
    safeTop: insets.top, safeRight: insets.right, safeBottom: insets.bottom, safeLeft: insets.left,
    orientation: height >= width ? 'portrait' : 'landscape', aspectRatio: width / height, devicePixelRatio: 3,
  } : undefined;
  const layout = createResponsiveLayout(width, height, viewport);
  const mission7 = createMission7SceneLayout(layout);
  const mission8 = createMission8SceneLayout(layout);
  const start = createStartSceneLayout(layout);
  const transition = createTransitionSceneLayout(layout);
  assert.equal(layout.semanticMode, expected, `${name} semantic mode`);
  assert(layout.headerZone.y >= layout.safeRect.y, `${name} header starts inside safe rect`);
  assert(layout.headerZone.y + layout.headerZone.height <= layout.gameplayZone.y, `${name} header/gameplay separation`);
  assert(layout.gameplayZone.y + layout.gameplayZone.height <= layout.controlsZone.y, `${name} gameplay/control separation`);
  assert(layout.controlsZone.y + layout.controlsZone.height <= layout.safeRect.y + layout.safeRect.height, `${name} controls inside safe rect`);
  assert(layout.modalZone.x >= layout.safeRect.x && layout.modalZone.y >= layout.safeRect.y, `${name} modal origin inside safe rect`);
  assert(layout.modalZone.x + layout.modalZone.width <= layout.safeRect.x + layout.safeRect.width, `${name} modal width inside safe rect`);
  assert(layout.modalZone.y + layout.modalZone.height <= layout.safeRect.y + layout.safeRect.height, `${name} modal height inside safe rect`);
  assert(layout.iconHeight >= 52, `${name} header controls retain touch height`);
  assert(start.playY + start.playHeight / 2 <= height - layout.safe.bottom + 0.01, `${name} Start play button is safe`);
  assert(start.platformY + layout.gapS <= start.playY - start.playHeight / 2 + 0.01, `${name} Start robot clears play button`);
  assert(start.subtitleY + start.subtitleFontSize * 1.2 <= start.platformY - start.robotHeight + 0.01, `${name} Start subtitle clears hero`);
  assert(layout.taskCard.x >= layout.safe.left - 0.01 && layout.taskCard.y >= layout.safe.top - 0.01, `${name} shared mission card starts safe`);
  assert(layout.taskCard.x + layout.taskCard.width <= width - layout.safe.right + 0.01, `${name} shared mission card width is safe`);
  assert(layout.taskCard.y + layout.taskCard.height <= height - layout.safe.bottom + 0.01, `${name} shared mission card height is safe`);
  assert(layout.progress.x >= layout.safe.left - 0.01 && layout.progress.y >= layout.safe.top - 0.01, `${name} progress panel starts safe`);
  assert(layout.progress.x + layout.progress.width <= width - layout.safe.right + 0.01, `${name} progress panel width is safe`);
  assert(layout.progress.y + layout.progress.height <= height - layout.safe.bottom + 0.01, `${name} progress panel height is safe`);
  const sharedCardOverlap = layout.taskCard.x < layout.progress.x + layout.progress.width && layout.taskCard.x + layout.taskCard.width > layout.progress.x
    && layout.taskCard.y < layout.progress.y + layout.progress.height && layout.taskCard.y + layout.taskCard.height > layout.progress.y;
  assert.equal(sharedCardOverlap, false, `${name} shared mission card/progress separation`);
  if (expected.startsWith('PHONE_PORTRAIT')) {
    assert(start.titleY - start.titleFontSize * 0.56 >= layout.headerY + layout.iconHeight / 2 + layout.gapS - 0.01, `${name} Start title clears sound control`);
    const ribbonOverhang = Math.min(21, Math.max(17, height * 0.025));
    assert(layout.taskCard.y - ribbonOverhang >= layout.headerZone.y + layout.headerZone.height + layout.gapS - 0.01, `${name} shared mission ribbon clears two-row header`);
    assert(layout.statusY > layout.headerY + layout.iconHeight / 2, `${name} status occupies row 2`);
    assert.equal(mission7.showHelper, true, `${name} Mission 7 preserves the helper character`);
    assert.equal(mission7.showRepaired, false, `${name} Mission 7 omits tiny repaired robot`);
  }
  assert(mission7.board.width > 0 && mission7.board.height > 0, `${name} Mission 7 board is positive`);
  assert(mission7.hint.width >= 128 && mission7.hint.height >= 48, `${name} Mission 7 hint is finger-sized`);
  const mission7SystemsHeight = expected.startsWith('PHONE_PORTRAIT') || expected === 'TABLET_PORTRAIT' ? 38 : 52;
  assert(mission7.systems.y + mission7SystemsHeight / 2 + layout.gapXS <= mission7.board.y - 17 + 0.01, `${name} Mission 7 status/ribbon separation`);
  assert(mission8.board.width > 0 && mission8.board.height > 0, `${name} Mission 8 board is positive`);
  assert(mission8.board.x >= layout.safe.left - 0.01 && mission8.board.y >= layout.safe.top - 0.01, `${name} Mission 8 board starts in content safe rect`);
  assert(mission8.board.x + mission8.board.width <= width - layout.safe.right + 0.01, `${name} Mission 8 board width is safe`);
  assert(mission8.board.y + mission8.board.height <= height - layout.safe.bottom + 0.01, `${name} Mission 8 board height is safe`);
  assert(mission8.arrowSize >= 48 && mission8.actionHeight >= 48, `${name} Mission 8 controls are finger-sized`);
  assert(mission8.actionsY + mission8.actionHeight / 2 <= height - layout.safe.bottom + 0.01, `${name} Mission 8 actions stay above safe bottom`);
  const stripHeight = expected === 'PHONE_PORTRAIT_SHORT' ? 52 : 60;
  assert(mission8.stripY + stripHeight / 2 + 25 <= mission8.arrowsY - mission8.arrowSize / 2 + 0.01, `${name} Mission 8 strip/feedback/arrow separation`);
  assert(mission8.arrowsY + mission8.arrowSize / 2 + layout.gapXS <= mission8.actionsY - mission8.actionHeight / 2 + 0.01, `${name} Mission 8 arrow/action separation`);
  if (expected.startsWith('PHONE_PORTRAIT')) assert(mission8.board.y + mission8.board.height <= layout.controlsZone.y, `${name} Mission 8 board/control vertical separation`);
  if (expected === 'PHONE_LANDSCAPE_SHORT') {
    assert(layout.taskCard.width >= 300, `${name} short-landscape task card is child-sized`);
    assert(layout.taskCardSizing.actionHeight >= 52, `${name} short-landscape actions are visibly substantial`);
    assert.equal(layout.taskCardSizing.internalProgressPlacement, 'ribbon', `${name} internal progress leaves the answer/status rows clear`);
    const controlLeft = mission8.controlCenterX - mission8.controlWidth / 2;
    assert(mission8.board.x + mission8.board.width + layout.gapS <= controlLeft, `${name} Mission 8 board/control horizontal separation`);
  }
  assert(transition.buttonY + transition.buttonHeight / 2 <= height - layout.safe.bottom + 0.01, `${name} transition button is safe`);
  assert(transition.actorFeetY + layout.gapM <= transition.buttonY - transition.buttonHeight / 2 + 0.01, `${name} transition actors clear button`);
  if (expected.startsWith('PHONE_PORTRAIT')) {
    assert(transition.titleY - transition.titleSize / 2 >= layout.headerZone.y + layout.headerZone.height, `${name} transition title clears header`);
    assert(transition.pairScale >= 0.15, `${name} transition robots retain readable scale`);
    assert(1400 * transition.pairScale >= 150, `${name} transition robots remain at least 150 px tall`);
  }
  return {
    name, width, height, insets: insets ?? { top: 0, right: 0, bottom: 0, left: 0 }, semanticMode: layout.semanticMode,
    safeRect: layout.safeRect, headerZone: layout.headerZone, gameplayZone: layout.gameplayZone,
    controlsZone: layout.controlsZone, modalZone: layout.modalZone,
    mission7: { board: mission7.board, hint: mission7.hint, helperVisible: mission7.showHelper, repairedVisible: mission7.showRepaired },
    mission8,
    transition,
    start,
  };
});

const output = { matrix: reports, failures: [] };
fs.mkdirSync(path.join('docs', 'qa'), { recursive: true });
fs.writeFileSync(path.join('docs', 'qa', 'stage8-3e-layout-contract.json'), `${JSON.stringify(output, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ cases: reports.length, failures: output.failures }, null, 2)}\n`);
