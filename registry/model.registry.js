// ─── Model Registry ───────────────────────────────────────────────────────────
// Add a new model here. Nothing else needs to change.

const serviceHistoryModel     = require('../models/history.model.js');
const serviceReportModel      = require('../models/report.model.js');
const maintananceHistoryModel = require('../models/maintenance.model.js');
const tyreModel               = require('../models/tyre.model.js');
const batteryModel            = require('../models/battery.model.js');
const stocksModel             = require('../models/stock.model.js');
const equipmentModel          = require('../models/equipment.model.js');
const toolkitModel            = require('../models/toolkit.model.js');
const complaintModel          = require('../models/complaint.model.js');
const mobilizationModel       = require('../models/mobilizations.model.js');
const replacementModel        = require('../models/replacements.model.js');
const lpoModel                = require('../models/lpo.model.js');
const backchargeModel         = require('../models/backcharge.model.js');
const documentModel           = require('../models/document.model.js');

// ─── Registry ────────────────────────────────────────────────────────────────
// Each entry: { model, key, label }
//   model  → Mongoose model
//   key    → unique camelCase identifier used in API response keys
//   label  → human-readable name shown in frontend

const REGISTRY = [
  { model: serviceHistoryModel,     key: 'serviceHistory',      label: 'Service History'      },
  { model: serviceReportModel,      key: 'serviceReport',       label: 'Service Reports'      },
  { model: maintananceHistoryModel, key: 'maintenanceHistory',  label: 'Maintenance History'  },
  { model: tyreModel,               key: 'tyreHistory',         label: 'Tyre History'         },
  { model: batteryModel,            key: 'batteryHistory',      label: 'Battery History'      },
  { model: equipmentModel,          key: 'equipment',           label: 'Equipment'            },
  { model: stocksModel,             key: 'stocks',              label: 'Stocks'               },
  { model: toolkitModel,            key: 'toolkit',             label: 'Toolkit'              },
  { model: complaintModel,          key: 'complaints',          label: 'Complaints'           },
  { model: mobilizationModel,       key: 'mobilization',        label: 'Mobilization'         },
  { model: replacementModel,        key: 'replacement',         label: 'Replacement'          },
  { model: lpoModel,                key: 'lpo',                 label: 'LPO'                  },
  { model: backchargeModel,         key: 'backcharge',          label: 'Backcharge'           },
  { model: documentModel,           key: 'document',            label: 'Documents'            },
  // ← add new model here, nothing else changes
];

// ─── Schema introspection ─────────────────────────────────────────────────────
// Reads the actual Mongoose schema paths to auto-discover field names & types.
// Frontend can use this to know what fields each collection has.

const getSchemaMap = () => {
  const map = {};
  for (const { model, key, label } of REGISTRY) {
    const paths = model.schema.paths;
    map[key] = {
      label,
      fields: Object.entries(paths)
        .filter(([path]) => !['__v', '_id'].includes(path))
        .map(([path, schemaType]) => ({
          path,
          type: schemaType.instance || typeof schemaType.defaultValue,
        })),
    };
  }
  return map;
};

module.exports = { REGISTRY, getSchemaMap };