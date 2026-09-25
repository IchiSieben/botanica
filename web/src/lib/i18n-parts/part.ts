/** One feature's strings. `es` must carry exactly the keys of `en` (checked by the type). */
export const part = <T extends Record<string, string>>(en: T, es: { [K in keyof T]: string }) => ({ en, es });
