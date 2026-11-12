import { useState } from "react";
import FilePicker from "./FilePicker";
import { friendlyError, hashFile, isContractConfigured, verifyHash, type VerifyResult } from "../lib/contract";
import { ETHERSCAN_BASE } from "../config";

export default function VerifyTab() {
  const [hash, setHash] = useState("");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onFile(file: File | null) {
    setResult(null);
    setError("");
    setHash("");
    if (!file) return;
    setLoading(true);
    try {
      const h = await hashFile(file);
      setHash(h);
      if (!isContractConfigured()) throw new Error("Contract address not configured.");
      setResult(await verifyHash(h));
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <h2>Verify a certificate</h2>
      <p className="muted">Anyone can check a file. No wallet or signature needed.</p>

      <FilePicker onFile={onFile} disabled={loading} />

      {hash && (
        <div className="field">
          <span className="label">SHA-256 hash</span>
          <code className="hash">{hash}</code>
        </div>
      )}

      {loading && <p className="muted">Checking the registry…</p>}
      {error && <div className="alert error">{error}</div>}

      {result && <ResultView r={result} />}
    </section>
  );
}

function ResultView({ r }: { r: VerifyResult }) {
  if (r.issuedAt === 0) {
    return (
      <div className="result notfound">
        <strong>✖ Not found</strong>
        <p>This file has not been registered by any approved issuer. It may be altered or never issued.</p>
      </div>
    );
  }
  const date = new Date(r.issuedAt * 1000).toLocaleString();
  return (
    <div className={`result ${r.revoked ? "revoked" : "valid"}`}>
      <strong>{r.revoked ? "⚠ Revoked" : "✔ Valid"}</strong>
      <p>{r.revoked ? "This credential was issued but later revoked by its issuer." : "This credential is authentic and active."}</p>
      <dl>
        <dt>Issuer</dt>
        <dd>
          <a href={`${ETHERSCAN_BASE}/address/${r.issuer}`} target="_blank" rel="noreferrer">
            {r.issuer}
          </a>
        </dd>
        <dt>Issued at</dt>
        <dd>{date}</dd>
      </dl>
    </div>
  );
}

