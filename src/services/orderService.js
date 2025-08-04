exports.cancel = async (orderId, reason) => {
  return {
    orderId,
    cancelledAt: new Date().toISOString(),
    reason: reason || 'no reason provided',
    status: 'cancelled'
  };
};
