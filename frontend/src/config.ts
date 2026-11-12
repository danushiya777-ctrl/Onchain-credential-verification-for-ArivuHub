// Update CONTRACT_ADDRESS after running `npm run deploy:sepolia` in the project root.
export const CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000";

// Public read-only Sepolia RPC used by the Verify tab (no wallet needed).
// You can replace it with your own Alchemy/Infura URL.
export const READ_RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";

export const SEPOLIA_CHAIN_ID = 11155111n;
export const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7";
export const ETHERSCAN_BASE = "https://sepolia.etherscan.io";

// Human-readable ABI: only the functions the frontend uses.
export const ABI = [
  "function admin() view returns (address)",
  "function isIssuer(address) view returns (bool)",
  "function issueCredential(bytes32 hash)",
  "function verifyCredential(bytes32 hash) view returns (bool valid, address issuer, uint256 issuedAt, bool revoked)",
] as const;

