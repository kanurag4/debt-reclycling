function monthlyPayment(principal, annualRate, years) {
  if (principal <= 0) return 0;
  const months = years * 12;
  if (annualRate === 0) return principal / months;
  const r = annualRate / 12;
  return principal * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

// Returns array of { month, payment, interest, principal, balance }
function loanSchedule(principal, annualRate, years) {
  if (principal <= 0) return [];
  const payment = monthlyPayment(principal, annualRate, years);
  const r = annualRate / 12;
  const rows = [];
  let balance = principal;
  const months = years * 12;

  for (let m = 1; m <= months; m++) {
    const interest = balance * r;
    const principalPaid = Math.min(payment - interest, balance);
    balance = Math.max(balance - principalPaid, 0);
    rows.push({ month: m, payment, interest, principalPaid, balance });
    if (balance === 0) break;
  }
  return rows;
}

if (typeof module !== 'undefined') module.exports = { monthlyPayment, loanSchedule };
