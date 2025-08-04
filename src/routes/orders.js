const express = require('express');
const router = express.Router();
const { cancelOrder } = require('../controllers/orderController');

router.post('/cancel', cancelOrder);

module.exports = router;
