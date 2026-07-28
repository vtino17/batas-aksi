import { useMemo, useState } from "react";
import {
  createReceipt,
  evaluateAction,
  validateAction,
  validatePolicy,
} from "@batasaksi/core";
import type {
  ActionEnvelope,
  ActionPolicy,
  ActionReceipt,
  EvaluationResult,
} from "@batasaksi/core";
import { samplePolicy, samples } from "./samples.js";

const stringify = (value: unknown) => JSON.stringify(value, null, 2);

interface Simulation {
  action?: ActionEnvelope;
  policy?: ActionPolicy;
  result?: EvaluationResult;
  error?: string;
}

function simulate(actionText: string, policyText: string): Simulation {
  try {
    const action = JSON.parse(actionText) as unknown;
    const policy = JSON.parse(policyText) as unknown;
    const actionIssues = validateAction(action);
    const policyIssues = validatePolicy(policy);
    const issues = [...actionIssues, ...policyIssues];
    if (issues.length > 0) {
      return {
        error: issues.map((entry) => `${entry.path}: ${entry.message}`).join("\n"),
      };
    }
    return {
      action: action as ActionEnvelope,
      policy: policy as ActionPolicy,
      result: evaluateAction(action, policy),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

function DecisionCard({ result }: { result: EvaluationResult }) {
  return (
    <section className={`decision-card decision-${result.decision}`}>
      <div className="decision-topline">
        <div>
          <span className="eyebrow">Keputusan preflight</span>
          <h2>{result.decision}</h2>
        </div>
        <div className="risk-orbit" style={{ "--risk": `${result.riskScore * 3.6}deg` } as React.CSSProperties}>
          <span>{result.riskScore}</span>
          <small>risiko</small>
        </div>
      </div>
      <div className="signal-row">
        {result.riskSignals.map((signal) => (
          <span className="signal" key={signal}>{signal}</span>
        ))}
      </div>
      <div className="reason">
        <span>ALASAN UTAMA</span>
        <p>{result.reasons[0]}</p>
      </div>
      <div className="approval-stat">
        <span>Approval</span>
        <strong>
          {result.approval.required === 0
            ? "Tidak diperlukan"
            : `${result.approval.required} × ${result.approval.roles.join(" / ")}`}
        </strong>
      </div>
    </section>
  );
}

function Trace({ result }: { result: EvaluationResult }) {
  return (
    <section className="panel trace-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Decision trace</span>
          <h3>Aturan yang cocok</h3>
        </div>
        <span className="count">{result.matchedRules.length}</span>
      </div>
      <div className="trace-list">
        {result.matchedRules.length === 0 ? (
          <p className="muted">Tidak ada aturan cocok. Default policy dipakai.</p>
        ) : (
          result.matchedRules.map((rule, index) => (
            <article className="trace-item" key={rule.id}>
              <span className="trace-number">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <strong>{rule.id}</strong>
                <p>{rule.description}</p>
              </div>
              <span className={`effect effect-${rule.effect}`}>{rule.effect}</span>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function ReceiptPanel({ simulation }: { simulation: Simulation }) {
  const [approver, setApprover] = useState("Ayu");
  const [role, setRole] = useState("communications-owner");
  const [receipt, setReceipt] = useState<ActionReceipt>();
  const [error, setError] = useState("");

  async function generate() {
    if (!simulation.action || !simulation.policy || !simulation.result) return;
    try {
      const required = simulation.result.approval.required;
      const approvals = Array.from({ length: required }, (_, index) => ({
        approver: required > 1 ? `${approver} ${index + 1}` : approver,
        role,
        approvedAt: new Date().toISOString(),
      }));
      const next = await createReceipt({
        action: simulation.action,
        policy: simulation.policy,
        approvals,
      });
      setReceipt(next);
      setError("");
    } catch (caught) {
      setReceipt(undefined);
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  function download() {
    if (!receipt) return;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([`${stringify(receipt)}\n`], { type: "application/json" }),
    );
    link.download = `${receipt.receiptId}.receipt.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const roles = simulation.result?.approval.roles ?? [];

  return (
    <section className="panel receipt-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Bukti keputusan</span>
          <h3>Receipt berantai</h3>
        </div>
        <span className="local-pill">SHA-256</span>
      </div>
      <p className="muted">
        Receipt mengikat isi action, policy, keputusan, dan approval. Perubahan satu karakter akan terdeteksi.
      </p>
      {(simulation.result?.approval.required ?? 0) > 0 && (
        <div className="approval-fields">
          <label>
            Nama approver
            <input value={approver} onChange={(event) => setApprover(event.target.value)} />
          </label>
          <label>
            Peran
            <select value={role} onChange={(event) => setRole(event.target.value)}>
              {(roles.length > 0 ? roles : ["owner"]).map((entry) => (
                <option key={entry}>{entry}</option>
              ))}
            </select>
          </label>
        </div>
      )}
      <div className="button-row">
        <button className="primary-button" onClick={generate} disabled={!simulation.result}>
          Buat receipt
        </button>
        {receipt && <button className="ghost-button" onClick={download}>Unduh JSON</button>}
      </div>
      {error && <pre className="inline-error">{error}</pre>}
      {receipt && (
        <div className="receipt-result">
          <div><span>Receipt ID</span><code>{receipt.receiptId}</code></div>
          <div><span>Hash</span><code>{receipt.receiptHash}</code></div>
        </div>
      )}
    </section>
  );
}

export function App() {
  const sampleNames = Object.keys(samples);
  const [selected, setSelected] = useState(sampleNames[1]!);
  const [actionText, setActionText] = useState(stringify(samples[selected]));
  const [policyText, setPolicyText] = useState(stringify(samplePolicy));
  const simulation = useMemo(
    () => simulate(actionText, policyText),
    [actionText, policyText],
  );

  function selectSample(name: string) {
    setSelected(name);
    setActionText(stringify(samples[name]));
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#">
          <span className="brand-mark">BA</span>
          <span>BatasAksi <small>Studio</small></span>
        </a>
        <div className="privacy">
          <span className="status-dot" />
          Lokal · tidak ada data dikirim
        </div>
      </header>

      <section className="hero">
        <div>
          <span className="kicker">PRE-FLIGHT CONTROL PLANE</span>
          <h1>Berikan batas sebelum<br />agent diberi kuasa.</h1>
        </div>
        <p>
          Uji tindakan agent terhadap kebijakan yang dapat diaudit. Putuskan
          <em> allow, review,</em> atau <em>deny</em> sebelum efek samping terjadi.
        </p>
      </section>

      <nav className="sample-tabs" aria-label="Skenario contoh">
        {sampleNames.map((name) => (
          <button
            className={selected === name ? "active" : ""}
            key={name}
            onClick={() => selectSample(name)}
          >
            {name}
          </button>
        ))}
      </nav>

      <section className="workspace">
        <div className="editors">
          <section className="editor-card">
            <div className="editor-title">
              <div><span className="file-dot action-dot" /><strong>action.json</strong></div>
              <span>Action Envelope v1</span>
            </div>
            <textarea
              aria-label="Action JSON"
              spellCheck={false}
              value={actionText}
              onChange={(event) => setActionText(event.target.value)}
            />
          </section>
          <section className="editor-card">
            <div className="editor-title">
              <div><span className="file-dot policy-dot" /><strong>policy.json</strong></div>
              <span>Policy v1</span>
            </div>
            <textarea
              aria-label="Policy JSON"
              spellCheck={false}
              value={policyText}
              onChange={(event) => setPolicyText(event.target.value)}
            />
          </section>
        </div>

        <aside className="results">
          {simulation.error ? (
            <section className="panel error-panel">
              <span className="eyebrow">Input tidak valid</span>
              <h3>Periksa JSON</h3>
              <pre>{simulation.error}</pre>
            </section>
          ) : simulation.result ? (
            <>
              <DecisionCard result={simulation.result} />
              <Trace result={simulation.result} />
              <ReceiptPanel simulation={simulation} />
            </>
          ) : null}
        </aside>
      </section>

      <footer>
        <span>BatasAksi / open-source decision infrastructure</span>
        <span>Policy-first · vendor-neutral · local-first</span>
      </footer>
    </main>
  );
}
