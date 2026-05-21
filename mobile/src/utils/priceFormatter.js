export function formatPrice(amount) {
  const n = Number(amount) || 0;
  return n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
