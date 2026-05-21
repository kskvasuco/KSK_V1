export function isBalanceCleared(order) {
  const totalAmount =
    order.items?.reduce((sum, item) => {
      const qty = item.quantityOrdered || 0;
      const effectiveQty = item.isCustom && qty === 0 ? 1 : qty;
      return sum + effectiveQty * (item.price || 0);
    }, 0) || 0;

  let adjustmentsTotal = 0;
  order.adjustments?.forEach((adj) => {
    if (adj.type === 'charge') adjustmentsTotal += adj.amount;
    else if (['discount', 'advance', 'payment', 'less'].includes(adj.type)) {
      adjustmentsTotal -= adj.amount;
    }
  });
  return totalAmount + adjustmentsTotal <= 0.01;
}

export function filterOrdersByStatus(orders, status) {
  if (!status) return orders;
  return orders.filter((order) => {
    if (status === 'pending') return order.status === 'Ordered';
    if (status === 'rate-request') return order.status === 'Rate Requested';
    if (status === 'rate-approved') return order.status === 'Rate Approved';
    if (status === 'confirmed') return order.status === 'Confirmed';
    if (status === 'dispatch') {
      return order.status.startsWith('Dispatch') || order.status === 'Partially Delivered';
    }
    if (status === 'balance') {
      const relevant =
        order.status === 'Delivered' ||
        order.status.startsWith('Dispatch') ||
        order.status === 'Partially Delivered' ||
        order.status === 'Completed';
      return relevant && !isBalanceCleared(order);
    }
    if (status === 'paused') return order.status === 'Paused';
    if (status === 'hold') return order.status === 'Hold';
    if (status === 'delivered') {
      return order.status === 'Delivered' || order.status === 'Completed';
    }
    if (status === 'cancelled') return order.status === 'Cancelled';
    if (status === 'advance') {
      return order.adjustments?.some((a) => a.type === 'advance');
    }
    if (status === 'completed') return order.status === 'Completed';
    return order.status === status;
  });
}
