// ─────────────────────────────────────────────────────────────────────────────
// User Constants
// ─────────────────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const USER_ROLES = {
  CEO:                    'CEO',
  MD:                     'MD',
  SUPER_ADMIN:            'SUPER_ADMIN',
  SUB_ADMIN:              'SUB_ADMIN',
  MANAGER:                'MANAGER',
  SUB_MANAGER:            'SUB_MANAGER',
  SUB_MANAGER_TWO:        'SUB_MANAGER_TWO',
  ASSISTANT_MANAGER:      'ASSISTANT_MANAGER',
  SUB_ASSISTANT_MANAGER:  'SUB_ASSISTANT_MANAGER',
  PURCHASE_MANAGER:       'PURCHASE_MANAGER',
  WORKSHOP_MANAGER:       'WORKSHOP_MANAGER',
  MAINTENANCE_HEAD:       'MAINTENANCE_HEAD',
  MECHANIC_HEAD:          'MECHANIC_HEAD',
  ACCOUNTANT:             'ACCOUNTANT',
  ASSISTANT_ACCOUNTANT:   'ASSISTANT_ACCOUNTANT',
  SUB_ACCOUNTANT:         'SUB_ACCOUNTANT',
  OFFICE_ADMIN:           'OFFICE_ADMIN',
  ASSISTANT_OFFICE_ADMIN: 'ASSISTANT_OFFICE_ADMIN',
  CAMP_BOX:               'CAMP_BOSS',
  OPERATOR:               'OPERATOR',
  GUEST_USER:             'GUEST_USER',
  PRO:                    'PRO',
  JALEEL_KA:              'JALEEL_KA',
  CHARISHMA:              'CHARISHMA',
};

const ROLE_PREFIX_MAP = {
  CEO:                    'CEO',
  SUPER_ADMIN:            'SAD',
  CAMP_BOSS:              'CBS',
  MD:                     'MND',
  MANAGER:                'MGR',
  ASSISTANT_MANAGER:      'AMG',
  PURCHASE_MANAGER:       'PUR',
  WORKSHOP_MANAGER:       'WSM',
  MAINTENANCE_HEAD:       'MNT',
  MECHANIC_HEAD:          'MEC',
  OPERATOR:               'OPR',
  ACCOUNTANT:             'ACT',
  ASSISTANT_ACCOUNTANT:   'AST',
  OFFICE_ADMIN:           'OFA',
  ASSISTANT_OFFICE_ADMIN: 'ASN',
  SUB_ADMIN:              'SBN',
  SUB_ACCOUNTANT:         'SBC',
  GUEST_USER:             'GUE',
};

module.exports = { JWT_SECRET, USER_ROLES, ROLE_PREFIX_MAP };