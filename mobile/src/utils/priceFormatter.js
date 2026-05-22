export function formatIndianCurrency(amount) {
  if (amount === undefined || amount === null) return '0.00';
  const num = Number(amount);
  if (isNaN(num)) return '0.00';
  const isNegative = num < 0;
  const absNum = Math.abs(num).toFixed(2);
  const parts = absNum.split('.');
  let lastThree = parts[0].substring(parts[0].length - 3);
  const otherParts = parts[0].substring(0, parts[0].length - 3);
  if (otherParts !== '') {
    lastThree = ',' + lastThree;
  }
  const formattedInt = otherParts.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;
  const res = formattedInt + '.' + parts[1];
  return isNegative ? '-' + res : res;
}

export function formatPrice(amount) {
  return formatIndianCurrency(amount);
}
