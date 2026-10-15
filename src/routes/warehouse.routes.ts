import { Router } from 'express';
import { warehouseController } from '../controllers/warehouse.controller';
import { asyncHandler } from '../middleware/asyncHandler';
import { authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { overviewQuerySchema, shipmentCodeParamSchema } from '../validators/warehouse.validator';

const router = Router();

/** `GET /api/warehouse/overview?siteId=WH-02` - the read model behind the 2D dashboard and the 3D yard. */
router.get('/overview', validate(overviewQuerySchema), asyncHandler(warehouseController.overview));

/** `GET /api/warehouse/materials` - Yard & Racks: all materials with the racks / staging cells that hold them. */
router.get('/materials', asyncHandler(warehouseController.materials));

/** `GET /api/warehouse/shipments?siteId=WH-02` - shipments with ledger links, party names and next actions. */
router.get('/shipments', validate(overviewQuerySchema), asyncHandler(warehouseController.shipments));

/** Admin / Manager: move a shipment to its next stage right now. */
router.post(
  '/shipments/:code/advance',
  authorize('Admin', 'Manager'),
  validate(shipmentCodeParamSchema),
  asyncHandler(warehouseController.advanceShipment)
);

/** Admin / Manager: reset the facility layer to the seeded demo state. */
router.post('/reseed', authorize('Admin', 'Manager'), asyncHandler(warehouseController.reseed));

export default router;
