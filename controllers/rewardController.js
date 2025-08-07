const { rewardToken, adminWallet, buyerWallet, ethers } = require('../services/blockchain');

/**
 * Mint reward tokens to a user (admin only)
 * POST /api/rewards/mint
 * Body: { toAddress: string, amount: string (in tokens, e.g. "100.5") }
 */
async function mintTokens(req, res, next) {
  try {
    const { toAddress, amount } = req.body;

    if (!toAddress || !amount) {
      return res.status(400).json({ error: 'toAddress and amount are required' });
    }

    // Parse amount to token's smallest unit (assuming 18 decimals)
    const parsedAmount = ethers.utils.parseUnits(amount.toString(), 18);

    // Mint tokens using adminWallet signer
    const tx = await rewardToken.mint(toAddress, parsedAmount);
    await tx.wait();

    res.status(201).json({ message: 'Tokens minted successfully', txHash: tx.hash });
  } catch (error) {
    console.error('mintTokens error:', error);
    next(error);
  }
}

/**
 * Get token balance of any address
 * GET /api/rewards/balance/:address
 */
async function getBalance(req, res, next) {
  try {
    const address = req.params.address;
    if (!address) return res.status(400).json({ error: 'Address is required' });

    const balance = await rewardToken.balanceOf(address);
    // Format balance from wei to human readable decimal string
    const formattedBalance = ethers.utils.formatUnits(balance, 18);

    res.json({ address, balance: formattedBalance });
  } catch (error) {
    console.error('getBalance error:', error);
    next(error);
  }
}

/**
 * Burn tokens from the connected user (buyer)
 * POST /api/rewards/burn
 * Body: { amount: string (in tokens, e.g. "10") }
 */
async function burnTokens(req, res, next) {
  try {
    const { amount } = req.body;

    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }

    const parsedAmount = ethers.utils.parseUnits(amount.toString(), 18);

    // Connect rewardToken contract with buyerWallet signer so user can burn own tokens
    const contractWithBuyer = rewardToken.connect(buyerWallet);

    const tx = await contractWithBuyer.burn(parsedAmount);
    await tx.wait();

    res.json({ message: 'Tokens burned successfully', txHash: tx.hash });
  } catch (error) {
    console.error('burnTokens error:', error);
    next(error);
  }
}

module.exports = {
  mintTokens,
  getBalance,
  burnTokens,
};
