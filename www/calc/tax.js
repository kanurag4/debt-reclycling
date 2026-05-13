// Australian income tax + Medicare levy 2026-27
function marginalRate(income) {
  const n = (income != null && isFinite(income)) ? Number(income) : 0;
  if (n <= 0)       return 0;
  if (n <= 18200)   return 0;
  if (n <= 45000)   return 0.17;
  if (n <= 135000)  return 0.32;
  if (n <= 190000)  return 0.39;
  return 0.47;
}

if (typeof module !== 'undefined') module.exports = { marginalRate };
