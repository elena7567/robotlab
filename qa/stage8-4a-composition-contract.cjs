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

const { createResponsiveLayout } = loadTs(path.join(__dirname, '..', 'src', 'game', 'ui', 'responsiveLayout.ts'));
const { SEMANTIC_REGIONS, composeScene, resolveComponentSize } = loadTs(path.join(__dirname, '..', 'src', 'game', 'ui', 'sceneCompositionDirector.ts'));

const matrix = [
  ['360x600', 360, 600],
  ['390x844', 390, 844],
  ['844x390', 844, 390],
  ['768x1024', 768, 1024],
  ['1024x768', 1024, 768],
  ['1280x720', 1280, 720],
  ['1438x914', 1438, 914],
  ['390x844-ios-safe', 390, 844, { top: 47, right: 0, bottom: 34, left: 0 }],
  ['844x390-ios-safe', 844, 390, { top: 0, right: 47, bottom: 21, left: 47 }],
];

function rectInside(inner, outer, tolerance = 1) {
  return inner.x >= outer.x - tolerance && inner.y >= outer.y - tolerance
    && inner.x + inner.width <= outer.x + outer.width + tolerance
    && inner.y + inner.height <= outer.y + outer.height + tolerance;
}

function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function viewport(width, height, insets) {
  if (!insets) return undefined;
  return {
    innerWidth: width, innerHeight: height, visualViewportWidth: width, visualViewportHeight: height,
    visualViewportOffsetLeft: 0, visualViewportOffsetTop: 0,
    safeTop: insets.top, safeRight: insets.right, safeBottom: insets.bottom, safeLeft: insets.left,
    orientation: height >= width ? 'portrait' : 'landscape', aspectRatio: width / height, devicePixelRatio: 3,
  };
}

const reports = [];
for (const [name, width, height, insets] of matrix) {
  const layout = createResponsiveLayout(width, height, viewport(width, height, insets));
  for (const missionId of [1, 2, 3, 4, 5, 6, 7, 8, 'MISSION5_TRANSITION']) {
    const composition = composeScene(layout, missionId);
    assert.equal(composition.semanticMode, layout.semanticMode, `${name} m${missionId} semantic mode follows responsive layout`);
    assert.equal(composition.policyId.length > 0, true, `${name} m${missionId} policy id is declared`);
    for (const regionName of SEMANTIC_REGIONS) {
      const region = composition.regions[regionName];
      assert(region.width > 0 && region.height > 0, `${name} m${missionId} ${regionName} is positive`);
      assert(Number.isFinite(region.x) && Number.isFinite(region.y), `${name} m${missionId} ${regionName} is finite`);
    }
    for (const [componentName, component] of Object.entries(composition.components)) {
      const resolved = resolveComponentSize(composition.sizeContracts[component.contract], component.rect);
      assert(resolved.width > 0 && resolved.height > 0, `${name} m${missionId} ${componentName} resolves size`);
      assert(rectInside(component.rect, layout.safeRect) || component.contract === 'modal', `${name} m${missionId} ${componentName} remains in safe composition`);
    }
    assert(composition.characters.length >= 1, `${name} m${missionId} declares character roles`);
    composition.characters.forEach((character) => {
      assert(['PRIMARY_CHARACTER', 'SUPPORTING_CHARACTER', 'BOARD_ACTOR', 'HIDDEN_FOR_MECHANIC_FOCUS'].includes(character.role), `${name} m${missionId} role ${character.role} is canonical`);
      assert(['ROBOT_V2_HELPER', 'ROBOT_V2_ASSEMBLED'].includes(character.visibleBoundsId), `${name} m${missionId} uses robot v2 bounds`);
      if (!character.visible) assert.equal(character.presentation, 'HIDDEN', `${name} m${missionId} hidden character presentation`);
      if (character.role === 'BOARD_ACTOR') assert.equal(character.coordinateSpace, 'BOARD_LOCAL', `${name} m${missionId} board actor coordinate space`);
    });
    if (missionId === 7) {
      assert(composition.mission7, `${name} Mission 7 layout is present`);
      assert.equal(composition.characters.filter((character) => character.visible).length, layout.semanticMode.startsWith('PHONE_PORTRAIT') ? 0 : 1, `${name} Mission 7 visible character count follows policy`);
      assert(composition.mission7.board.height >= 160, `${name} Mission 7 board keeps usable height`);
      assert(composition.mission7.hint.width >= 128 && composition.mission7.hint.height >= 48, `${name} Mission 7 hint target is usable`);
      assert(!overlaps(composition.mission7.board, {
        x: composition.mission7.hint.x - composition.mission7.hint.width / 2,
        y: composition.mission7.hint.y - composition.mission7.hint.height / 2,
        width: composition.mission7.hint.width,
        height: composition.mission7.hint.height,
      }), `${name} Mission 7 board clears hint`);
    }
    if (missionId === 8) {
      assert(composition.mission8, `${name} Mission 8 layout is present`);
      assert.equal(composition.characters.some((character) => character.role === 'BOARD_ACTOR' && character.visible), true, `${name} Mission 8 board actor is primary`);
      assert.equal(composition.characters.some((character) => character.id === 'HELPER' && character.visible), false, `${name} Mission 8 helper stays hidden`);
      assert(composition.mission8.board.width >= 300 && composition.mission8.board.height >= 180, `${name} Mission 8 board remains usable`);
      assert(composition.mission8.arrowSize >= 48 && composition.mission8.actionHeight >= 48, `${name} Mission 8 controls are touch-sized`);
    }
    if (missionId === 'MISSION5_TRANSITION') {
      assert(composition.transition, `${name} transition layout is present`);
      assert(composition.transition.pairScale > 0, `${name} transition pair scale is positive`);
      assert(composition.regions.CHARACTER.y + composition.regions.CHARACTER.height <= composition.regions.PRIMARY_ACTIONS.y + 1, `${name} transition character group clears primary action`);
    }
    reports.push({ name, missionId, semanticMode: composition.semanticMode, policyId: composition.policyId });
  }
}

fs.mkdirSync(path.join('docs', 'qa'), { recursive: true });
fs.writeFileSync(path.join('docs', 'qa', 'stage8-4a-composition-contract.json'), `${JSON.stringify({ reports, failures: [] }, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({ cases: reports.length, failures: [] }, null, 2)}\n`);
