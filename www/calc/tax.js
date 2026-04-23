// Australian income tax + Medicare levy 2024-25
function marginalRate(income) {
  const n = (income != null && isFinite(income)) ? Number(income) : 0;
  if (n <= 0)       return 0;
  if (n <= 18200)   return 0;
  if (n <= 45000)   return 0.21;
  if (n <= 120000)  return 0.345;
  if (n <= 180000)  return 0.39;
  return 0.47;
}

if (typeof module !== 'undefined') module.exports = { marginalRate };
