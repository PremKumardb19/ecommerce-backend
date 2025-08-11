require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Load contract ABIs (assumes compiled JSON artifacts in ../ecommerce-blockchain/artifacts/contracts/)
const productRegistryABI = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../ecommerce-blockchain/artifacts/contracts/ProductRegistry.sol/ProductRegistry.json'),
    'utf-8'
  )
).abi;

const orderEscrowABI = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../ecommerce-blockchain/artifacts/contracts/OrderEscrow.sol/OrderEscrow.json'),
    'utf-8'
  )
).abi;

const reviewSystemABI = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../ecommerce-blockchain/artifacts/contracts/ReviewSystem.sol/ReviewSystem.json'),
    'utf-8'
  )
).abi;

const rewardTokenABI = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../ecommerce-blockchain/artifacts/contracts/RewardSystem.sol/RewardToken.json'),
    'utf-8'
  )
).abi;

// Provider setup (Infura or your RPC)
const provider = new ethers.providers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);

// Wallets
const adminWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const buyerWallet = new ethers.Wallet(process.env.BUYER_PRIVATE_KEY, provider);

// Contract addresses from environment variables
const productRegistryAddress = process.env.PRODUCT_REGISTRY_ADDRESS;
const orderEscrowAddress = process.env.ORDER_ESCROW_ADDRESS;
const reviewSystemAddress = process.env.REVIEW_SYSTEM_ADDRESS;
const rewardTokenAddress = process.env.REWARD_TOKEN_ADDRESS;

// Instantiate contract instances connected with admin by default
const productRegistry = new ethers.Contract(productRegistryAddress, productRegistryABI, adminWallet);
const orderEscrow = new ethers.Contract(orderEscrowAddress, orderEscrowABI, adminWallet);
const reviewSystem = new ethers.Contract(reviewSystemAddress, reviewSystemABI, adminWallet);
const rewardToken = new ethers.Contract(rewardTokenAddress, rewardTokenABI, adminWallet);

module.exports = {
  ethers,
  provider,
  adminWallet,
  buyerWallet,
  productRegistry,
  orderEscrow,
  reviewSystem,
  rewardToken,
};
