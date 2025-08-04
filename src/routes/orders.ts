import { Router } from 'express';
import { cancelOrder } from '../controllers/orderController';

const router = Router();

router.post('/cancel', cancelOrder);

export default router;