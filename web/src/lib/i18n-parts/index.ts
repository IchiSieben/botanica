import tree from './tree';
import changes from './changes';
import intro from './intro';
import explorer from './explorer';

export const PARTS_EN = { ...tree.en, ...changes.en, ...intro.en, ...explorer.en };
export const PARTS_ES: { [K in keyof typeof PARTS_EN]: string } = { ...tree.es, ...changes.es, ...intro.es, ...explorer.es };
