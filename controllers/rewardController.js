const Reward = require('../models/Reward');
const { rewardToken, adminWallet, buyerWallet, ethers } = require('../services/blockchain');

/**
 * Mint reward tokens to a user (admin only)
 * POST /api/rewards/mint
 * Body: { toAddress: string, amount: string (token units, e.g. "100.5") }
 */
async function mintTokens(req, res, next) {
  try {
    const { toAddress, amount } = req.body;

    if (!toAddress || !amount) {
      return res.status(400).json({ error: 'toAddress and amount are required' });
    }

    // Parse amount to wei unit
    const parsedAmount = ethers.utils.parseUnits(amount.toString(), 18);

    // Mint on-chain tokens (signed by admin)
    const tx = await rewardToken.mint(toAddress, parsedAmount);
    await tx.wait();

    // Optionally update off-chain DB balance
    await updateRewardBalance(toAddress.toLowerCase(), parsedAmount, 'mint');

    res.status(201).json({ message: 'Tokens minted successfully', txHash: tx.hash });
  } catch (error) {
    console.error('mintTokens error:', error);
    next(error);
  }
}

/**
 * Get token balance of any address (from on-chain)
 * GET /api/rewards/balance/:address
 */
async function getBalance(req, res, next) {
  try {
    const address = req.params.address;
    if (!address) return res.status(400).json({ error: 'Address is required' });

    // Read balance from blockchain (authoritative)
    const balance = await rewardToken.balanceOf(address.toLowerCase());

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
 * Body: { amount: string (token units) }
 */
async function burnTokens(req, res, next) {
  try {
    const { amount } = req.body;
    const userAddress = req.user?.address?.toLowerCase();

    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }
    if (!userAddress) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Parse amount to wei
    const parsedAmount = ethers.utils.parseUnits(amount.toString(), 18);

    // Connect contract with user wallet signer for token burn
    // Here, you should ideally use user's wallet signer, 
    // this example assumes backend buyerWallet for demonstration
    const contractWithBuyer = rewardToken.connect(buyerWallet);

    const tx = await contractWithBuyer.burn(parsedAmount);
    await tx.wait();

    // Optionally update off-chain DB balance
    await updateRewardBalance(userAddress, parsedAmount, 'burn');

    res.json({ message: 'Tokens burned successfully', txHash: tx.hash });
  } catch (error) {
    console.error('burnTokens error:', error);
    next(error);
  }
}

/**
 * Helper: Update off-chain Reward balance and stats after mint or burn
 * @param {string} address Wallet address (lowercase)
 * @param {BigNumber} amount Amount in wei BigNumber
 * @param {string} op 'mint' or 'burn'
 */
async function updateRewardBalance(address, amount, op) {
  try {
    const reward = await Reward.findOne({ address });
    if (reward) {
      let newBalance;
      if (op === 'mint') {
        newBalance = ethers.BigNumber.from(reward.balanceWei).add(amount).toString();
        await Reward.updateOne(
          { address },
          {
            $set: { balanceWei: newBalance },
            $inc: { totalMinted: amount.toString() },
          }
        );
      } else if (op === 'burn') {
        newBalance = ethers.BigNumber.from(reward.balanceWei).sub(amount).toString();
        if (newBalance < 0) throw new Error('Insufficient off-chain balance');
        await Reward.updateOne(
          { address },
          {
            $set: { balanceWei: newBalance },
            $inc: { totalBurned: amount.toString() },
          }
        );
      }
    } else {
      // No existing doc - create if mint, error if burn
      if (op === 'mint') {
        await Reward.create({
          address,
          balanceWei: amount.toString(),
          totalMinted: amount.toString(),
          totalBurned: '0',
        });
      } else {
        throw new Error('No reward balance found to burn');
      }
    }
  } catch (error) {
    console.error('updateRewardBalance error:', error);
    // Do not throw error up to API to avoid inconsistencies; log only
  }
}

module.exports = {
  mintTokens,
  getBalance,
  burnTokens,
};
