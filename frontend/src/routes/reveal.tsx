import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, Lock, Search, ShieldCheck, ShieldX, Trash2, UserCheck } from "lucide-react";
import { TopNav } from "@/components/top-nav";
import { useWallet, walletStore } from "@/lib/wallet-store";

export const Route = createFileRoute("/reveal")({
  validateSearch: (search: Record<string, unknown>): { highlight?: string } =>
    typeof search.highlight === "string" ? { highlight: search.highlight } : {},
  head: () => ({
    meta: [
      { title: "Selective Reveal — Confidential Trading Journal" },
      { name: "description", content: "Grant scoped, revocable views of your encrypted P&L." },
    ],
  }),
  component: Reveal,
});

function Reveal() {
  const { address, reveals, connecting, lookup } = useWallet();
  const { highlight } = Route.useSearch();
  const [addr, setAddr] = useState("");
  const [granting, setGranting] = useState(false);
  const [lookupAddr, setLookupAddr] = useState("");
  const [flashAddr, setFlashAddr] = useState<string | null>(null);

  useEffect(() => {
    if (!highlight) return;
    setFlashAddr(highlight);
    const el = document.getElementById(highlight);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = setTimeout(() => setFlashAddr(null), 2500);
    return () => clearTimeout(t);
  }, [highlight, reveals.length]);

  async function grant(e: React.FormEvent) {
    e.preventDefault();
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr) || granting) return;
    setGranting(true);
    try {
      await walletStore.grantReveal(addr);
      setAddr("");
    } finally {
      setGranting(false);
    }
  }

  function lookupTrader(e: React.FormEvent) {
    e.preventDefault();
    if (!/^0x[a-fA-F0-9]{40}$/.test(lookupAddr)) return;
    walletStore.lookupTrader(lookupAddr);
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-4xl px-5 sm:px-8 py-14">
        <div className="label-caps text-muted-foreground mb-2">Access</div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-[-0.02em]">Selective Reveal</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-xl">
          Choose exactly who can decrypt your aggregate stats. Each grant is an on-chain transaction
          (<code>grantVerifierAccess</code>) — the verifier can only ever decrypt your four aggregate values,
          never an individual trade.
        </p>

        {!address && (
          <div className="mt-8 rounded-3xl bg-surface p-6 flex items-center gap-4">
            <Lock className="h-5 w-5" />
            <div className="text-sm">Connect your wallet to manage reveals.</div>
            <button
              onClick={() => walletStore.connect()}
              disabled={connecting}
              className="ml-auto rounded-full bg-primary text-black px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {connecting ? "Connecting…" : "Connect"}
            </button>
          </div>
        )}

        {address && (
          <>
            <form onSubmit={grant} className="mt-10 rounded-3xl bg-background border border-border/60 shadow-soft p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-5">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/25"><UserCheck className="h-5 w-5" /></div>
                <div>
                  <div className="text-sm font-semibold">Grant a verifier</div>
                  <div className="text-xs text-muted-foreground">They'll be able to decrypt your aggregates via the Zama relayer</div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  value={addr}
                  onChange={(e) => setAddr(e.target.value)}
                  placeholder="0xVerifierAddress…"
                  className="flex-1 rounded-2xl bg-surface px-4 py-3.5 text-sm font-mono tabular-nums outline-none focus:ring-2 focus:ring-primary"
                />
                <button disabled={granting} className="rounded-2xl bg-primary text-black px-6 py-3.5 text-sm font-semibold hover:brightness-95 transition disabled:opacity-60">
                  {granting ? "Granting…" : "Grant reveal"}
                </button>
              </div>
            </form>

            <div className="mt-6 rounded-2xl bg-primary/10 px-5 py-4 text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Note on revocation:</strong> fhEVM permissions can't be un-granted
              once given to a ciphertext. Logging a new trade produces fresh aggregate ciphertexts, and this app
              automatically re-grants every verifier below marked "auto-refresh" so their access keeps working.
              Removing a verifier here stops future re-grants — their access to your current aggregates lapses the
              next time you log a trade, but not before.
            </div>

            <section className="mt-10">
              <div className="flex items-center justify-between mb-4">
                <div className="label-caps text-muted-foreground">Active grants</div>
                <div className="text-xs text-muted-foreground">{reveals.length} total</div>
              </div>
              {reveals.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-border p-12 text-center">
                  <Eye className="h-6 w-6 mx-auto text-muted-foreground mb-3" />
                  <div className="text-sm font-medium">No one can see your stats</div>
                  <div className="text-xs text-muted-foreground mt-1">Add a verifier above to grant scoped access.</div>
                </div>
              ) : (
                <ul className="rounded-3xl bg-background border border-border/60 shadow-soft divide-y divide-border/60 overflow-hidden">
                  {reveals.map((r) => (
                    <li
                      key={r.address}
                      id={`grant-${r.address.toLowerCase()}`}
                      className={`flex items-center gap-4 px-6 py-4 transition ${
                        flashAddr === `grant-${r.address.toLowerCase()}` ? "bg-primary/10 ring-1 ring-inset ring-primary/60" : ""
                      }`}
                    >
                      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-surface">
                        <UserCheck className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-mono truncate">{r.address}</div>
                        <div className="text-xs text-muted-foreground">Aggregate stats · win rate</div>
                      </div>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                        Auto-refresh
                        <Toggle enabled={r.enabled} onChange={() => walletStore.toggleReveal(r.address)} />
                      </label>
                      <button
                        onClick={() => walletStore.removeReveal(r.address)}
                        className="grid h-9 w-9 place-items-center rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="mt-12">
              <div className="label-caps text-muted-foreground mb-4">Verify a trader</div>
              <form onSubmit={lookupTrader} className="rounded-3xl bg-background border border-border/60 shadow-soft p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-5">
                  <div className="grid h-10 w-10 place-items-center rounded-2xl bg-surface"><Search className="h-5 w-5" /></div>
                  <div>
                    <div className="text-sm font-semibold">Request another trader's aggregates</div>
                    <div className="text-xs text-muted-foreground">
                      Works from any connected wallet — succeeds only if that trader granted this wallet access
                    </div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    value={lookupAddr}
                    onChange={(e) => setLookupAddr(e.target.value)}
                    placeholder="0xTraderAddress…"
                    className="flex-1 rounded-2xl bg-surface px-4 py-3.5 text-sm font-mono tabular-nums outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    disabled={lookup.status === "loading"}
                    className="rounded-2xl bg-surface px-6 py-3.5 text-sm font-semibold hover:bg-border/60 transition disabled:opacity-60"
                  >
                    {lookup.status === "loading" ? "Requesting…" : "Request aggregates"}
                  </button>
                </div>

                {lookup.status === "denied" && (
                  <div className="mt-5 flex items-center gap-2 rounded-2xl bg-destructive/10 text-destructive px-4 py-3 text-sm font-medium">
                    <ShieldX className="h-4 w-4" /> Access denied — this trader hasn't granted your wallet access.
                  </div>
                )}

                {lookup.status === "granted" && (
                  <div className="mt-5">
                    <div className="flex items-center gap-2 rounded-2xl bg-primary/15 text-foreground px-4 py-3 text-sm font-medium mb-3">
                      <ShieldCheck className="h-4 w-4 text-primary" /> Access granted — decrypted live from Sepolia
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="rounded-2xl bg-surface p-4">
                        <div className="text-[11px] label-caps text-muted-foreground">Gains</div>
                        <div className="text-xl font-bold tabular-nums mt-1">{lookup.gains.toString()}</div>
                      </div>
                      <div className="rounded-2xl bg-surface p-4">
                        <div className="text-[11px] label-caps text-muted-foreground">Losses</div>
                        <div className="text-xl font-bold tabular-nums mt-1">{lookup.losses.toString()}</div>
                      </div>
                      <div className="rounded-2xl bg-surface p-4">
                        <div className="text-[11px] label-caps text-muted-foreground">Win / Loss</div>
                        <div className="text-xl font-bold tabular-nums mt-1">
                          {lookup.winCount.toString()} / {lookup.lossCount.toString()}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </form>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      role="switch"
      aria-checked={enabled}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${enabled ? "bg-primary" : "bg-border"}`}
    >
      <span className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5" : ""}`} />
    </button>
  );
}
