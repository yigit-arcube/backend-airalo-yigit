const orderService = require('../services/orderService');

exports.cancelOrder = async (req, res, next) => {
  try {
    const { orderId, reason } = req.body;
    if (!orderId) return res.status(400).json({ error: 'orderId required' });

    const result = await orderService.cancel(orderId, reason);
    res.json({ success: true, data: result });
  } catch (e) {
    next(e);
  }
};
