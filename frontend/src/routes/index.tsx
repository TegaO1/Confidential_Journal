import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Lock, Eye, ShieldCheck, Sparkles } from "lucide-react";
import { TopNav } from "@/components/top-nav";
import { useWallet, walletStore } from "@/lib/wallet-store";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const { address } = useWallet();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopNav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-primary/25 blur-3xl" />
        <div className="mx-auto max-w-7xl px-5 sm:px-8 pt-20 pb-24 sm:pt-28 sm:pb-32 relative">
          <div className="inline-flex items-center gap-2 rounded-full bg-surface px-3.5 py-1.5 text-xs font-medium mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Built on Zama Protocol · Sepolia testnet
          </div>
          <h1 className="text-[44px] sm:text-6xl lg:text-7xl font-bold tracking-[-0.03em] leading-[1.02] max-w-4xl">
            Prove your trading track record
            <span className="text-muted-foreground"> without leaking</span>
            <span className="relative inline-block ml-3">
              <span className="relative z-10">a single trade.</span>
              <span className="absolute inset-x-0 bottom-1 h-3 bg-primary/70 -z-0 rounded-sm" />
            </span>
          </h1>
          <p className="mt-7 text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed">
            A confidential journal for serious traders. Your P&L is encrypted end-to-end with Fully Homomorphic Encryption, verified on-chain, and revealed only to whom you choose.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            {address ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 rounded-full bg-primary text-black px-6 py-3.5 text-sm font-semibold shadow-glow hover:brightness-95 transition"
              >
                Open Dashboard <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <button
                onClick={() => walletStore.connect()}
                className="inline-flex items-center gap-2 rounded-full bg-primary text-black px-6 py-3.5 text-sm font-semibold shadow-glow hover:brightness-95 transition"
              >
                Connect Wallet <ArrowRight className="h-4 w-4" />
              </button>
            )}
            <a href="#how" className="inline-flex items-center gap-2 rounded-full bg-surface px-6 py-3.5 text-sm font-semibold hover:bg-border/60 transition">
              How it works
            </a>
          </div>

          <div className="mt-16 grid grid-cols-3 gap-8 max-w-xl">
            <Stat k="FHE" v="Encrypted P&L" />
            <Stat k="0" v="Trades leaked" />
            <Stat k="You" v="Choose verifiers" />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="bg-surface">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 py-24">
          <div className="flex items-end justify-between flex-wrap gap-4 mb-14">
            <div>
              <div className="label-caps text-muted-foreground mb-3">How it works</div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-[-0.02em] max-w-xl">Confidential by design. Verifiable by cryptography.</h2>
            </div>
            <div className="text-sm text-muted-foreground max-w-sm">
              Nothing leaves your control. Every P&L entry is encrypted client-side and computed over ciphertext on-chain.
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Feature icon={Lock} title="Encrypt locally" body="Your P&L is encrypted in the browser before it ever touches the network. Even we can't read it." />
            <Feature icon={Sparkles} title="Compute on ciphertext" body="Zama's FHE runtime aggregates gains, losses, and win-rate on-chain — without decrypting a byte." />
            <Feature icon={Eye} title="Reveal on your terms" body="Grant a verifier, LP, or auditor a scoped view. Revoke access whenever you want." />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-5 sm:px-8 py-24">
        <div className="rounded-[32px] bg-black text-white p-10 sm:p-16 relative overflow-hidden">
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-primary/30 blur-3xl" />
          <ShieldCheck className="h-8 w-8 text-primary mb-6" />
          <h3 className="text-3xl sm:text-5xl font-bold tracking-[-0.02em] max-w-2xl leading-[1.05]">Your edge stays yours. Your reputation compounds.</h3>
          <p className="mt-5 text-white/70 max-w-xl">Start journaling encrypted trades in under a minute. No custody, no exposure.</p>
          <div className="mt-8">
            {address ? (
              <Link to="/dashboard" className="inline-flex items-center gap-2 rounded-full bg-primary text-black px-6 py-3.5 text-sm font-semibold hover:brightness-95 transition">
                Open Dashboard <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <button onClick={() => walletStore.connect()} className="inline-flex items-center gap-2 rounded-full bg-primary text-black px-6 py-3.5 text-sm font-semibold hover:brightness-95 transition">
                Connect Wallet <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-7xl px-5 sm:px-8 pb-10 flex justify-between text-xs text-muted-foreground">
        <div>© {new Date().getFullYear()} Confidential Journal</div>
        <div>FHE by Zama · Sepolia</div>
      </footer>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-3xl font-bold tracking-tight">{k}</div>
      <div className="text-xs text-muted-foreground mt-1">{v}</div>
    </div>
  );
}

function Feature({ icon: Icon, title, body }: { icon: React.ComponentType<{ className?: string }>; title: string; body: string }) {
  return (
    <div className="rounded-3xl bg-background p-7 shadow-soft border border-border/60">
      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/20 mb-5">
        <Icon className="h-5 w-5" />
      </div>
      <div className="font-semibold text-base">{title}</div>
      <div className="text-sm text-muted-foreground mt-2 leading-relaxed">{body}</div>
    </div>
  );
}
