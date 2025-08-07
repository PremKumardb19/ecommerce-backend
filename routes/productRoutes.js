const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const multer = require('multer');

// Setup multer for file uploads (memory storage here, adjust as needed)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Endpoint to upload product image + metadata and register product on-chain
router.post('/', upload.single('image'), productController.registerProduct);

// List all products available for sale
router.get('/for-sale', productController.getAllForSaleProductIds);

// Get product details by product ID
router.get('/:id', productController.getProduct);

// Get all product IDs for a vendor address
router.get('/vendor/:address', productController.getProductsByVendor);

// Update product info (owner only)
router.put('/:id/update', productController.updateProduct);

// Transfer ownership of a product after purchase
router.post('/:id/transfer', productController.transferProductOwnership);


module.exports = router;
