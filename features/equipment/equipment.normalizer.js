const SYNONYM_MAP = {
  BOOMTRUCK: 'Boom Truck',
  'BOOM TRUCK': 'Boom Truck',
  'WHEEL EXCAVATOR': 'Wheel Excavator',
  'CHAIN EXCAVATOR': 'Chain Excavator',
  'LONG BOOM EXCAVATOR': 'Long Boom Excavator',
  FORKLIFT: 'Forklift',
  ROLLER: 'Roller',
  EXCAVATOR: 'Excavator',
  'CRAWLER EXCAVATOR': 'Crawler Excavator',
  'MINI EXCAVATOR': 'Mini Excavator',
  'UD RECOVERY TRUCK': 'UD Recovery Truck',
  'DOUBLE CABIN PICKUP': 'Double Cabin Pickup',
  'SINGLE CABIN PICKUP': 'Single Cabin Pickup',
  TELEHANDLER: 'Telehandler',
  SKIDLOADER: 'Skid Loader',
  'BACKHO LOADER': 'Backhoe Loader',
  'LOW BED': 'Lowbed Trailer',
  'HILLUX PICK UP': 'Hilux Pickup',
  'EICHER - BUS': 'Eicher Bus',
  'EICHER BUS': 'Eicher Bus',
  'MERCEDES-BENZ': 'Mercedes-Benz',
};

const VEHICLE_MODELS = new Set([
  'HIACE', 'INNOVA', 'COROLLA', 'LEXUS', 'KIA SPORTAGE', 'PRADO',
  'RANGE ROVER', 'RAV4', 'RUSH', 'YARIS', 'MERCEDES-BENZ',
]);

const KEEP_AS_IS = new Set(['UD']);

const CATEGORY_RULES = [
  { category: 'Crane', test: /crane/i },
  { category: 'Telehandler', test: /telehandler/i },
  { category: 'Excavator', test: /excavator/i },
  { category: 'Forklift', test: /forklift/i },
  { category: 'Loader', test: /loader/i },
  { category: 'Grader', test: /grader/i },
  { category: 'Manlift', test: /manlift/i },
  { category: 'Compactor', test: /compactor/i },
  { category: 'Trailer', test: /trailer/i },
  { category: 'Roller', test: /roller/i },
  { category: 'Pickup', test: /pickup|pick\s*up/i },
  { category: 'Bus', test: /\bbus\b/i },
  { category: 'Truck', test: /truck/i },
];

function titleCase(str) {
  return str
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (KEEP_AS_IS.has(word.toUpperCase())) return word.toUpperCase();
      if (/^\d+m$/i.test(word)) return `${word.slice(0, -1)} M`;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeMachineName(raw) {
  const original = (raw || '').trim();
  if (!original) {
    return { machineOriginal: original, machine: original, category: null, subCategory: null };
  }

  let working = original;
  let subCategory = null;

  const tonMatch = working.match(/(\d+(?:\.\d+)?)\s*TON\b/i);
  if (tonMatch) {
    subCategory = `${tonMatch[1]} Ton`;
    working = working.replace(tonMatch[0], ' ');
  } else if (/\bTON\b/i.test(working)) {
    const strayNumberMatch = working.match(/\d+(?:\.\d+)?/);
    if (strayNumberMatch) subCategory = `${strayNumberMatch[0]} Ton`;
    working = working.replace(/\bTON\b/i, ' ');
  }

  if (!subCategory) {
    const meterMatch = working.match(/(\d+(?:\.\d+)?)\s*M\b/i);
    if (meterMatch) {
      subCategory = `${meterMatch[1]} M`;
      working = working.replace(meterMatch[0], ' ');
    }
  }

  if (!subCategory) {
    const kgMatch = working.match(/(\d+(?:\.\d+)?)\s*KG\b/i);
    if (kgMatch) {
      subCategory = `${kgMatch[1]} Kg`;
      working = working.replace(kgMatch[0], ' ');
    }
  }

  working = working.replace(/\b\d+(?:\.\d+)?\b/g, ' ');
  working = working.replace(/\s+/g, ' ').trim();

  const synonymKey = working.toUpperCase();
  const baseName = SYNONYM_MAP[synonymKey] || titleCase(working);

  const categoryRule = CATEGORY_RULES.find((rule) => rule.test.test(baseName));
  const category = categoryRule
    ? categoryRule.category
    : VEHICLE_MODELS.has(baseName.toUpperCase())
      ? 'Vehicle'
      : null;

  const machine = subCategory ? `${subCategory} ${baseName}` : baseName;

  return { machineOriginal: original, machine, category, subCategory };
}

module.exports = { normalizeMachineName };