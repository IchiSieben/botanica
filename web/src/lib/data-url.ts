/**
 * URL of an ETL export under public/data/. In a build it is the content-hashed copy
 * (`data/species-plantae.<hash>.json`, written by the `hashed-data` integration in
 * astro.config.mjs) so the file can be cached as immutable; `astro dev` serves public/
 * as it is, so there it is the plain name.
 */
declare const __DATA_HASHES__: Record<string, string>;

export const dataUrl = (name: string): string => {
  const hash = import.meta.env.DEV ? undefined : __DATA_HASHES__[name];
  return `${import.meta.env.BASE_URL}data/${name}${hash ? `.${hash}` : ''}.json`;
};
