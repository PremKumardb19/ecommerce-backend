const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const multer = require('multer');
const authMiddleware = require('../middlewares/auth'); // Import your JWT auth middleware

const storage = multer.memoryStorage();
const upload = multer({ storage });

// Upload product image + metadata and register product off-chain + IPFS (auth required)
router.post('/', authMiddleware, upload.single('image'), productController.registerProduct);

//  Get all products (full data, not just IDs)
router.get('/', productController.getAllProducts);

// List all products available for sale (IDs only)
router.get('/for-sale', productController.getAllForSaleProductIds);

// Get all product IDs for a vendor address
router.get('/vendor/:address', productController.getProductsByVendor);

// Get product details by product ID
router.get('/:id', productController.getProduct);

// Update product info (owner only, auth required)
router.put('/:id/update', authMiddleware, productController.updateProduct);

// Transfer ownership of a product after purchase (on-chain, auth required)
router.post('/:id/transfer', authMiddleware, productController.transferProductOwnership);

module.exports = router;
