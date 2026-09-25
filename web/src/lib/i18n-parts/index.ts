import tree from './tree';
import changes from './changes';
import intro from './intro';
import explorer from './explorer';
import frame from './frame';

export const PARTS_EN = { ...tree.en, ...changes.en, ...intro.en, ...explorer.en, ...frame.en };
export const PARTS_ES: { [K in keyof typeof PARTS_EN]: string } = { ...tree.es, ...changes.es, ...intro.es, ...explorer.es, ...frame.es };
