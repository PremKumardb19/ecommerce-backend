const axios = require('axios');
const FormData = require('form-data');

// Load Pinata JWT from environment
const PINATA_JWT = process.env.PINATA_JWT;
const PINATA_BASE_URL = "https://api.pinata.cloud/pinning";

/**
 * Upload a file buffer (e.g., from multer) to Pinata's IPFS
 * @param {Object} file - File object from multer with buffer, mimetype, originalname
 * @returns {Promise<string>} - Returns IPFS hash (CID)
 */
async function uploadFileToIPFS(file) {
  try {
    if (!PINATA_JWT) {
      throw new Error("Pinata JWT not set in .env");
    }

    if (!file || !file.buffer) {
      throw new Error("Invalid file input. Expecting a file object with buffer.");
    }

    const url = `${PINATA_BASE_URL}/pinFileToIPFS`;
    const formData = new FormData();

    // Add file from memory buffer
    formData.append('file', file.buffer, {
      filename: file.originalname || 'upload',
      contentType: file.mimetype || 'application/octet-stream',
    });

    const response = await axios.post(url, formData, {
      maxBodyLength: Infinity,
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${PINATA_JWT}`,
      },
    });

    console.log("✅ File uploaded to IPFS. CID:", response.data.IpfsHash);
    return response.data.IpfsHash;
  } catch (error) {
    console.error("❌ Error uploading file to IPFS:", error.response?.data || error.message);
    throw new Error("Failed to upload file to IPFS");
  }
}

/**
 * Upload a JSON object to Pinata's IPFS
 * @param {Object} json - JSON object to store as metadata
 * @returns {Promise<string>} - Returns IPFS hash (CID)
 */
async function uploadJSONToIPFS(json) {
  try {
    if (!PINATA_JWT) {
      throw new Error("Pinata JWT not set in .env");
    }

    const url = `${PINATA_BASE_URL}/pinJSONToIPFS`;

    const response = await axios.post(url, json, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${PINATA_JWT}`,
      },
    });

    console.log("✅ JSON metadata uploaded to IPFS. CID:", response.data.IpfsHash);
    return response.data.IpfsHash;
  } catch (error) {
    console.error("❌ Error uploading JSON to IPFS:", error.response?.data || error.message);
    throw new Error("Failed to upload JSON metadata to IPFS");
  }
}

module.exports = {
  uploadFileToIPFS,
  uploadJSONToIPFS,
};
