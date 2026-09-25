import tree from './tree';
import changes from './changes';
import intro from './intro';
import explorer from './explorer';
import frame from './frame';
import header from './header';
import species from './species';

export const PARTS_EN = { ...tree.en, ...changes.en, ...intro.en, ...explorer.en, ...frame.en, ...header.en, ...species.en };
export const PARTS_ES: { [K in keyof typeof PARTS_EN]: string } = { ...tree.es, ...changes.es, ...intro.es, ...explorer.es, ...frame.es, ...header.es, ...species.es };
