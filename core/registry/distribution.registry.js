const { submitMaintenanceDistribution } = require('#features/fleet/maintenance/maintenance.distribution');
const { SERVICE_TYPES } = require('#features/fleet/maintenance/maintenance.constant');
const { searchEquipmentSuggestions } = require('#features/fleet/equipment/equipment.suggestion');
const { submitComplaintDistribution } = require('#features/fleet/complaint/complaint.distribution');

const distributionRegistry = {
  complaints: {
    label: 'Complaints',
    allowsAttachments: true,
    submit: submitComplaintDistribution,
    fields: [
      {
        key: 'regNo',
        label: 'Equipment No',
        type: 'text',
        required: true,
        example: 'EQ-102',
        suggest: searchEquipmentSuggestions,
      },
      { key: 'equipment', label: 'Equipment', type: 'text', required: false, example: 'Excavator CAT 320' },
      { key: 'remarks', label: 'Remarks', type: 'textarea', required: true, example: 'Describe the issue' },
    ],
  },
  maintenance: {
    label: 'Maintenance',
    allowsAttachments: true,
    submit: submitMaintenanceDistribution,
    fields: [
      {
        key: 'regNo',
        label: 'Equipment No',
        type: 'text',
        required: true,
        example: 'EQ-102',
        suggest: searchEquipmentSuggestions,
      },
      {
        key: 'serviceType',
        label: 'Service Type',
        type: 'text',
        required: true,
        example: 'oil, normal, tyre, battery, major',
        options: SERVICE_TYPES,
      },
      { key: 'date', label: 'Date', type: 'text', required: true, example: '2026-10-26' },
      { key: 'equipment', label: 'Equipment', type: 'text', required: true, example: 'Excavator CAT 320' },
      { key: 'location', label: 'Location', type: 'text', required: false },
      { key: 'operator', label: 'Operator', type: 'text', required: false },
      { key: 'mechanics', label: 'Mechanics', type: 'text', required: false },
      { key: 'remarks', label: 'Remarks', type: 'textarea', required: false },
      { key: 'serviceHrs', label: 'Service Hrs', type: 'text', required: false, example: '1250' },
      { key: 'nextServiceHrs', label: 'Next Service Hrs', type: 'text', required: false, example: '1500' },
      {
        key: 'tyreModel',
        label: 'Tyre Model',
        type: 'text',
        required: false,
        showWhen: { field: 'serviceType', equals: 'tyre' },
      },
      {
        key: 'tyreNumber',
        label: 'Tyre Number',
        type: 'text',
        required: false,
        showWhen: { field: 'serviceType', equals: 'tyre' },
      },
      {
        key: 'batteryModel',
        label: 'Battery Model',
        type: 'text',
        required: false,
        showWhen: { field: 'serviceType', equals: 'battery' },
      },
    ],
  },
};

const FIELD_TYPES = ['text', 'textarea', 'number', 'image', 'video', 'audio'];

const listDistributionDefinitions = () =>
  Object.entries(distributionRegistry).map(([key, definition]) => ({
    key,
    label: definition.label,
    allowsAttachments: Boolean(definition.allowsAttachments),
    fields: definition.fields
      .filter((field) => FIELD_TYPES.includes(field.type))
      .map(({ suggest, ...field }) => ({ ...field, hasRemoteSuggestions: Boolean(suggest) })),
  }));

module.exports = { distributionRegistry, listDistributionDefinitions };