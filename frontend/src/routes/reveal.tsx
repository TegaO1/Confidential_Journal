import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, Lock, Trash2, UserCheck } from "lucide-react";
import { TopNav } from "@/components/top-nav";
import { useWallet, walletStore } from "@/lib/wallet-store";

export const Route = createFileRoute("/reveal")({
  head: () => ({
    meta: [
      { title: "Selective Reveal — Confidential Trading Journal" },
      { name: "description", content: "Grant scoped, revocable views of your encrypted P&L." },
    ],
  }),
  component: Reveal,
});

function Reveal() {
  const { address, reveals } = useWallet();
  const [addr, setAddr] = useState("");

  function grant(e: React.FormEvent) {
    e.preventDefault();
    if (!/^0x[a-fA-F0-9]{6,}/.test(addr)) return;
    walletStore.grantReveal(addr);
    setAddr("");
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-4xl px-5 sm:px-8 py-14">
        <div className="label-caps text-muted-foreground mb-2">Access</div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-[-0.02em]">Selective Reveal</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-xl">Choose exactly who can decrypt your aggregate stats. Grants are on-chain and revocable at any time.</p>

        {!address && (
          <div className="mt-8 rounded-3xl bg-surface p-6 flex items-center gap-4">
            <Lock className="h-5 w-5" />
            <div className="text-sm">Connect your wallet to manage reveals.</div>
            <button onClick={() => walletStore.connect()} className="ml-auto rounded-full bg-primary text-black px-4 py-2 text-sm font-semibold">Connect</button>
          </div>
        )}

        {address && (
          <>
            <form onSubmit={grant} className="mt-10 rounded-3xl bg-background border border-border/60 shadow-soft p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-5">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/25"><UserCheck className="h-5 w-5" /></div>
                <div>
                  <div className="text-sm font-semibold">Grant a verifier</div>
                  <div className="text-xs text-muted-foreground">They'll receive a scoped decryption key</div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  value={addr}
                  onChange={(e) => setAddr(e.target.value)}
                  placeholder="0xVerifierAddress…"
                  className="flex-1 rounded-2xl bg-surface px-4 py-3.5 text-sm font-mono tabular-nums outline-none focus:ring-2 focus:ring-primary"
                />
                <button className="rounded-2xl bg-primary text-black px-6 py-3.5 text-sm font-semibold hover:brightness-95 transition">Grant reveal</button>
              </div>
            </form>

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
                    <li key={r.address} className="flex items-center gap-4 px-6 py-4">
                      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-surface">
                        <UserCheck className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-mono truncate">{r.address}</div>
                        <div className="text-xs text-muted-foreground">Aggregate stats · win rate</div>
                      </div>
                      <Toggle enabled={r.enabled} onChange={() => walletStore.toggleReveal(r.address)} />
                      <button className="grid h-9 w-9 place-items-center rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
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
