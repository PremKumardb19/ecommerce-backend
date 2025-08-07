const ipfsService = require('../services/ipfsService');
const { productRegistry } = require('../services/blockchain');
const { ethers } = require('ethers');

/**
 * Upload product image and metadata to IPFS, register product on-chain
 * POST /api/products
 */
async function registerProduct(req, res, next) {
  try {
    const { name, description, priceETH } = req.body;
    const file = req.file; // <-- Fix: multer single file

    if (!name || !priceETH || !file) {
      return res.status(400).json({ error: 'Missing required fields: name, priceETH, image' });
    }

    if (isNaN(priceETH)) {
      return res.status(400).json({ error: 'Invalid price format' });
    }

    // Step 1: Upload image file to IPFS via Pinata
    const imageHash = await ipfsService.uploadFileToIPFS(file);

    // Step 2: Prepare metadata JSON
    const metadata = {
      name,
      description,
      image: imageHash,
      timestamp: new Date().toISOString(),
    };

    const provenanceHash = await ipfsService.uploadJSONToIPFS(metadata);

    // Step 3: Convert price to wei
    const priceWei = ethers.utils.parseEther(priceETH.toString());

    // Step 4: Call smart contract
    const tx = await productRegistry.registerProduct(
      name,
      description,
      imageHash,
      provenanceHash,
      priceWei
    );
    const receipt = await tx.wait();

    // Step 5: Extract productId from emitted event
    const event = receipt.events?.find(e => e.event === 'ProductRegistered');
    if (!event) return res.status(500).json({ error: 'ProductRegistered event not found' });

    const productId = event.args.productId.toString();

    res.status(201).json({
      message: 'Product registered successfully',
      productId,
      txHash: tx.hash,
      imageHash,
      provenanceHash,
    });
  } catch (error) {
    console.error('registerProduct error:', error);
    next(error);
  }
}

/**
 * GET /api/products/:id
 */
async function getProduct(req, res, next) {
  try {
    const productId = req.params.id;
    if (!productId) return res.status(400).json({ error: 'Product ID is required' });

    const productRaw = await productRegistry.getProduct(productId);

    // productRaw is an array-like object with entries as per Product struct:
    // [
    //    BigNumber id,
    //    address owner,
    //    string name,
    //    string description,
    //    string imageHash,
    //    string provenanceHash,
    //    BigNumber priceWei,
    //    bool forSale,
    //    BigNumber timestamp
    // ]

    // Convert and map to named fields
    const product = {
      id: productRaw.id.toString(),
      owner: productRaw.owner,
      name: productRaw.name,
      description: productRaw.description,
      imageHash: productRaw.imageHash,
      provenanceHash: productRaw.provenanceHash,
      priceWei: productRaw.priceWei.toString(),
      priceEth: ethers.utils.formatEther(productRaw.priceWei),
      forSale: productRaw.forSale,
      timestamp: productRaw.timestamp.toNumber(),
      lastUpdated: new Date(productRaw.timestamp.toNumber() * 1000).toISOString(),
    };

    res.json(product);
  } catch (error) {
    console.error('getProduct error:', error);
    next(error);
  }
}


/**
 * GET /api/products/vendor/:address
 */
async function getProductsByVendor(req, res, next) {
  try {
    const vendorAddress = req.params.address;
    if (!vendorAddress) return res.status(400).json({ error: 'Vendor address is required' });

    const productIds = await productRegistry.getProductsByVendor(vendorAddress);
    res.json(productIds.map(id => id.toString()));
  } catch (error) {
    console.error('getProductsByVendor error:', error);
    next(error);
  }
}

/**
 * PUT /api/products/:id/update
 */
async function updateProduct(req, res, next) {
  try {
    const productId = req.params.id;
    const {
      name,
      description,
      imageHash,
      provenanceHash,
      priceETH,
      forSale,
    } = req.body;

    if (!productId) return res.status(400).json({ error: 'Product ID is required' });

    const priceWei = priceETH ? ethers.utils.parseEther(priceETH.toString()) : 0;

    const tx = await productRegistry.updateProduct(
      productId,
      name || '',
      description || '',
      imageHash || '',
      provenanceHash || '',
      priceWei,
      forSale !== undefined ? Boolean(forSale) : true
    );

    await tx.wait();

    res.json({ message: 'Product updated successfully', txHash: tx.hash });
  } catch (error) {
    console.error('updateProduct error:', error);
    next(error);
  }
}

/**
 * POST /api/products/:id/transfer
 */
async function transferProductOwnership(req, res, next) {
  try {
    const productId = req.params.id;
    const { newOwner } = req.body;

    if (!productId || !newOwner) {
      return res.status(400).json({ error: 'Product ID and newOwner address are required' });
    }

    const tx = await productRegistry.transferProductOwnership(productId, newOwner);
    await tx.wait();

    res.json({ message: 'Ownership transferred successfully', txHash: tx.hash });
  } catch (error) {
    console.error('transferProductOwnership error:', error);
    next(error);
  }
}

/**
 * GET /api/products/for-sale
 */
async function getAllForSaleProductIds(req, res, next) {
  try {
    const productIds = await productRegistry.getAllForSaleProductIds();
    res.json(productIds.map(id => id.toString()));
  } catch (error) {
    console.error('getAllForSaleProductIds error:', error);
    next(error);
  }
}

module.exports = {
  registerProduct,
  getProduct,
  getProductsByVendor,
  updateProduct,
  transferProductOwnership,
  getAllForSaleProductIds,
};
