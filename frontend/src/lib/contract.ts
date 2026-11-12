import { ethers } from "ethers";
import {
  ABI,
  CONTRACT_ADDRESS,
  READ_RPC_URL,
  SEPOLIA_CHAIN_ID,
  SEPOLIA_CHAIN_ID_HEX,
} from "../config";

declare global {
  interface Window {
    ethereum?: ethers.Eip1193Provider & {
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

export type VerifyResult = {
  hash: string;
  valid: boolean;
  issuer: string;
  issuedAt: number; // unix seconds, 0 if not found
  revoked: boolean;
};

export function isContractConfigured(): boolean {
  return ethers.isAddress(CONTRACT_ADDRESS) && CONTRACT_ADDRESS !== ethers.ZeroAddress;
}

/** SHA-256 of a file, computed in the browser. Same result as `sha256sum`. */
export async function hashFile(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return ethers.sha256(bytes); // 0x + 64 hex chars
}

/** Read-only call: no wallet or signature needed. */
export async function verifyHash(hash: string): Promise<VerifyResult> {
  const provider = new ethers.JsonRpcProvider(READ_RPC_URL, Number(SEPOLIA_CHAIN_ID), {
    staticNetwork: true,
  });
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
  const [valid, issuer, issuedAt, revoked] = await contract.verifyCredential(hash);
  return { hash, valid, issuer, issuedAt: Number(issuedAt), revoked };
}

export async function connectWallet(): Promise<string> {
  if (!window.ethereum) throw new Error("MetaMask not found. Install it to issue credentials.");
  const provider = new ethers.BrowserProvider(window.ethereum);
  const accounts: string[] = await provider.send("eth_requestAccounts", []);
  return ethers.getAddress(accounts[0]);
}

export async function isOnSepolia(): Promise<boolean> {
  if (!window.ethereum) return false;
  const network = await new ethers.BrowserProvider(window.ethereum).getNetwork();
  return network.chainId === SEPOLIA_CHAIN_ID;
}

export async function switchToSepolia(): Promise<void> {
  if (!window.ethereum) throw new Error("MetaMask not found.");
  await window.ethereum.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }],
  });
}

/** Sends issueCredential from the connected MetaMask account. Returns the tx hash. */
export async function issueHash(hash: string): Promise<string> {
  if (!window.ethereum) throw new Error("MetaMask not found.");
  if (!(await isOnSepolia())) throw new Error("Wrong network: switch MetaMask to Sepolia.");

  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

  // Pre-checks give clearer messages than a failed gas estimate.
  if (!(await contract.isIssuer(await signer.getAddress()))) {
    throw new Error("This account is not an approved issuer. Ask the admin to call addIssuer.");
  }
  const [, , issuedAt] = await contract.verifyCredential(hash);
  if (issuedAt !== 0n) throw new Error("This certificate has already been issued.");

  const tx = await contract.issueCredential(hash);
  await tx.wait();
  return tx.hash;
}

/** Turns ethers/MetaMask errors into a short, readable message. */
export function friendlyError(err: unknown): string {
  const e = err as { code?: string | number; reason?: string; shortMessage?: string; message?: string; info?: { error?: { code?: number } } };
  if (e?.code === "ACTION_REJECTED" || e?.code === 4001 || e?.info?.error?.code === 4001) {
    return "You rejected the request in MetaMask.";
  }
  const reason = e?.reason ?? "";
  if (reason.includes("Not an approved issuer")) return "This account is not an approved issuer.";
  if (reason.includes("Already issued")) return "This certificate has already been issued.";
  if (e?.code === "INSUFFICIENT_FUNDS") return "Not enough Sepolia ETH to pay for gas.";
  if (e?.code === "NETWORK_ERROR") return "Network error: could not reach Sepolia.";
  if (reason) return reason;
  return e?.shortMessage ?? e?.message ?? "Something went wrong.";
}

