/**
 * Plain-language vocabulary for claims. Pure data, no DOM.
 *
 * Each record has the words people use for it and the words for each kind
 * of claim. "Rain" maps to MERRA-2 rainfall; GPM IMERG satellite rain is used
 * as its second opinion (and topsoil wetness is checked against GLDAS).
 */
export const RECORDS = {
  T2M: {
    noun: 'Temperature', short: 'heat', unit: '°C', decimals: 2,
    up: 'hotter', down: 'cooler',
    words: ['temperature', 'temperatures', 'heat', 'hot', 'hotter', 'warm', 'warmer', 'warming', 'cold', 'colder', 'cooler', 'cooling', 'heatwave', 'heatwaves', 'summers', 'winters'],
    upWords: ['hotter', 'warmer', 'warming', 'heating'],
    downWords: ['colder', 'cooler', 'cooling'],
    what: 'Air temperature 2 m above the ground',
    source: 'NASA POWER · MERRA-2',
  },
  PRECTOTCORR: {
    noun: 'Rain', short: 'rain', unit: 'mm/day', decimals: 2,
    up: 'wetter', down: 'drier',
    words: ['rain', 'rains', 'rainfall', 'raining', 'rainy', 'precipitation', 'monsoon', 'monsoons', 'downpours', 'storms', 'rainier'],
    upWords: ['wetter', 'rainier'],
    downWords: ['drier', 'dryer', 'drying', 'drying out', 'dried out'],
    what: 'Rain and snow reaching the ground, corrected with rain gauges',
    source: 'NASA POWER · MERRA-2 (checked against GPM IMERG satellites)',
  },
  GWETTOP: {
    noun: 'Topsoil', short: 'soil', unit: '', decimals: 3,
    up: 'wetter', down: 'drier',
    words: ['soil', 'soils', 'ground', 'drought', 'droughts', 'topsoil', 'farmland'],
    upWords: ['wetter', 'moister'],
    downWords: ['drier', 'dryer', 'parched', 'drying', 'drying out', 'dried out'],
    what: 'How wet the top layer of soil is, from 0 (bone dry) to 1 (soaked)',
    source: 'NASA POWER · MERRA-2 (checked against GLDAS)',
  },
  RH2M: {
    noun: 'Humidity', short: 'humidity', unit: '%', decimals: 1,
    up: 'more humid', down: 'less humid',
    words: ['humidity', 'humid', 'muggy', 'sticky', 'moisture'],
    upWords: ['muggier', 'stickier'],
    downWords: [],
    what: 'How close the air is to holding all the water vapour it can',
    source: 'NASA POWER · MERRA-2',
  },
  aerosol: {
    noun: 'Haze', short: 'haze', unit: 'AOD', decimals: 3,
    up: 'hazier', down: 'clearer',
    words: ['haze', 'hazy', 'smog', 'pollution', 'polluted', 'smoke', 'smoky', 'aerosol', 'aerosols', 'air quality', 'air pollution'],
    upWords: ['hazier', 'smoggier', 'more polluted'],
    downWords: ['clearer', 'cleaner'],
    what: 'How much dust, smoke, pollution and sea salt dims sunlight (0 = perfectly clear)',
    source: 'MERRA-2 aerosol reanalysis',
  },
  dust: {
    noun: 'Dust', short: 'dust', unit: 'AOD', decimals: 3,
    up: 'dustier', down: 'less dusty',
    words: ['dust', 'dusty', 'sandstorm', 'sandstorms', 'dust storm', 'dust storms'],
    upWords: ['dustier'],
    downWords: [],
    what: 'The part of the haze made of desert dust',
    source: 'MERRA-2 aerosol reanalysis',
  },
  evaporation: {
    noun: 'Evaporation', short: 'evaporation', unit: 'mm/day', decimals: 2,
    up: 'higher', down: 'lower',
    words: ['evaporation', 'evaporating', 'evapotranspiration'],
    upWords: [], downWords: [],
    what: 'Water leaving the land and plants into the air',
    source: 'GLDAS land model',
  },
  runoff: {
    noun: 'Runoff', short: 'runoff', unit: 'mm/day', decimals: 3,
    up: 'higher', down: 'lower',
    words: ['runoff', 'run-off', 'flood', 'floods', 'flooding', 'flash floods'],
    upWords: [], downWords: [],
    what: 'Rainwater flowing off the surface towards rivers (a rough flood signal)',
    source: 'GLDAS land model',
  },
};

export const RECORD_ORDER = ['T2M', 'PRECTOTCORR', 'GWETTOP', 'RH2M', 'aerosol', 'dust', 'evaporation', 'runoff'];

export const CLAIM_TYPES = {
  up: { label: 'getting higher', test: 'average', sign: 1 },
  down: { label: 'getting lower', test: 'average', sign: -1 },
  wilder: { label: 'more erratic', test: 'swings', sign: 1 },
  steadier: { label: 'steadier', test: 'swings', sign: -1 },
};

/** Phrases that name a kind of claim. Checked longest first. */
export const TYPE_PHRASES = [
  ['less erratic', 'steadier'], ['less extreme', 'steadier'], ['less variable', 'steadier'], ['less unpredictable', 'steadier'],
  ['more stable', 'steadier'], ['more predictable', 'steadier'], ['steadier', 'steadier'], ['stabler', 'steadier'], ['calmer', 'steadier'], ['stable', 'steadier'],
  ['more erratic', 'wilder'], ['more extreme', 'wilder'], ['more variable', 'wilder'], ['more unpredictable', 'wilder'], ['more volatile', 'wilder'],
  ['erratic', 'wilder'], ['extreme', 'wilder'], ['extremes', 'wilder'], ['unpredictable', 'wilder'], ['volatile', 'wilder'], ['wilder', 'wilder'], ['wild', 'wilder'],
  ['swings', 'wilder'], ['swinging', 'wilder'], ['unstable', 'wilder'], ['variable', 'wilder'], ['intense', 'wilder'], ['erratically', 'wilder'],
  ['increasing', 'up'], ['rising', 'up'], ['higher', 'up'], ['more', 'up'], ['growing', 'up'], ['worse', 'up'], ['up', 'up'],
  ['decreasing', 'down'], ['falling', 'down'], ['lower', 'down'], ['less', 'down'], ['fewer', 'down'], ['declining', 'down'], ['down', 'down'], ['disappearing', 'down'],
];

/** The claim as a sentence, e.g. "Rain in Pakistan is getting more erratic". */
export function claimSentence(record, type, placeLabel) {
  const r = RECORDS[record];
  const word = type === 'up' ? r.up : type === 'down' ? r.down : type === 'wilder' ? 'more erratic' : 'steadier';
  return `${r.noun} in ${placeLabel} is getting ${word}`;
}
