import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowUpRight, Lock, Plus, TrendingUp, TrendingDown, Percent, X, Unlock } from "lucide-react";
import { TopNav } from "@/components/top-nav";
import { timeAgo, useWallet, walletStore, type Entry } from "@/lib/wallet-store";

export const Route = createFileRoute("/dashboard")({
  validateSearch: (search: Record<string, unknown>): { highlight?: string } =>
    typeof search.highlight === "string" ? { highlight: search.highlight } : {},
  head: () => ({
    meta: [
      { title: "Dashboard — Confidential Trading Journal" },
      { name: "description", content: "Encrypted P&L dashboard with selective reveal." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { address, entries, loadingEntries, decryptingEntries, aggregates, decryptingAggregates, connecting } =
    useWallet();
  const { highlight } = Route.useSearch();
  const [open, setOpen] = useState(false);
  const [flashIndex, setFlashIndex] = useState<string | null>(null);

  useEffect(() => {
    if (!highlight) return;
    setFlashIndex(highlight);
    const el = document.getElementById(highlight);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(() => setFlashIndex(null), 2500);
    return () => clearTimeout(t);
  }, [highlight, entries.length]);

  if (!address) {
    return (
      <div className="min-h-screen bg-background">
        <TopNav />
        <div className="mx-auto max-w-xl px-5 sm:px-8 py-32 text-center">
          <div className="grid h-14 w-14 mx-auto place-items-center rounded-2xl bg-surface mb-6">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Connect to view your journal</h1>
          <p className="text-muted-foreground mt-3">Your encrypted stats stay on-chain, decryptable only by you.</p>
          <button
            onClick={() => walletStore.connect()}
            disabled={connecting}
            className="mt-8 inline-flex rounded-full bg-primary text-black px-6 py-3.5 text-sm font-semibold shadow-glow disabled:opacity-60"
          >
            {connecting ? "Connecting…" : "Connect Wallet"}
          </button>
        </div>
      </div>
    );
  }

  const statsDecrypted = aggregates.gains !== undefined;
  const winRate =
    statsDecrypted && aggregates.winCount! + aggregates.lossCount! > 0n
      ? Math.round((Number(aggregates.winCount) / Number(aggregates.winCount! + aggregates.lossCount!)) * 100)
      : null;

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-7xl px-5 sm:px-8 py-10 sm:py-14">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-10">
          <div>
            <div className="label-caps text-muted-foreground mb-2">Journal</div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-[-0.02em]">Encrypted overview</h1>
            <p className="text-sm text-muted-foreground mt-2">Aggregate stats are computed over ciphertext on Sepolia. Decrypt them to reveal the real numbers.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => walletStore.decryptAggregates()}
              disabled={decryptingAggregates}
              className="inline-flex items-center gap-2 rounded-full bg-surface px-5 py-3 text-sm font-semibold hover:bg-border/60 transition disabled:opacity-60"
            >
              <Unlock className="h-4 w-4" /> {decryptingAggregates ? "Decrypting…" : "Decrypt Stats"}
            </button>
            <button
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-primary text-black px-5 py-3 text-sm font-semibold shadow-glow hover:brightness-95 transition"
            >
              <Plus className="h-4 w-4" /> New P&L Entry
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Total Gains"
            value={statsDecrypted ? aggregates.gains!.toString() : "••••"}
            accent
            icon={TrendingUp}
            sub="lifetime, decrypted"
          />
          <StatCard
            label="Total Losses"
            value={statsDecrypted ? aggregates.losses!.toString() : "••••"}
            icon={TrendingDown}
            sub="lifetime, decrypted"
          />
          <StatCard label="Win Rate" value={winRate !== null ? `${winRate}%` : "••%"} icon={Percent} sub="over lifetime" />
        </div>

        <section className="mt-10 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-3xl bg-background border border-border/60 shadow-soft overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-border/60">
              <div>
                <div className="text-sm font-semibold">Encrypted entries</div>
                <div className="text-xs text-muted-foreground">Ciphertext handles · Sepolia</div>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => walletStore.decryptEntries()}
                  disabled={decryptingEntries || entries.length === 0}
                  className="text-xs font-medium inline-flex items-center gap-1 hover:underline disabled:opacity-50"
                >
                  {decryptingEntries ? "Decrypting…" : "Decrypt ledger"}
                </button>
                <Link to="/reveal" className="text-xs font-medium inline-flex items-center gap-1 hover:underline">
                  Manage reveals <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
            <ul className="divide-y divide-border/60">
              {loadingEntries && entries.length === 0 && (
                <li className="px-6 py-10 text-center text-sm text-muted-foreground">Loading your ledger from Sepolia…</li>
              )}
              {!loadingEntries && entries.length === 0 && (
                <li className="px-6 py-10 text-center text-sm text-muted-foreground">No trades logged yet.</li>
              )}
              {entries.map((e) => (
                <EntryRow key={e.index} entry={e} highlighted={flashIndex === `entry-${e.index}`} />
              ))}
            </ul>
          </div>

          <aside className="rounded-3xl bg-black text-white p-7 relative overflow-hidden">
            <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-primary/30 blur-3xl" />
            <Lock className="h-6 w-6 text-primary mb-5" />
            <div className="text-lg font-semibold leading-snug">Your P&L is opaque, even to us.</div>
            <p className="text-white/70 text-sm mt-3 leading-relaxed">Zama's FHE contract aggregates entries without decryption. Grant scoped reveals from the Selective Reveal page.</p>
            <Link to="/reveal" className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary text-black px-4 py-2.5 text-sm font-semibold">
              Selective Reveal <ArrowUpRight className="h-4 w-4" />
            </Link>
          </aside>
        </section>
      </main>

      {open && <EntryModal onClose={() => setOpen(false)} />}
    </div>
  );
}

function EntryRow({ entry, highlighted }: { entry: Entry; highlighted?: boolean }) {
  const revealed = entry.decryptedPnl !== undefined;
  const isWin = entry.decryptedIsWin;
  return (
    <li
      id={`entry-${entry.index}`}
      className={`flex items-center gap-4 px-6 py-4 hover:bg-surface/70 transition ${
        highlighted ? "bg-primary/10 ring-1 ring-inset ring-primary/60" : ""
      }`}
    >
      <div
        className={`grid h-10 w-10 place-items-center rounded-2xl ${
          revealed ? (isWin ? "bg-primary/25" : "bg-surface") : "bg-surface"
        }`}
      >
        {!revealed ? (
          <Lock className="h-4 w-4" />
        ) : isWin ? (
          <TrendingUp className="h-4 w-4" />
        ) : (
          <TrendingDown className="h-4 w-4" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">
          {entry.label} <span className="text-muted-foreground font-normal">· {entry.asset}</span>
        </div>
        <div className="text-xs text-muted-foreground tabular-nums">
          {revealed ? `${isWin ? "+" : "-"}${entry.decryptedPnl}` : `${entry.pnlHandle.slice(0, 10)}…`} · {timeAgo(entry.ts * 1000)}
        </div>
      </div>
      <span className="hidden sm:inline-flex text-[11px] rounded-full bg-surface px-2.5 py-1 label-caps text-muted-foreground">
        {revealed ? "Decrypted" : "Encrypted"}
      </span>
    </li>
  );
}

function StatCard({ label, value, sub, icon: Icon, accent }: { label: string; value: string; sub: string; icon: React.ComponentType<{ className?: string }>; accent?: boolean }) {
  return (
    <div className="rounded-3xl bg-background border border-border/60 shadow-soft p-6">
      <div className="flex items-center justify-between">
        <div className="label-caps text-muted-foreground">{label}</div>
        <div className={`grid h-9 w-9 place-items-center rounded-xl ${accent ? "bg-primary text-black" : "bg-surface"}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className={`mt-6 text-4xl font-bold tracking-tight tabular-nums ${accent ? "" : ""}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-2">{sub}</div>
    </div>
  );
}

function EntryModal({ onClose }: { onClose: () => void }) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [asset, setAsset] = useState("ETH");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!label || submitting) return;
    setSubmitting(true);
    try {
      await walletStore.addEntry(label, asset, Number(amount) || 0);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="absolute inset-0 bg-black/40 animate-in fade-in" onClick={onClose} />
      <form onSubmit={submit} className="relative w-full sm:max-w-lg bg-background rounded-t-3xl sm:rounded-3xl shadow-pop border border-border/60 animate-in slide-in-from-bottom-4 sm:zoom-in-95">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border/60">
          <div>
            <div className="text-base font-semibold">New P&L Entry</div>
            <div className="text-xs text-muted-foreground">Encrypted client-side before submission</div>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-surface hover:bg-border/60"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-6 space-y-5">
          <Field label="Trade label">
            <input required value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. ETH swing (Q4)" className="w-full rounded-2xl bg-surface px-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-primary transition" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Asset">
              <select value={asset} onChange={(e) => setAsset(e.target.value)} className="w-full rounded-2xl bg-surface px-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-primary">
                <option>ETH</option><option>BTC</option><option>SOL</option><option>Other</option>
              </select>
            </Field>
            <Field label="P&L (positive = win, negative = loss)">
              <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" placeholder="150 or -40" className="w-full rounded-2xl bg-surface px-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-primary tabular-nums" />
            </Field>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-primary/15 px-4 py-3 text-xs">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            Values are encrypted with FHE before being posted to Sepolia. Only the trade's label/asset are stored locally in your browser — the chain never sees them.
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border/60 bg-surface/50 rounded-b-3xl">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2.5 text-sm font-medium hover:bg-background">Cancel</button>
          <button type="submit" disabled={submitting} className="rounded-full bg-primary text-black px-5 py-2.5 text-sm font-semibold hover:brightness-95 disabled:opacity-60">
            {submitting ? "Encrypting & submitting…" : "Encrypt & submit"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="label-caps text-muted-foreground mb-2">{label}</div>
      {children}
    </label>
  );
}
