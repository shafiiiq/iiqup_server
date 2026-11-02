const formatQarAmount = (value) =>
  Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const humanizeStatus = (status) => {
  const text = String(status || '').replace(/_/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '-';
};

module.exports = { formatQarAmount, humanizeStatus };