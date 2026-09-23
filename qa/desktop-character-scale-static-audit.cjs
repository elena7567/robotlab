const fs = require('fs');
const path = require('path');

const root = process.cwd();
const files = [
  'src/game/scenes/GameScene.ts',
  'src/game/scenes/Mission6Scene.ts',
  'src/game/scenes/Mission7Scene.ts',
  'src/game/scenes/Mission8Scene.ts',
  'src/game/scenes/Mission9Scene.ts',
  'src/game/scenes/Mission10Scene.ts',
  'src/game/scenes/TransitionScene.ts',
  'src/game/scenes/VictoryScene.ts',
  'src/game/ui/ProgrammingBoard.ts',
  'src/game/ui/RobotAssemblyPreview.ts',
  'src/game/ui/robotGrounding.ts',
  'src/game/ui/sceneCompositionDirector.ts',
];

const scalePattern = /setScale\(|setDisplaySize\(|displayHeight\s*=|displayWidth\s*=|scale\s*=|scaleX\s*=|scaleY\s*=/;
const allowed = [
  /resolveWorldCharacterScale/,
  /resolveBoardActorScale/,
  /missionLayout\..*\.scale/,
  /this\.missionLayout!\.robotScale/,
  /helperSizing\.resolvedScale/,
  /desktopReleaseSizing\?\.resolvedScale/,
  /transitionDesktopSizing\?\.resolvedScale/,
  /victorySizing\?\.resolvedScale/,
  /introSizing\?\.resolvedScale/,
  /signalRobotScale/,
  /actorFit\.scale/,
  /fit\.scale/,
  /image\.setScale\(fit\)/,
  /setScale\(platform\.scale\)/,
  /setScale\(worldScale\)/,
  /setScale\(backgroundScale\)/,
  /setScale\(scale\)/,
  /setScale\(left\.scaleX, left\.scaleY\)/,
  /setScale\(layout\.scale/,
  /setScale\(1\)/,
  /setScale\(0\)/,
  /scale: puzzle\.stage/,
  /scaleX:/,
  /scaleY:/,
  /robotCellHeightRatio: 0\.72/,
  /ASSEMBLY_PREVIEW_SCALE/,
  /ROBOT_PLATFORM_SCALE/,
  /layout\.semanticMode === 'PHONE_LANDSCAPE_SHORT'/,
];

const findings = [];
const occurrences = [];
for (const file of files) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) continue;
  const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    if (!scalePattern.test(line)) return;
    const occurrence = { file, line: index + 1, text: line.trim() };
    occurrences.push(occurrence);
    const robotRelated = /robot|Robot|helper|assembled|repaired|character|actor|pair/i.test(line);
    const numericScale = /setScale\(\s*\d|scale\s*[:=]\s*\d|scaleX\s*[:=]|scaleY\s*[:=]/.test(line);
    const isAllowed = allowed.some((pattern) => pattern.test(line));
    if (robotRelated && numericScale && !isAllowed) findings.push(occurrence);
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  scannedFiles: files,
  occurrenceCount: occurrences.length,
  directMissionCharacterScaleOverrides: findings.length,
  findings,
  allowlistedReason: 'Policy application, board-local actor fit, modal preview, non-character image/object fitting, animation scale, or mobile-only branch.',
};

fs.mkdirSync(path.join(root, 'docs/qa'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs/qa/desktop-character-scale-static-audit.json'), JSON.stringify(report, null, 2));
if (findings.length) {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(report, null, 2));
