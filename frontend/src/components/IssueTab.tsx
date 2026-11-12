import { useEffect, useState } from "react";
import FilePicker from "./FilePicker";
import {
  connectWallet,
  friendlyError,
  hashFile,
  isContractConfigured,
  isOnSepolia,
  issueHash,
  switchToSepolia,
} from "../lib/contract";
import { ETHERSCAN_BASE } from "../config";

export default function IssueTab() {
  const [account, setAccount] = useState("");
  const [onSepolia, setOnSepolia] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [hash, setHash] = useState("");
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Keep account/network in sync with MetaMask.
  useEffect(() => {
    const eth = window.ethereum;
    if (!eth?.on) return;
    const onAccounts = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      setAccount(accounts[0] ?? "");
    };
    const onChain = () => {
      isOnSepolia().then(setOnSepolia);
    };
    eth.on("accountsChanged", onAccounts);
    eth.on("chainChanged", onChain);
    return () => {
      eth.removeListener?.("accountsChanged", onAccounts);
      eth.removeListener?.("chainChanged", onChain);
    };
  }, []);

  async function onConnect() {
    setError("");
    try {
      setAccount(await connectWallet());
      setOnSepolia(await isOnSepolia());
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  async function onSwitch() {
    setError("");
    try {
      await switchToSepolia();
      setOnSepolia(await isOnSepolia());
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  async function onPick(f: File | null) {
    setFile(f);
    setTxHash("");
    setError("");
    setHash(f ? await hashFile(f) : "");
  }

  async function onIssue() {
    if (!hash) return;
    setBusy(true);
    setError("");
    setTxHash("");
    try {
      setTxHash(await issueHash(hash));
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  const ready = isContractConfigured() && account && onSepolia && file && !busy;

  return (
    <section>
      <h2>Issue a credential</h2>
      <p className="muted">For approved issuers only. Registers the file's hash on Sepolia.</p>

      {!account ? (
        <button className="primary" onClick={onConnect}>Connect MetaMask</button>
      ) : (
        <div className="field">
          <span className="label">Connected account</span>
          <code>{account}</code>
        </div>
      )}

      {account && !onSepolia && (
        <div className="alert warn">
          Wrong network. <button className="link" onClick={onSwitch}>Switch to Sepolia</button>
        </div>
      )}

      <FilePicker onFile={onPick} disabled={busy} />

      {hash && (
        <div className="field">
          <span className="label">SHA-256 hash</span>
          <code className="hash">{hash}</code>
        </div>
      )}

      <button className="primary" disabled={!ready} onClick={onIssue}>
        {busy ? "Waiting for confirmation…" : "Issue credential"}
      </button>

      {error && <div className="alert error">{error}</div>}
      {txHash && (
        <div className="result valid">
          <strong>✔ Credential issued</strong>
          <p>
            Transaction:{" "}
            <a href={`${ETHERSCAN_BASE}/tx/${txHash}`} target="_blank" rel="noreferrer">
              {txHash}
            </a>
          </p>
        </div>
      )}
    </section>
  );
}

