import { useState } from "react";
import VerifyTab from "./components/VerifyTab";
import IssueTab from "./components/IssueTab";
import { isContractConfigured } from "./lib/contract";
import { CONTRACT_ADDRESS, ETHERSCAN_BASE } from "./config";

type Tab = "verify" | "issue";

export default function App() {
  const [tab, setTab] = useState<Tab>("verify");
  const configured = isContractConfigured();

  return (
    <div className="container">
      <header>
        <h1>On-Chain Credential Verification</h1>
        <p className="subtitle">Verify certificates without trusting a central database.</p>
      </header>

      {!configured && (
        <div className="alert warn">
          Contract address not set. Deploy the contract, then update <code>CONTRACT_ADDRESS</code> in{" "}
          <code>frontend/src/config.ts</code>.
        </div>
      )}

      <nav className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === "verify"} className={tab === "verify" ? "active" : ""} onClick={() => setTab("verify")}>
          Verify
        </button>
        <button role="tab" aria-selected={tab === "issue"} className={tab === "issue" ? "active" : ""} onClick={() => setTab("issue")}>
          Issue
        </button>
      </nav>

      <main className="card">{tab === "verify" ? <VerifyTab /> : <IssueTab />}</main>

      <p className="note">🔒 Your file never leaves your browser. Only its hash is used.</p>

      {configured && (
        <footer>
          Contract on Sepolia:{" "}
          <a href={`${ETHERSCAN_BASE}/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer">
            {CONTRACT_ADDRESS}
          </a>
        </footer>
      )}
    </div>
  );
}

