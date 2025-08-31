const { v4: uuidv4 } = require('uuid');
const ipfsService = require('../services/ipfsService');
const Product = require('../models/Product');
const { productRegistry, ethers, adminWallet } = require('../services/blockchain'); 
// sellerWallet should correspond to req.user.address for on-chain signing

/**
 * Upload product image and metadata to IPFS, save product in DB (off-chain only),
 * then asynchronously register the product on-chain in background.
 * POST /api/products
 * Auth: JWT (req.user.address)
 */
async function registerProduct(req, res, next) {
  try {
    const { name, description = '', priceETH } = req.body;
    const file = req.file;
    const owner = req.user?.address?.toLowerCase();

    if (!owner) {
      return res.status(401).json({ error: 'Authentication required to register products.' });
    }
    if (!name || !priceETH || !file) {
      return res.status(400).json({ error: 'Missing required fields: name, priceETH, image' });
    }
    if (isNaN(priceETH)) {
      return res.status(400).json({ error: 'Invalid priceETH format' });
    }

    // Upload image file to IPFS
    const imageHash = await ipfsService.uploadFileToIPFS(file);

    // Prepare and upload metadata JSON including image hash for provenance
    const metadata = { name, description, image: imageHash, timestamp: new Date().toISOString() };
    const provenanceHash = await ipfsService.uploadJSONToIPFS(metadata);

    // Convert priceETH to wei
    const priceWei = ethers.utils.parseEther(priceETH.toString()).toString();

    // Generate a UUID as off-chain productId
    const newProductId = uuidv4();

    // Save product metadata off-chain in DB, onChainId empty for now
    const productDoc = new Product({
      productId: newProductId,
      owner,
      name,
      description,
      imageHash,
      provenanceHash,
      priceWei,
      forSale: true,
      onChainId: undefined,
    });

    await productDoc.save();

    // Respond immediately to client, product saved off-chain
    res.status(201).json({
      message: 'Product registered successfully (off-chain). On-chain registration pending.',
      productId: newProductId,
      imageHash,
      provenanceHash,
    });

    // Asynchronously register product on-chain in the background
    process.nextTick(async () => {
      try {
        const contractWithSeller = productRegistry.connect(adminWallet);
        const tx = await contractWithSeller.registerProduct(
          name,
          description,
          imageHash,
          provenanceHash,
          ethers.BigNumber.from(priceWei)
        );
        const receipt = await tx.wait();

        const event = receipt.events.find(e => e.event === 'ProductRegistered');
        if (event) {
          const onChainId = event.args.productId.toNumber();

          // Update product in DB setting the onChainId
          await Product.findOneAndUpdate(
            { productId: newProductId },
            { onChainId }
          );
          console.log(`On-chain registration complete for product ${newProductId}, onChainId: ${onChainId}`);
        } else {
          console.error('On-chain ProductRegistered event not found for product:', newProductId);
        }
      } catch (err) {
        console.error('On-chain product registration failed for product:', newProductId, err);
      }
    });
  } catch (error) {
    console.error('registerProduct error:', error);
    next(error);
  }
}


/**
 * Get product details from DB by UUID productId
 * GET /api/products/:id
 */
async function getProduct(req, res, next) {
  try {
    const { id: productId } = req.params;
    if (!productId) {
      return res.status(400).json({ error: 'Product ID is required' });
    }

    const product = await Product.findOne({ productId }).lean();
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    console.log('Raw priceWei from DB:', product.priceWei, typeof product.priceWei);
    console.log("converted",ethers.utils.formatEther(ethers.BigNumber.from(product.priceWei)))

    res.json({
      ...product,
      priceEth: ethers.utils.formatEther(ethers.BigNumber.from(product.priceWei))
    });
  } catch (error) {
    console.error('getProduct error:', error);
    next(error);
  }
}

/**
 * Get products by vendor address from DB
 * GET /api/products/vendor/:address
 */
async function getProductsByVendor(req, res, next) {
  try {
    const vendorAddress = req.params.address;
    if (!vendorAddress) {
      return res.status(400).json({ error: 'Vendor address is required' });
    }

    const products = await Product.find({ owner: vendorAddress.toLowerCase() }).lean();
    const productIds = products.map((p) => p.productId);

    res.json(productIds);
  } catch (error) {
    console.error('getProductsByVendor error:', error);
    next(error);
  }
}

/**
 * Update product metadata in DB (no blockchain update except ownership transfer)
 * PUT /api/products/:id/update
 */
async function updateProduct(req, res, next) {
  try {
    const { id: productId } = req.params;
    if (!productId) {
      return res.status(400).json({ error: 'Product ID is required' });
    }

    const {
      name,
      description,
      imageHash,
      provenanceHash,
      priceETH,
      forSale,
    } = req.body;

    const product = await Product.findOne({ productId });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (name !== undefined) product.name = name;
    if (description !== undefined) product.description = description;
    if (imageHash !== undefined) product.imageHash = imageHash;
    if (provenanceHash !== undefined) product.provenanceHash = provenanceHash;
    if (forSale !== undefined) product.forSale = Boolean(forSale);
    if (priceETH !== undefined) {
      if (isNaN(priceETH)) {
        return res.status(400).json({ error: 'Invalid priceETH format' });
      }
      product.priceWei = ethers.utils.parseEther(priceETH.toString()).toString();
    }

    await product.save();

    res.json({
      message: 'Product updated successfully',
      product: {
        ...product.toObject(),
        priceEth: ethers.utils.formatEther(product.priceWei),
      },
    });
  } catch (error) {
    console.error('updateProduct error:', error);
    next(error);
  }
}

/**
 * Transfer product ownership on-chain + update DB ownership
 * POST /api/products/:id/transfer
 */
async function transferProductOwnership(req, res, next) {
  try {
    const { id: productId } = req.params;
    const { newOwner } = req.body;

    if (!productId || !newOwner) {
      return res.status(400).json({ error: 'Product ID and newOwner address are required' });
    }

    // Call on-chain transfer product ownership
    const tx = await productRegistry.transferProductOwnership(productId, newOwner.toLowerCase());
    await tx.wait();

    // Update ownership in DB
    const product = await Product.findOneAndUpdate(
      { productId },
      { owner: newOwner.toLowerCase() },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ error: 'Product not found after ownership transfer' });
    }

    res.json({
      message: 'Ownership transferred successfully',
      productId,
      newOwner,
      txHash: tx.hash,
    });
  } catch (error) {
    console.error('transferProductOwnership error:', error);
    next(error);
  }
}

/**
 * Get all product IDs currently for sale from DB
 * GET /api/products/for-sale
 */
async function getAllForSaleProductIds(req, res, next) {
  try {
    const products = await Product.find({ forSale: true }, 'productId').lean();
    const productIds = products.map((p) => p.productId);
    res.json(productIds);
  } catch (error) {
    console.error('getAllForSaleProductIds error:', error);
    next(error);
  }
}

/**
 * Get all products from DB
 * GET /api/products
 */
async function getAllProducts(req, res, next) {
  try {
    const products = await Product.find({}).lean();

    // Convert priceWei → priceEth for convenience
    const formattedProducts = products.map((p) => ({
      ...p,
      priceEth: ethers.utils.formatEther(ethers.BigNumber.from(p.priceWei)),
    }));

    res.json(formattedProducts);
  } catch (error) {
    console.error('getAllProducts error:', error);
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
  getAllProducts
};
