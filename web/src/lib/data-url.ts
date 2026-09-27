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

/** fetch() of an ETL export by its hashed URL, falling back to the plain name on an error
 *  status: a tab left open across a later deploy asks for a hash the mirror has since
 *  replaced (the plain files are always in dist). */
export const fetchData = async (name: string, init?: RequestInit): Promise<Response> => {
  const url = dataUrl(name);
  const r = await fetch(url, init);
  const plain = `${import.meta.env.BASE_URL}data/${name}.json`;
  return r.ok || url === plain ? r : fetch(plain, init);
};
