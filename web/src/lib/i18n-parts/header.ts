import { part } from './part';

// Header toggles (brief v3 item 8): icon + visible text + aria-label.
export default part(
  {
    'hdr.lang': 'Language',
    'hdr.langGroup': 'Language: English or Spanish',
    'hdr.langCurrent': 'current',
    // Read in the TARGET locale (t(other, …)): the link carries lang={other}.
    'hdr.langSelf': 'Read in English',
    'hdr.theme': 'Theme',
    'hdr.dark': 'dark',
    'hdr.light': 'light',
    'hdr.themeAriaDark': 'Theme: dark. Switch to light',
    'hdr.themeAriaLight': 'Theme: light. Switch to dark',
    // Way back to the portfolio (v3.2 B6).
    'ic7.nav': 'IchiSieben portfolio',
    'ic7.back': 'Botánica project page',
    'ic7.home': 'Portfolio home',
  },
  {
    'hdr.lang': 'Idioma',
    'hdr.langGroup': 'Idioma: español o inglés',
    'hdr.langCurrent': 'actual',
    'hdr.langSelf': 'Leer en español',
    'hdr.theme': 'Tema',
    'hdr.dark': 'oscuro',
    'hdr.light': 'claro',
    'hdr.themeAriaDark': 'Tema: oscuro. Cambiar a claro',
    'hdr.themeAriaLight': 'Tema: claro. Cambiar a oscuro',
    'ic7.nav': 'Portafolio IchiSieben',
    'ic7.back': 'ficha del proyecto Botánica',
    'ic7.home': 'Inicio del portafolio',
  },
);
