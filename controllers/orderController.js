const Order = require('../models/Order');
const Product=require("../models/Product");
const { productRegistry,orderEscrow, ethers, buyerWallet, adminWallet } = require('../services/blockchain');

/**
 * Place an order: buyer calls on-chain placeOrder and saves meta to DB
 * POST /api/orders
 * Body: { productId, priceETH }
 */
async function placeOrder(req, res, next) {
  try {
    const { productId, priceETH } = req.body;
    if (!productId) return res.status(400).json({ error: 'productId is required' });
    if (!priceETH) return res.status(400).json({ error: 'priceETH is required' });

    // Find product off-chain by UUID
    const product = await Product.findOne({ productId: productId });
    if (!product || typeof product.onChainId !== 'number') {
      return res.status(400).json({ error: 'Product not registered on-chain' });
    }
    const numericProductId = product.onChainId;

    // Fetch on-chain product details for debug/logging
    const onChainProduct = await productRegistry.getProduct(numericProductId);
    console.log('On-chain product data:', onChainProduct);

    const priceWei = ethers.utils.parseEther(priceETH.toString());

    const contractWithBuyer = orderEscrow.connect(buyerWallet);

    const tx = await contractWithBuyer.placeOrder(numericProductId, { value: priceWei });
    const receipt = await tx.wait();

    const event = receipt.events.find((e) => e.event === 'OrderPlaced');
    if (!event) return res.status(500).json({ error: 'OrderPlaced event not found' });

    const orderId = event.args.orderId.toString();
    const seller = event.args.seller.toLowerCase();
    const buyer = event.args.buyer.toLowerCase();

    // Save order metadata off-chain in DB
    const orderDoc = new Order({
      orderId,
      productId,
      buyer,
      seller,
      valueWei: priceWei.toString(),
      status: 0, // Created
      timestamp: new Date(),
    });

    await orderDoc.save();

    res.status(201).json({
      message: 'Order placed successfully',
      orderId,
      txHash: tx.hash,
    });
  } catch (error) {
    console.error('placeOrder error:', error);
    next(error);
  }
}


/**
 * Buyer confirms delivery, releases funds on-chain and updates DB status
 * POST /api/orders/:id/deliver
 */
async function confirmDelivery(req, res, next) {
  try {
    const orderId = req.params.id;
    if (!orderId) return res.status(400).json({ error: 'Order ID required' });

    const contractWithBuyer = orderEscrow.connect(buyerWallet);

    const tx = await contractWithBuyer.confirmDelivery(orderId);
    await tx.wait();

    // Update DB order status to Completed (status 4)
    const order = await Order.findOneAndUpdate(
      { orderId },
      { status: 4, timestamp: new Date() },
      { new: true }
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });

    res.json({ message: 'Delivery confirmed, funds released', txHash: tx.hash });
  } catch (error) {
    console.error('confirmDelivery error:', error);
    next(error);
  }
}

/**
 * Open dispute for an order (buyer/seller)
 * POST /api/orders/:id/dispute
 * Body: { role } - "buyer" or "seller"
 */
async function openDispute(req, res, next) {
  try {
    const orderId = req.params.id;
    const { role } = req.body;
    if (!orderId) return res.status(400).json({ error: 'Order ID required' });
    if (!role || !['buyer', 'seller'].includes(role.toLowerCase())) {
      return res.status(400).json({ error: 'Valid role ("buyer" or "seller") required' });
    }

    const signerWallet = role.toLowerCase() === 'buyer' ? buyerWallet : adminWallet;

    const contractWithSigner = orderEscrow.connect(signerWallet);

    const tx = await contractWithSigner.openDispute(orderId);
    await tx.wait();

    // Update DB order status to Disputed (status 2)
    const order = await Order.findOneAndUpdate(
      { orderId },
      { status: 2, timestamp: new Date() },
      { new: true }
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });

    res.json({ message: 'Dispute opened', txHash: tx.hash });
  } catch (error) {
    console.error('openDispute error:', error);
    next(error);
  }
}

/**
 * Admin resolves dispute: refund buyer or pay seller
 * POST /api/orders/:id/resolve
 * Body: { refundBuyer: boolean }
 */
async function resolveDispute(req, res, next) {
  try {
    const orderId = req.params.id;
    const { refundBuyer } = req.body;
    if (!orderId) return res.status(400).json({ error: 'Order ID required' });
    if (typeof refundBuyer !== 'boolean') {
      return res.status(400).json({ error: 'refundBuyer flag required and must be boolean' });
    }

    const contractWithAdmin = orderEscrow.connect(adminWallet);

    const tx = await contractWithAdmin.resolveDispute(orderId, refundBuyer);
    await tx.wait();

    // Update DB order status accordingly
    const newStatus = refundBuyer ? 3 : 4; // Refunded=3, Completed=4
    const order = await Order.findOneAndUpdate(
      { orderId },
      { status: newStatus, timestamp: new Date() },
      { new: true }
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });

    res.json({ message: 'Dispute resolved', refundBuyer, txHash: tx.hash });
  } catch (error) {
    console.error('resolveDispute error:', error);
    next(error);
  }
}

/**
 * Get order details by orderId (from DB)
 * GET /api/orders/:id
 */
async function getOrder(req, res, next) {
  try {
    const orderId = req.params.id;
    if (!orderId) return res.status(400).json({ error: 'Order ID required' });

    const order = await Order.findOne({ orderId }).lean();
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Map numeric status to string for convenience
    const statusNames = ['Created', 'Delivered', 'Disputed', 'Refunded', 'Completed'];
    const statusName = statusNames[order.status] || 'Unknown';

    res.json({
      ...order,
      valueEth: ethers.utils.formatEther(order.valueWei),
      statusName,
      datetime: order.timestamp.toISOString(),
    });
  } catch (error) {
    console.error('getOrder error:', error);
    next(error);
  }
}

/**
 * List all orders by buyer address (from DB)
 * GET /api/orders/buyer/:address
 */
async function getOrdersByBuyer(req, res, next) {
  try {
    const buyerAddress = req.params.address;
    if (!buyerAddress) return res.status(400).json({ error: 'Buyer address required' });

    const orders = await Order.find({ buyer: buyerAddress.toLowerCase() }).lean();

    // Map order data with valueEth and readable timestamp
    const statusNames = ['Created', 'Delivered', 'Disputed', 'Refunded', 'Completed'];

    const response = orders.map((order) => ({
      id: order.orderId,
      productId: order.productId,
      seller: order.seller,
      value: ethers.utils.formatEther(order.valueWei),
      status: order.status,
      statusName: statusNames[order.status] || 'Unknown',
      timestamp: order.timestamp,
    }));

    res.json(response);
  } catch (error) {
    console.error('getOrdersByBuyer error:', error);
    next(error);
  }
}

module.exports = {
  placeOrder,
  confirmDelivery,
  openDispute,
  resolveDispute,
  getOrder,
  getOrdersByBuyer,
};
