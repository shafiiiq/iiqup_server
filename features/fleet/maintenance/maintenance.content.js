const { toPlainContent } = require('#core/signature/signature.plain')

const resolveEffectiveContent = (maintenance) =>
  toPlainContent({
    regNo: maintenance.regNo,
    serviceType: maintenance.serviceType,
    date: maintenance.date,
    equipment: maintenance.equipment,
    location: maintenance.location,
    operator: maintenance.operator,
    mechanics: maintenance.mechanics,
    remarks: maintenance.remarks,
    serviceHrs: maintenance.serviceHrs,
    nextServiceHrs: maintenance.nextServiceHrs,
    fullService: maintenance.fullService,
    oil: maintenance.oil,
    oilFilter: maintenance.oilFilter,
    fuelFilter: maintenance.fuelFilter,
    acFilter: maintenance.acFilter,
    waterSeparator: maintenance.waterSeparator,
    airFilter: maintenance.airFilter,
    tyreModel: maintenance.tyreModel,
    tyreNumber: maintenance.tyreNumber,
    batteryModel: maintenance.batteryModel,
    checklistItems: maintenance.checklistItems || [],
  })

module.exports = { resolveEffectiveContent }