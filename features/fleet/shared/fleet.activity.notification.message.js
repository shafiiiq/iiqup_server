const joinOperatorNames = (operators = []) =>
  operators.map((operator) => operator.operatorName).filter(Boolean).join(', ');

const describeEquipment = (machine, regNo) => `${machine} (${regNo})`;

const describeDestination = ({ deployType, clientCompany, site }) =>
  deployType === 'company' ? `client ${clientCompany}` : site;

const buildToDestination = (record) => {
  const destination = describeDestination(record);
  return destination ? ` to ${destination}` : '';
};

const buildFromSite = (record) => (record.site ? ` from ${record.site}` : '');

const appendSentence = (sentence, extraSentence) => (extraSentence ? `${sentence} ${extraSentence}` : sentence);

const formatDay = (value) => new Date(value).toLocaleDateString('en-GB');

const buildOperatorsSentence = (operatorNames) => (operatorNames ? `Operators: ${operatorNames}.` : '');

const buildEquipmentSentence = (regNo) => (regNo ? `Equipment: ${regNo}.` : '');

const buildMobilizationMessage = (mobilization) => {
  const equipment = describeEquipment(mobilization.machine, mobilization.regNo);
  const operatorsSentence = buildOperatorsSentence(joinOperatorNames(mobilization.operators));

  if (mobilization.isOneDayMob && mobilization.demobDate) {
    return {
      title: 'One-Day Mobilization',
      body: appendSentence(
        `${equipment} mobilized${buildToDestination(mobilization)} for one day and demobilized on ${formatDay(mobilization.demobDate)}.`,
        operatorsSentence
      ),
    };
  }

  return {
    title: 'Equipment Mobilized',
    body: appendSentence(`${equipment} mobilized${buildToDestination(mobilization)}.`, operatorsSentence),
  };
};

const buildDemobilizationMessage = (demobilization) => {
  const equipment = describeEquipment(demobilization.machine, demobilization.regNo);
  const isShiftOnly = demobilization.status !== 'idle';

  if (isShiftOnly) {
    return {
      title: 'Operator Shift Demobilized',
      body: `Operator ${demobilization.operator} demobilized from ${equipment}.`,
    };
  }

  return {
    title: 'Equipment Demobilized',
    body: appendSentence(
      `${equipment} demobilized${buildFromSite(demobilization)}.`,
      buildOperatorsSentence(demobilization.operator)
    ),
  };
};

const buildShiftsAddedMessage = ({ machine, regNo, operators }) => ({
  title: 'Shifts Added',
  body: `Shifts added to ${describeEquipment(machine, regNo)}: ${joinOperatorNames(operators)}.`,
});

const buildOperatorReplacementMessage = (replacement) => {
  const equipment = describeEquipment(replacement.machine, replacement.regNo);

  return {
    title: 'Operator Replaced',
    body: replacement.replaceAll
      ? `All operators on ${equipment} replaced by ${replacement.replacedOperator}.`
      : `${replacement.currentOperator} replaced by ${replacement.replacedOperator} on ${equipment}.`,
  };
};

const buildEquipmentReplacementMessage = (replacement) => {
  const outgoingEquipment = describeEquipment(replacement.machine, replacement.regNo);
  const incomingEquipment = describeEquipment(replacement.replacedEquipmentMachine, replacement.replacedEquipmentRegNo);
  const siteSentence = replacement.site ? `Site: ${replacement.site}.` : '';

  return {
    title: 'Equipment Replaced',
    body: appendSentence(`${outgoingEquipment} replaced by ${incomingEquipment}.`, siteSentence),
  };
};

const buildOperatorMobilizationMessage = (operatorMobilization) => ({
  title: 'Operator Mobilized',
  body: appendSentence(
    `Operator ${operatorMobilization.operatorName} mobilized${buildToDestination(operatorMobilization)}.`,
    buildEquipmentSentence(operatorMobilization.regNo)
  ),
});

const buildOperatorDemobilizationMessage = (operatorMobilization) => ({
  title: 'Operator Demobilized',
  body: appendSentence(
    `Operator ${operatorMobilization.operatorName} demobilized${buildFromSite(operatorMobilization)}.`,
    buildEquipmentSentence(operatorMobilization.regNo)
  ),
});

const buildOperatorSwapMessage = (operatorMobilization) => ({
  title: 'Operator Replaced',
  body: appendSentence(
    `Operator ${operatorMobilization.outgoingOperatorName} replaced by ${operatorMobilization.incomingOperatorName}.`,
    buildEquipmentSentence(operatorMobilization.regNo)
  ),
});

module.exports = {
  buildMobilizationMessage,
  buildDemobilizationMessage,
  buildShiftsAddedMessage,
  buildOperatorReplacementMessage,
  buildEquipmentReplacementMessage,
  buildOperatorMobilizationMessage,
  buildOperatorDemobilizationMessage,
  buildOperatorSwapMessage,
};