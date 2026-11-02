const EDITABLE_USER_FIELDS = {
  staff: [
    { key: 'name', label: 'Full name', type: 'text', isRequired: true },
    { key: 'email', label: 'Email', type: 'email', isRequired: true },
    { key: 'authMail', label: 'Authentication email', type: 'email', isRequired: false },
  ],
  mechanic: [
    { key: 'name', label: 'Full name', type: 'text', isRequired: true },
    { key: 'zktecoPin', label: 'ZKTeco PIN', type: 'number', isRequired: true },
    { key: 'uniqueCode', label: 'Unique code', type: 'text', isRequired: true },
    { key: 'qatarId', label: 'Qatar ID', type: 'text', isRequired: true },
  ],
  operator: [
    { key: 'name', label: 'Full name', type: 'text', isRequired: true },
    { key: 'qatarId', label: 'Qatar ID', type: 'text', isRequired: true },
    { key: 'contactNo', label: 'Contact number', type: 'text', isRequired: false },
    { key: 'uniqueCode', label: 'Unique code', type: 'text', isRequired: true },
  ],
}

module.exports = { EDITABLE_USER_FIELDS }