const Order = require('../models/Order');
const Product = require("../models/Product");
const { productRegistry, orderEscrow, ethers } = require('../services/blockchain');

/**
 * Place an order: user signs + sends tx via MetaMask, backend only saves meta
 * POST /api/orders
 * Body: { productId, txHash, buyer }
 */
async function placeOrder(req, res, next) {
  try {
    const { productId, txHash, buyer } = req.body;
    if (!productId) return res.status(400).json({ error: 'productId is required' });
    if (!txHash) return res.status(400).json({ error: 'txHash is required' });
    if (!buyer) return res.status(400).json({ error: 'buyer address required' });

    // Find product off-chain by UUID
    const product = await Product.findOne({ productId });
    if (!product || typeof product.onChainId !== 'number') {
      return res.status(400).json({ error: 'Product not registered on-chain' });
    }

    // Get tx receipt from blockchain
    const receipt = await productRegistry.provider.getTransactionReceipt(txHash);
    if (!receipt) return res.status(400).json({ error: 'Transaction not found on-chain' });

    // Parse events
    const event = receipt.logs
      .map(log => {
        try {
          return orderEscrow.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find(e => e && e.name === 'OrderPlaced');

    if (!event) return res.status(400).json({ error: 'OrderPlaced event not found in tx' });

    const orderId = event.args.orderId.toString();
    const seller = event.args.seller.toLowerCase();
    const buyerAddr = event.args.buyer.toLowerCase();
    const valueWei = event.args.value.toString();

    // Save order metadata
    const orderDoc = new Order({
      orderId,
      productId,
      buyer: buyerAddr,
      seller,
      valueWei,
      status: 0, // Created
      timestamp: new Date(),
    });

    await orderDoc.save();

    res.status(201).json({
      message: 'Order placed successfully',
      orderId,
      txHash,
    });
  } catch (error) {
    console.error('placeOrder error:', error);
    next(error);
  }
}

/**
 * Buyer confirms delivery: tx signed via MetaMask
 * POST /api/orders/:id/deliver
 * Body: { txHash }
 */
async function confirmDelivery(req, res, next) {
  try {
    const orderId = req.params.id;
    const { txHash } = req.body;
    if (!orderId) return res.status(400).json({ error: 'Order ID required' });
    if (!txHash) return res.status(400).json({ error: 'txHash required' });

    const receipt = await productRegistry.provider.getTransactionReceipt(txHash);
    if (!receipt) return res.status(400).json({ error: 'Transaction not found' });

    // Update DB order status
    const order = await Order.findOneAndUpdate(
      { orderId },
      { status: 4, timestamp: new Date() }, // Completed
      { new: true }
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Mark product as sold
    if (order.productId) {
      await Product.findOneAndUpdate(
        { productId: order.productId },
        { forSale: false }
      );
    }

    res.json({ message: 'Delivery confirmed, funds released', txHash });
  } catch (error) {
    console.error('confirmDelivery error:', error);
    next(error);
  }
}

/**
 * Open dispute: buyer/seller triggers via MetaMask
 * POST /api/orders/:id/dispute
 * Body: { txHash }
 */
async function openDispute(req, res, next) {
  try {
    const orderId = req.params.id;
    const { txHash } = req.body;
    if (!orderId) return res.status(400).json({ error: 'Order ID required' });
    if (!txHash) return res.status(400).json({ error: 'txHash required' });

    const receipt = await productRegistry.provider.getTransactionReceipt(txHash);
    if (!receipt) return res.status(400).json({ error: 'Transaction not found' });

    // Update DB
    const order = await Order.findOneAndUpdate(
      { orderId },
      { status: 2, timestamp: new Date() }, // Disputed
      { new: true }
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });

    res.json({ message: 'Dispute opened', txHash });
  } catch (error) {
    console.error('openDispute error:', error);
    next(error);
  }
}

/**
 * Admin resolves dispute: via MetaMask
 * POST /api/orders/:id/resolve
 * Body: { txHash, refundBuyer }
 */
async function resolveDispute(req, res, next) {
  try {
    const orderId = req.params.id;
    const { txHash, refundBuyer } = req.body;
    if (!orderId) return res.status(400).json({ error: 'Order ID required' });
    if (!txHash) return res.status(400).json({ error: 'txHash required' });
    if (typeof refundBuyer !== 'boolean') {
      return res.status(400).json({ error: 'refundBuyer must be boolean' });
    }

    const receipt = await productRegistry.provider.getTransactionReceipt(txHash);
    if (!receipt) return res.status(400).json({ error: 'Transaction not found' });

    const newStatus = refundBuyer ? 3 : 4; // Refunded / Completed
    const order = await Order.findOneAndUpdate(
      { orderId },
      { status: newStatus, timestamp: new Date() },
      { new: true }
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });

    res.json({ message: 'Dispute resolved', refundBuyer, txHash });
  } catch (error) {
    console.error('resolveDispute error:', error);
    next(error);
  }
}

/**
 * Get order details by orderId
 * GET /api/orders/:id
 */
async function getOrder(req, res, next) {
  try {
    const orderId = req.params.id;
    if (!orderId) return res.status(400).json({ error: 'Order ID required' });

    const order = await Order.findOne({ orderId }).lean();
    if (!order) return res.status(404).json({ error: 'Order not found' });

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
 * List orders by buyer
 * GET /api/orders/buyer/:address
 */
async function getOrdersByBuyer(req, res, next) {
  try {
    const buyerAddress = req.params.address;
    if (!buyerAddress) return res.status(400).json({ error: 'Buyer address required' });

    const orders = await Order.find({ buyer: buyerAddress.toLowerCase() }).lean();
    const statusNames = ['Created', 'Delivered', 'Disputed', 'Refunded', 'Completed'];

    res.json(
      orders.map(order => ({
        id: order.orderId,
        productId: order.productId,
        seller: order.seller,
        value: ethers.utils.formatEther(order.valueWei),
        status: order.status,
        statusName: statusNames[order.status] || 'Unknown',
        timestamp: order.timestamp,
      }))
    );
  } catch (error) {
    console.error('getOrdersByBuyer error:', error);
    next(error);
  }
}


/**
 * Get all disputed orders (status = 2)
 * GET /api/orders/disputed
 */
async function getDisputedOrders(req, res, next) {
  try {
    const disputedOrders = await Order.find({ status: 2 }).lean();
    if (!disputedOrders || disputedOrders.length === 0) {
      return res.status(404).json({ error: 'No disputed orders found' });
    }

    const statusNames = ['Created', 'Delivered', 'Disputed', 'Refunded', 'Completed'];

    res.json(
      disputedOrders.map(order => ({
        id: order.orderId,
        productId: order.productId,
        buyer: order.buyer,
        seller: order.seller,
        value: ethers.utils.formatEther(order.valueWei),
        status: order.status,
        statusName: statusNames[order.status] || 'Unknown',
        timestamp: order.timestamp,
      }))
    );
  } catch (error) {
    console.error('getDisputedOrders error:', error);
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
  getDisputedOrders
};
