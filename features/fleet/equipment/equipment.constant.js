export const EQUIPMENT_LIST_PAGE_SIZE = 20;
export const EQUIPMENT_SITES_PAGE_SIZE = 5;
export const EQUIPMENT_SCROLL_DEBOUNCE_MS = 200;
export const EQUIPMENT_IMAGE_SLIDESHOW_INTERVAL_MS = 3000;
export const EQUIPMENT_LOAD_PROGRESS_TICK_MS = 150;
export const EQUIPMENT_LOAD_PROGRESS_HOLD_MS = 500;
export const EQUIPMENT_LIST_SCROLL_BOTTOM_OFFSET_PX = 500;
export const EQUIPMENT_SITE_SCROLL_BOTTOM_OFFSET_PX = 800;
export const EQUIPMENT_INFINITE_SCROLL_TRIGGER_RATIO = 0.8;
export const EQUIPMENT_LIST_SCROLL_STEP = 10;
export const EQUIPMENT_SITE_SCROLL_STEP = 3;

export const NOTIFICATION_PRIORITY = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

export const STAFF_MAIN = JSON.parse(process.env.STAFF_MAIN || '[]');

export const BUTTON_PROPS = {
  variant: 'gradient',
  font: 'md',
  animation: '',
  squircle: '4xl',
  width: '200px',
  shadowPosition: 'to-bottom',
  shadowColor: 'white-600',
  padding: '10px 20px'
};

export const EQUIPMENT_TABS = {
  EQUIPMENT_BASED: 'equipment-based',
  HIRED: 'hired',
  LEASED: 'leased',
  SITE_BASED: 'site-based',
  ANSARI_STAFF: 'ansari-staff',
  RECORDS: 'records',
  IDLE_LIST: 'idle-list',
};

export const EQUIPMENT_GRID_TABS = [
  EQUIPMENT_TABS.EQUIPMENT_BASED,
  EQUIPMENT_TABS.HIRED,
  EQUIPMENT_TABS.LEASED,
  EQUIPMENT_TABS.ANSARI_STAFF,
];

export const EQUIPMENT_STATUS_FILTERS = {
  ALL: 'all',
  ACTIVE: 'active',
};

export const EQUIPMENT_HIRED_QUERY_PARAM_BY_TAB = {
  [EQUIPMENT_TABS.HIRED]: 'hired',
  [EQUIPMENT_TABS.EQUIPMENT_BASED]: 'own',
  [EQUIPMENT_TABS.ANSARI_STAFF]: 'own',
};

export const EQUIPMENT_ACTIVE_STATUS_GROUP = ['active', 'leased', 'going', 'loading'];

export const EQUIPMENT_DEFAULT_STATUS_COUNTS = {
  total: 0,
  active: 0,
  idle: 0,
  maintenance: 0,
};

export const EQUIPMENT_DEFAULT_EXPORT_COLUMNS = {
  machine: true,
  regNo: true,
  brand: true,
  year: true,
  company: true,
  operator: true,
  site: true,
  status: true,
  istimaraExpiry: false,
  insuranceExpiry: false,
  tpcExpiry: false,
};

export const EQUIPMENT_ANSARI_STAFF_SITE_KEYWORD = 'ansari staff';

export const EQUIPMENT_MOBILIZE_DEFAULT_SHIFTS = [
  { operatorName: '', operatorId: '', shiftName: 'Day Shift', shiftStart: '', shiftEnd: '' },
  { operatorName: '', operatorId: '', shiftName: 'Night Shift', shiftStart: '', shiftEnd: '' },
];

export const EQUIPMENT_EMPTY_SHIFT_ENTRY = {
  operatorName: '',
  operatorId: '',
  shiftName: '',
  shiftStart: '',
  shiftEnd: '',
};

export const FLEET_EQUIPMENT_TABS_CONFIG = [
  { key: EQUIPMENT_TABS.EQUIPMENT_BASED, label: 'Own Equipments' },
  { key: EQUIPMENT_TABS.HIRED, label: 'Hired' },
  { key: EQUIPMENT_TABS.LEASED, label: 'Leased to Client' },
  { key: EQUIPMENT_TABS.SITE_BASED, label: 'View By Sites' },
  { key: EQUIPMENT_TABS.ANSARI_STAFF, label: 'Ansari Staff' },
  { key: EQUIPMENT_TABS.RECORDS, label: 'Records' },
];

export const EQUIPMENT_ADD_FORM_DEFAULTS = {
  machine: '', regNo: '', coc: '', brand: '', year: '',
  istimaraExpiry: '', insuranceExpiry: '', tpcExpiry: '',
  operator: '', operatorId: '', operatorShift: '', company: 'ATE',
  hiredFrom: '', hired: false, status: 'Active', site: '',
  location: '',
  rentRate: { basis: 'daily', rate: '', currency: 'QAR' },
  'rentRate.basis': 'daily',
  'rentRate.rate': '',
};

export const EQUIPMENT_EDIT_FORM_DEFAULTS = {
  machine: '', regNo: '', coc: '', year: '', company: '',
  operator: '', operatorId: '', operatorShift: '', hiredFrom: '', site: '', status: '',
  istimaraExpiry: '', insuranceExpiry: '', tpcExpiry: '',
  location: '',
  rentRate: { basis: 'daily', rate: '', currency: 'QAR' },
  'rentRate.basis': 'daily',
  'rentRate.rate': '',
};

export const EQUIPMENT_OUTSIDE_FORM_DEFAULTS = {
  machine: '', regNo: '', brand: '', operator: '', company: 'OUTSIDE', hired: true,
};

export const EQUIPMENT_DEMOBILIZE_FORM_DEFAULTS = { date: '', time: '', remarks: '', allShifts: [], selectedShift: '', demobAll: true };

export const EQUIPMENT_ADD_SHIFT_FORM_DEFAULTS = { operators: [], date: '', time: '', remarks: '' };

export const EQUIPMENT_MOBILIZE_FORM_DEFAULTS = {
  site: '', operator: '', operatorId: '', operators: [], withOperator: false, withShift: false, moreShifts: false,
  remarks: '', deployType: 'site', clientCompany: '', date: '', time: '', singleOperatorShift: 'Full Shift',
  isOneDayMob: false, demobDate: '', demobTime: '', demobRemarks: '',
  location: '', rentRate: { basis: '', rate: '' }, 'rentRate.basis': '', 'rentRate.rate': '',
};

export const EQUIPMENT_REPLACE_OPERATOR_FORM_DEFAULTS = {
  currentOperator: '', currentOperatorId: '',
  replacedOperator: '', replacedOperatorId: '',
  targetShiftName: '', shiftName: '', shiftStart: '', shiftEnd: '',
  remarks: '', date: '', time: '',
  allShifts: [],
  selectedShift: '',
  replaceAll: false,
};

export const EQUIPMENT_REPLACE_EQUIPMENT_FORM_DEFAULTS = {
  replacedEquipmentId: '', replacedEquipmentRegNo: '',
  replacedEquipmentMachine: '', newSiteForReplaced: '', remarks: '', date: '', time: '',
  operators: [],
};

export const EQUIPMENT_FUEL_PROGRESS_TICK_MS = 150;
export const EQUIPMENT_FUEL_SIDEBAR_OPEN_DELAY_MS = 300;
export const EQUIPMENT_FUEL_PROGRESS_HOLD_MS = 500;

export const EQUIPMENT_SEARCH_DEBOUNCE_MS = 500;
export const EQUIPMENT_SEARCH_RESULTS_LIMIT = 100;
export const EQUIPMENT_SEARCH_HIRED_FILTER_BY_TAB = {
  [EQUIPMENT_TABS.HIRED]: 'hired',
  [EQUIPMENT_TABS.EQUIPMENT_BASED]: 'own',
};

export const EQUIPMENT_IMAGE_CACHE_KEY = 'equipment_images_cache';
export const EQUIPMENT_IMAGE_CACHE_EXPIRY_MS = 6 * 60 * 60 * 1000;
export const EQUIPMENT_STALE_CACHE_KEYS = ['equipment_data_cache', 'equipment_list_cache'];

export const EQUIPMENT_EXPORT_COLUMN_HEADERS = {
  machine: 'Machine',
  regNo: 'Reg No',
  brand: 'Brand',
  year: 'Year',
  company: 'Company',
  operator: 'Operator',
  site: 'Site',
  status: 'Status',
  istimaraExpiry: 'Istimara Expiry',
  insuranceExpiry: 'Insurance Expiry',
  tpcExpiry: 'TPC Expiry',
};

export const EQUIPMENT_EXPORT_DATE_FIELDS = new Set(['istimaraExpiry', 'insuranceExpiry', 'tpcExpiry']);

export const EQUIPMENT_SKELETON_CARD_COUNT = 6;

export const EQUIPMENT_GRID_COLUMN_BREAKPOINT_PX = 1400;
export const EQUIPMENT_GRID_GAP_DESKTOP_PX = 30;
export const EQUIPMENT_GRID_GAP_MOBILE_PX = 16;
export const EQUIPMENT_GRID_GAP_MOBILE_BREAKPOINT_PX = 768;
export const EQUIPMENT_GRID_ROW_HEIGHT_HIRED_PX = 362;
export const EQUIPMENT_GRID_ROW_HEIGHT_DEFAULT_PX = 320;