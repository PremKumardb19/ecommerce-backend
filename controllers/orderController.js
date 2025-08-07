const { orderEscrow, ethers, buyerWallet,adminWallet, provider } = require('../services/blockchain');

/**
 * Place an order: buyer calls placeOrder with productId and pays price attached
 * POST /api/orders
 * Body: { productId }
 */
async function placeOrder(req, res, next) {
  try {
    const { productId } = req.body;
    if (!productId) {
      return res.status(400).json({ error: 'productId is required' });
    }

    // Get signer wallet (buyer wallet connected)
    const contractWithBuyer = orderEscrow.connect(buyerWallet);

    // Fetch product price from ProductRegistry for payment amount if needed via blockchain or frontend (assumed front sends value)
    // Here we assume frontend sends productId and buyerWallet has enough balance.

    // Place order transaction with ETH value (price needs to come from product on frontend, or separately fetched)
    // For demo, assume price is fetched off-chain or cached in frontend

    // We need product price, so better to fetch it from ProductRegistry via blockchain or cache in backend
    // For simplicity, let's assume frontend sends price. Ideally, your frontend calls /api/products/:id first

    // Let's fetch price from a combined blockchain call from OrderEscrow or ProductRegistry if you add that service here
    // Here we just proceed to placeOrder with no value passed. This will fail on blockchain if value not attached.

    // We expect frontend sends the exact price in body to be sent as value
    const priceETH = req.body.priceETH;
    if (!priceETH) {
      return res.status(400).json({ error: 'priceETH is required and must match product price' });
    }
    const priceWei = ethers.utils.parseEther(priceETH.toString());
    console.log("buying with wallet: ",buyerWallet)
    const tx = await contractWithBuyer.placeOrder(productId, { value: priceWei });
    const receipt = await tx.wait();

    const event = receipt.events.find(e => e.event === 'OrderPlaced');
    const orderId = event.args.orderId.toString();

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
 * Confirm delivery by buyer, release funds to seller
 * POST /api/orders/:id/deliver
 */
async function confirmDelivery(req, res, next) {
  try {
    const orderId = req.params.id;
    if (!orderId) return res.status(400).json({ error: 'Order ID required' });

    const contractWithBuyer = orderEscrow.connect(buyerWallet);

    const tx = await contractWithBuyer.confirmDelivery(orderId);
    await tx.wait();

    res.json({ message: 'Delivery confirmed, funds released', txHash: tx.hash });
  } catch (error) {
    console.error('confirmDelivery error:', error);
    next(error);
  }
}

/**
 * Open dispute for order (buyer or seller)
 * POST /api/orders/:id/dispute
 */
async function openDispute(req, res, next) {
  try {
    const orderId = req.params.id;
    if (!orderId) return res.status(400).json({ error: 'Order ID required' });

    const { role } = req.body; // "buyer" or "seller" to select wallet

    let signerWallet;
    if (role === 'buyer') signerWallet = buyerWallet;
    else signerWallet = adminWallet; // Currently only buyer wallet known, expand as needed (seller wallet)

    const contractWithSigner = orderEscrow.connect(signerWallet);

    const tx = await contractWithSigner.openDispute(orderId);
    await tx.wait();

    res.json({ message: 'Dispute opened', txHash: tx.hash });
  } catch (error) {
    console.error('openDispute error:', error);
    next(error);
  }
}

/**
 * Resolve dispute (only admin wallet)
 * POST /api/orders/:id/resolve
 * Body: { refundBuyer: boolean }
 */
async function resolveDispute(req, res, next) {
  try {
    const orderId = req.params.id;
    const { refundBuyer } = req.body;

    if (!orderId) return res.status(400).json({ error: 'Order ID required' });
    if (refundBuyer === undefined) return res.status(400).json({ error: 'refundBuyer flag required' });

    // Admin wallet to resolve disputes
    const contractWithAdmin = orderEscrow.connect(orderEscrow.signer || buyerWallet); // use adminWallet here

    const { orderEscrow: adminOrderEscrow } = require('../services/blockchain');
    const adminWallet = require('../services/blockchain').adminWallet;
    const contract = adminOrderEscrow.connect(adminWallet);

    const tx = await contract.resolveDispute(orderId, Boolean(refundBuyer));
    await tx.wait();

    res.json({ message: 'Dispute resolved', refundBuyer, txHash: tx.hash });
  } catch (error) {
    console.error('resolveDispute error:', error);
    next(error);
  }
}

/**
 * Get order details by ID
 * GET /api/orders/:id
 */
async function getOrder(req, res, next) {
  try {
    const orderId = req.params.id;
    if (!orderId) return res.status(400).json({ error: 'Order ID required' });

    const order = await orderEscrow.getOrder(orderId);
    const decodedOrder = {
      id: order.id.toNumber(),
      productId: order.productId.toNumber(),
      buyer: order.buyer,
      seller: order.seller,
      valueWei: order.value.toString(),
      valueEth: ethers.utils.formatEther(order.value),  // e.g. "0.000000000000001"
      status: order.status,   // numeric, you can map to string below
      statusName: ["Created", "Delivered", "Disputed", "Refunded", "Completed"][order.status],
      timestamp: order.timestamp.toNumber(),
      datetime: new Date(order.timestamp.toNumber() * 1000).toISOString(),
    };

    res.json(decodedOrder);
  } catch (error) {
    console.error('getOrder error:', error);
    next(error);
  }
}

/**
 * List all orders by buyer address
 * GET /api/orders/buyer/:address
 * Note: On-chain filtering by buyer is inefficient; off-chain indexing recommended for production.
 */
async function getOrdersByBuyer(req, res, next) {
  try {
    const buyerAddress = req.params.address;
    if (!buyerAddress) return res.status(400).json({ error: 'Buyer address required' });

    // Inefficient on-chain way: iterate all orders
    const orderCount = (await orderEscrow.orderCount()).toNumber();
    const orders = [];
    for (let i = 1; i <= orderCount; i++) {
      const order = await orderEscrow.getOrder(i);
      if (order.buyer.toLowerCase() === buyerAddress.toLowerCase()) {
        orders.push({
          id: order.id.toString(),
          productId: order.productId.toString(),
          seller: order.seller,
          value: ethers.utils.formatEther(order.value),
          status: order.status,
          timestamp: new Date(order.timestamp.toNumber() * 1000),
        });
      }
    }

    res.json(orders);
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
