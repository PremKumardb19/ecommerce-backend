# 🛒 Decentralized E-Commerce Backend (with Rewards & Escrow)

A **hybrid Web2 + Web3 backend** for decentralized e-commerce.
Built with **Node.js + Express + MongoDB** for scalability and **Ethereum Smart Contracts (Sepolia testnet)** for trustless payments, escrow, and tokenized rewards.

This backend powers:

* Product listings (off-chain + IPFS)
* Escrow-based orders with disputes
* Reward tokens (ERC-20)
* **MetaMask-first UX** (users control their keys, backend verifies)

---

## 📖 Table of Contents

1. [Features](#-features)
2. [System Architecture](#-system-architecture)
3. [Smart Contracts](#-smart-contracts)
4. [Backend Modules](#-backend-modules)
5. [Setup & Installation](#-setup--installation)
6. [API Endpoints](#-api-endpoints)
7. [Workflows](#-workflows)
8. [Security Model](#-security-model)
9. [Testing Strategy](#-testing-strategy)
10. [Deployment Guide](#-deployment-guide)
11. [Troubleshooting](#-troubleshooting)
12. [Future Enhancements](#-future-enhancements)

---

## 🚀 Features

* **Product Management**

  * Off-chain metadata in MongoDB.
  * Optional on-chain registration (unique `onChainId`).
  * IPFS storage for images & provenance.

* **Escrow Order System**

  * Buyers pay ETH into an **OrderEscrow\.sol** contract.
  * Funds held until buyer confirms delivery.
  * Built-in dispute resolution flow.

* **Rewards**

  * ERC-20 `EcomRewardToken` issued on purchases.
  * Burn tokens via MetaMask.
  * Backend syncs balances.

* **MetaMask Integration**

  * No private keys on server.
  * All sensitive operations signed by user.
  * Backend verifies receipts + updates DB.

* **Admin Panel**

  * Manage disputes (refund buyer or release funds).
  * View all open disputes.

---

## 🏗 System Architecture

```
                         ┌───────────────────┐
                         │  Frontend (Web)   │
                         │  - HTML/JS        │
                         │  - Ethers.js      │
                         │  - MetaMask       │
                         └─────────┬─────────┘
                                   │
                                   ▼
                         ┌───────────────────┐
                         │  Backend (API)    │
                         │  Express + Mongo  │
                         │  JWT auth + IPFS  │
                         └─────────┬─────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                             ▼
         ┌────────────────────┐        ┌─────────────────────┐
         │ Ethereum (Sepolia) │        │ MongoDB             │
         │ - ProductRegistry  │        │ - Products          │
         │ - OrderEscrow      │        │ - Orders            │
         │ - RewardToken      │        │ - RewardBalances    │
         └────────────────────┘        └─────────────────────┘
```

---

## 🔗 Smart Contracts

1. **ProductRegistry.sol** – Assigns unique `onChainId` to each product.
2. **OrderEscrow\.sol** – Handles order creation, escrow, delivery confirmation, disputes.
3. **EcomRewardToken.sol** – ERC-20 token for rewards.

📍 All contracts deployed to **Sepolia testnet**.

---

## 📦 Backend Modules

* **`controllers/`**

  * `productController.js` → CRUD for products
  * `orderController.js` → Place, confirm, dispute, resolve orders
  * `rewardController.js` → Burn + sync tokens

* **`services/`**

  * `blockchain.js` → Contract instances (ethers.js)
  * `ipfsService.js` → Upload product images/metadata
  * `auth.js` → JWT + MetaMask signature verification

* **`models/`**

  * `Product.js`
  * `Order.js`
  * `RewardBalance.js`

---

## ⚙️ Setup & Installation

### 1. Prerequisites

* Node.js >= 18
* MongoDB (local or Atlas)
* MetaMask (Sepolia testnet enabled)
* Infura/Alchemy RPC URL

### 2. Clone repository

```bash
git clone https://github.com/your-org/ecommerce-blockchain.git
cd ecommerce-backend
```

### 3. Install dependencies

```bash
npm install
```

### 4. Configure `.env`

```ini
MONGODB_URI=mongodb://127.0.0.1:27017/ecommerce
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
ESCROW_CONTRACT=0x134D06b6Aef09a40A4cf9F6F937097296c290E30
REWARD_TOKEN_CONTRACT=0xa58801c99d95504fd9048431c9a4a0845c5e3df3
ADMIN_ADDRESS=0xeddFA97C56d6b32BC1E90D429e116D822a039B46
PORT=5000
```

### 5. Run server

```bash
npm start
```

---

## 📚 API Endpoints

### Products

* `POST /api/products` – Add new product
* `GET /api/products` – List all products
* `GET /api/products/:id` – Fetch product details
* `PUT /api/products/:id` – Update product

### Orders

* `POST /api/orders` – Save order after MetaMask TX
* `POST /api/orders/:id/deliver` – Confirm delivery
* `POST /api/orders/:id/dispute` – Open dispute
* `POST /api/orders/:id/resolve` – Resolve dispute (admin)
* `GET /api/orders/buyer/:address` – Get buyer’s orders
* `GET /api/orders/disputed` – Get all disputed orders

### Rewards

* `POST /api/rewards/burn` – Record burn TX

---

## 🔄 Workflows

### Place Order

1. Frontend calls `escrow.placeOrder(product.onChainId, { value: price })` via MetaMask.
2. Backend listens to `OrderPlaced` event.
3. DB saves order.

### Confirm Delivery

1. Buyer → MetaMask → `escrow.confirmDelivery(orderId)`.
2. Smart contract releases funds to seller.
3. Backend updates DB to `Completed`.

### Dispute

* Buyer/seller calls `escrow.openDispute(orderId)`.
* Admin resolves later.

### Rewards

* After successful order → backend credits reward tokens.
* User burns via MetaMask (`rewardToken.burn(amount)`).

---

## 🔐 Security Model

* **No private keys stored** → all actions signed via MetaMask.
* **Events-driven sync** → backend trusts blockchain, not frontend inputs.
* **JWT auth** → ensures user’s address matches their session.
* **Admin enforcement** → only `ADMIN_ADDRESS` can resolve disputes.

---

## 🧪 Testing Strategy

* **Postman Collection** included (`Ecommerce API Collection.postman_collection.json`).
* Test flows in Sepolia:

  * ✅ Product creation
  * ✅ Order placement
  * ✅ Delivery confirmation
  * ✅ Dispute resolution
  * ✅ Reward token burn

---

## 🌐 Deployment Guide

1. **Contracts**: Deploy via Hardhat/Foundry → update `.env`.
2. **Backend**: Deploy on Heroku/Vercel/Docker.
3. **DB**: MongoDB Atlas recommended.
4. **Frontend**: GitHub Pages / Netlify.
5. Use **Infura/Alchemy** for RPC in production.

---
