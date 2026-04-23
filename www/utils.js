function safe(v) {
  return (v != null && isFinite(v)) ? Number(v) : 0;
}

function fmt(v, decimals = 0) {
  const n = (v != null && isFinite(v)) ? Number(v) : null;
  if (n === null) return 'N/A';
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString('en-AU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return (n < 0 ? '-$' : '$') + formatted;
}

function formatCurrency(v) {
  return fmt(v, 0);
}

if (typeof module !== 'undefined') module.exports = { safe, fmt, formatCurrency };
