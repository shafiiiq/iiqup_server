const { formatDate } = require('#shared/email/email.instance');
const { buildRow, buildSection } = require('./activity.format');

const describeChainEvent = (event) => {
  if (event.type === 'mobilized') {
    const destination =
      event.deployType === 'company'
        ? `client ${event.clientCompany}`
        : event.site
          ? `site ${event.site}`
          : 'an unspecified location';
    return `${event.machine || ''} (${event.regNo}) mobilized to ${destination}`;
  }

  if (event.type === 'demobilized') {
    return `${event.machine || ''} (${event.regNo}) demobilized`;
  }

  if (event.type === 'replaced') {
    return `${event.fromMachine || ''} (${event.fromRegNo}) replaced by ${event.toMachine || ''} (${event.toRegNo})`;
  }

  return '';
};

const describeEquipmentStatus = (equipment) => {
  if (equipment.found === false) return 'Record not found';

  const statusParts = [equipment.isActive ? `Active (${equipment.status})` : 'Idle'];
  if (equipment.site) statusParts.push(`Site: ${equipment.site}`);
  if (equipment.location) statusParts.push(`Location: ${equipment.location}`);
  return statusParts.join(' · ');
};

const buildChainSections = (chainInfo) => {
  if (!chainInfo?.timeline || chainInfo.timeline.length <= 1) return [];

  return [
    buildSection(
      'Equipment History',
      chainInfo.timeline.map((event) => buildRow(formatDate(event.date), describeChainEvent(event)))
    ),
    buildSection('Current Status of Chain Equipment', [
      ...chainInfo.equipmentStatuses.map((equipment) =>
        buildRow(
          equipment.found === false ? equipment.regNo : `${equipment.machine || ''} (${equipment.regNo})`,
          describeEquipmentStatus(equipment)
        )
      ),
      buildRow(
        'Chain Status',
        chainInfo.isChainClosed ? 'Closed — no equipment currently active on this chain' : 'Still active'
      ),
    ]),
  ];
};

module.exports = { buildChainSections };