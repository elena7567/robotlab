export type RobotAssemblyProgress = 0 | 1 | 2 | 3 | 4 | 5;

export type RobotAssemblyPart =
  | 'body'
  | 'head'
  | 'legLeft'
  | 'legRight'
  | 'armLeft'
  | 'armRight'
  | 'antenna';

export const ROBOT_ASSEMBLY_PARTS_BY_PROGRESS: Readonly<Record<RobotAssemblyProgress, readonly RobotAssemblyPart[]>> = {
  0: [],
  1: ['body'],
  2: ['body', 'head'],
  3: ['body', 'head', 'legLeft', 'legRight'],
  4: ['body', 'head', 'legLeft', 'legRight', 'armLeft', 'armRight'],
  5: ['body', 'head', 'legLeft', 'legRight', 'armLeft', 'armRight', 'antenna'],
};

export const ROBOT_ASSEMBLY_NEW_PARTS: Readonly<Record<Exclude<RobotAssemblyProgress, 0>, readonly RobotAssemblyPart[]>> = {
  1: ['body'],
  2: ['head'],
  3: ['legLeft', 'legRight'],
  4: ['armLeft', 'armRight'],
  5: ['antenna'],
};

export const ROBOT_ASSEMBLY_INSTALL_MESSAGES: Readonly<Record<Exclude<RobotAssemblyProgress, 0>, string>> = {
  1: 'КОРПУС ГОТОВ!',
  2: 'ГОЛОВА НА МЕСТЕ!',
  3: 'НОГИ ГОТОВЫ!',
  4: 'РУКИ НА МЕСТЕ!',
  5: 'ОСТАЛОСЬ ВКЛЮЧИТЬ!',
};

export const HELPER_ASSEMBLY_DIALOGUE: Readonly<Record<Exclude<RobotAssemblyProgress, 0>, string>> = {
  1: 'ОТЛИЧНО! ЕСТЬ КОРПУС!',
  2: 'ТЕПЕРЬ ГОЛОВА!',
  3: 'ОН УЖЕ МОЖЕТ СТОЯТЬ!',
  4: 'ПОЧТИ ГОТОВО!',
  5: 'УРА! ОН РАБОТАЕТ!',
};

export function deriveAssemblyProgress(completedTasks: number): RobotAssemblyProgress {
  return Math.max(0, Math.min(5, Math.floor(completedTasks))) as RobotAssemblyProgress;
}
