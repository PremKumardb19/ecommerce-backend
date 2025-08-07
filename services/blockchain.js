require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Helper function to resolve ABI JSON path
const getAbiPath = (folderName, fileName) => 
  path.resolve(__dirname, `../../ecommerce-blockchain/artifacts/contracts/${folderName}/${fileName}`);

const loadAbi = (folderName, fileName) => {
  const filePath = getAbiPath(folderName, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`ABI file not found: ${filePath}`);
  }
  const json = fs.readFileSync(filePath);
  return JSON.parse(json).abi;
};

// Load ABIs with correct filenames and folders
const productRegistryAbi = loadAbi('ProductRegistry.sol', 'ProductRegistry.json');
const orderEscrowAbi = loadAbi('OrderEscrow.sol', 'OrderEscrow.json');
const reviewSystemAbi = loadAbi('ReviewSystem.sol', 'ReviewSystem.json');

// Notice: AccessControl ABI is inside AccessControl.sol folder but named AccessControlModule.json
const accessControlAbi = loadAbi('AccessControl.sol', 'AccessControlModule.json');

// RewardToken ABI is in RewardSystem.sol folder with RewardToken.json filename
const rewardTokenAbi = loadAbi('RewardSystem.sol', 'RewardToken.json');

// Environment variables
const RPC_URL = process.env.SEPOLIA_RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const BUYER_PRIVATE_KEY = process.env.BUYER_PRIVATE_KEY;

const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

// Wallets used for signing transactions — admin (deployer) and buyer keys
const adminWallet = new ethers.Wallet(PRIVATE_KEY, provider);
const buyerWallet = new ethers.Wallet(BUYER_PRIVATE_KEY, provider);

// Contract addresses from .env
const productRegistryAddress = process.env.PRODUCT_REGISTRY_ADDRESS;
const orderEscrowAddress = process.env.ORDER_ESCROW_ADDRESS;
const reviewSystemAddress = process.env.REVIEW_SYSTEM_ADDRESS;
const rewardTokenAddress = process.env.REWARD_TOKEN_ADDRESS;
// (If you want to use AccessControl contract instance, you can add its address here and export)

const productRegistry = new ethers.Contract(productRegistryAddress, productRegistryAbi, adminWallet);
const orderEscrow = new ethers.Contract(orderEscrowAddress, orderEscrowAbi, adminWallet);
const reviewSystem = new ethers.Contract(reviewSystemAddress, reviewSystemAbi, adminWallet);
const rewardToken = new ethers.Contract(rewardTokenAddress, rewardTokenAbi, adminWallet);

// If you have an AccessControl contract/address, initialize here:
// const accessControlAddress = process.env.ACCESS_CONTROL_ADDRESS || '0x...';
// const accessControl = new ethers.Contract(accessControlAddress, accessControlAbi, adminWallet);

module.exports = {
  provider,
  adminWallet,
  buyerWallet,

  productRegistry,
  orderEscrow,
  reviewSystem,
  rewardToken,

  ethers

  // accessControl, // uncomment if assigned and used
};
