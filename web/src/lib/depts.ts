/**
 * Display names for the 25 departments. The data keys are geoBoundaries'
 * upper-case, unaccented NOMBDEP values; these are the proper nouns as written
 * in Peru. Formatting, not translation: they are the same in EN and ES.
 */
export const DEPT_NAME: Record<string, string> = {
  AMAZONAS: 'Amazonas', ANCASH: 'Áncash', APURIMAC: 'Apurímac', AREQUIPA: 'Arequipa',
  AYACUCHO: 'Ayacucho', CAJAMARCA: 'Cajamarca', CALLAO: 'Callao', CUSCO: 'Cusco',
  HUANCAVELICA: 'Huancavelica', HUANUCO: 'Huánuco', ICA: 'Ica', JUNIN: 'Junín',
  'LA LIBERTAD': 'La Libertad', LAMBAYEQUE: 'Lambayeque', LIMA: 'Lima', LORETO: 'Loreto',
  'MADRE DE DIOS': 'Madre de Dios', MOQUEGUA: 'Moquegua', PASCO: 'Pasco', PIURA: 'Piura',
  PUNO: 'Puno', 'SAN MARTIN': 'San Martín', TACNA: 'Tacna', TUMBES: 'Tumbes', UCAYALI: 'Ucayali',
};

export const deptName = (key: string): string => DEPT_NAME[key] ?? key;
