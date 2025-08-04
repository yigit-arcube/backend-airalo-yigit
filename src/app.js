const express = require('express');
const ordersRouter = require('./routes/orders');

const app = express();
app.use(express.json());

app.use('/orders', ordersRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
