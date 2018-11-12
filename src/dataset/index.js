import importAll from 'import-all.macro';
import { toPairs } from 'lodash';

const downPaths = toPairs(importAll.sync('./down/*.jpg'));
const upPaths = toPairs(importAll.sync('./up/*.jpg'));

export const imagePaths = [
  ...downPaths.map(([_, path]) => path),
  ...upPaths.map(([_, path]) => path),
];
export const imageCategories = [
  ...downPaths.map(_ => 'down'),
  ...upPaths.map(_ => 'up'),
];
