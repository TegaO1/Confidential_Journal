import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, ChevronDown, ExternalLink, LogOut, Menu, RefreshCw, Shield, X } from "lucide-react";
import { truncate, useWallet, walletStore, timeAgo, etherscanTxUrl, type Notification } from "@/lib/wallet-store";

export function TopNav() {
  const { address, notifications, connecting, connectError } = useWallet();
  const [notifOpen, setNotifOpen] = useState(false);
  const [walletMenu, setWalletMenu] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const walletRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (walletRef.current && !walletRef.current.contains(e.target as Node)) setWalletMenu(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function handleNotifClick(n: Notification) {
    if (!n.navigateTo) return;
    navigate({ to: n.navigateTo, search: n.highlight ? ({ highlight: n.highlight } as any) : undefined });
    setNotifOpen(false);
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-black">
            <Shield className="h-4 w-4 text-primary" strokeWidth={2.5} />
          </div>
          <span className="text-sm font-bold tracking-tight">Confidential<span className="text-muted-foreground font-medium">/Journal</span></span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 rounded-full bg-surface p-1">
          <NavLink to="/">Home</NavLink>
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/reveal">Selective Reveal</NavLink>
        </nav>

        <div className="flex items-center gap-2">
          {/* Notifications */}
          <div ref={notifRef} className="relative">
            <button
              onClick={() => setNotifOpen((v) => !v)}
              aria-label="Notifications"
              className="relative grid h-10 w-10 place-items-center rounded-full bg-surface hover:bg-border/60 transition"
            >
              <Bell className="h-[18px] w-[18px]" />
              {notifications.length > 0 && (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
              )}
            </button>
            {notifOpen && (
              <>
                {/* Mobile full-width sheet */}
                <div className="sm:hidden fixed inset-0 z-50 bg-black/30 animate-in fade-in" onClick={() => setNotifOpen(false)} />
                <div className={`fixed sm:absolute inset-x-0 bottom-0 sm:inset-auto sm:right-0 sm:top-[calc(100%+8px)] sm:w-[380px] z-50 rounded-t-3xl sm:rounded-3xl bg-popover shadow-pop border border-border/60 animate-in slide-in-from-bottom-4 sm:slide-in-from-top-2`}>
                  <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
                    <div>
                      <div className="text-sm font-semibold">Notifications</div>
                      <div className="text-xs text-muted-foreground">Recent on-chain activity</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => walletStore.clearNotifications()} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
                      <button onClick={() => setNotifOpen(false)} className="grid h-8 w-8 place-items-center rounded-full hover:bg-surface"><X className="h-4 w-4" /></button>
                    </div>
                  </div>
                  <ul className="max-h-[60vh] overflow-y-auto p-2">
                    {notifications.length === 0 && (
                      <li className="px-4 py-10 text-center text-sm text-muted-foreground">You're all caught up.</li>
                    )}
                    {notifications.map((n) => (
                      <li key={n.id} className="rounded-2xl px-1 py-1 hover:bg-surface transition">
                        <button
                          type="button"
                          onClick={() => handleNotifClick(n)}
                          disabled={!n.navigateTo}
                          className="flex items-start gap-3 w-full text-left px-2 py-2 rounded-xl disabled:cursor-default"
                        >
                          <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">{n.title}</div>
                            {n.detail && <div className="text-xs text-muted-foreground truncate">{n.detail}</div>}
                            <div className="text-[11px] text-muted-foreground mt-1">{timeAgo(n.ts)}</div>
                          </div>
                        </button>
                        {n.txHash && (
                          <a
                            href={etherscanTxUrl(n.txHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-7 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                          >
                            View on Etherscan <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>

          {/* Wallet */}
          {address ? (
            <div ref={walletRef} className="relative">
              <button
                onClick={() => setWalletMenu((v) => !v)}
                className="flex items-center gap-2 rounded-full bg-black text-white pl-3 pr-2 py-2 text-sm font-medium hover:opacity-90 transition"
              >
                <span className="h-2 w-2 rounded-full bg-primary" />
                <span className="tabular-nums">{truncate(address)}</span>
                <ChevronDown className="h-4 w-4 opacity-70" />
              </button>
              {walletMenu && (
                <div className="absolute right-0 top-[calc(100%+8px)] w-56 rounded-2xl bg-popover shadow-pop border border-border/60 p-1.5 z-50">
                  <div className="px-3 py-2.5 border-b border-border/60">
                    <div className="text-[11px] label-caps text-muted-foreground">Connected</div>
                    <div className="text-sm font-medium tabular-nums mt-0.5">{truncate(address)}</div>
                    <div className="text-xs text-muted-foreground">Sepolia · Zama FHE</div>
                  </div>
                  <button
                    onClick={() => { walletStore.switchWallet(); setWalletMenu(false); }}
                    className="w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm hover:bg-surface transition"
                  >
                    <RefreshCw className="h-4 w-4" /> Switch Wallet
                  </button>
                  <button
                    onClick={() => { walletStore.disconnect(); setWalletMenu(false); }}
                    className="w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-destructive hover:bg-destructive/5 transition"
                  >
                    <LogOut className="h-4 w-4" /> Disconnect
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden sm:flex flex-col items-end gap-1">
              <button
                onClick={() => walletStore.connect()}
                disabled={connecting}
                className="inline-flex items-center gap-2 rounded-full bg-primary text-black px-4 py-2.5 text-sm font-semibold hover:brightness-95 transition shadow-glow disabled:opacity-60"
              >
                {connecting ? "Connecting…" : "Connect Wallet"}
              </button>
              {connectError && <span className="text-[11px] text-destructive max-w-[220px] text-right">{connectError}</span>}
            </div>
          )}

          <button onClick={() => setMobileOpen(true)} className="md:hidden grid h-10 w-10 place-items-center rounded-full bg-surface">
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-[82%] max-w-sm bg-background p-6 shadow-pop rounded-l-3xl flex flex-col gap-2 animate-in slide-in-from-right">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold">Menu</span>
              <button onClick={() => setMobileOpen(false)} className="grid h-9 w-9 place-items-center rounded-full bg-surface"><X className="h-4 w-4" /></button>
            </div>
            <MobileLink to="/" onClick={() => setMobileOpen(false)}>Home</MobileLink>
            <MobileLink to="/dashboard" onClick={() => setMobileOpen(false)}>Dashboard</MobileLink>
            <MobileLink to="/reveal" onClick={() => setMobileOpen(false)}>Selective Reveal</MobileLink>
            {address ? (
              <button
                onClick={() => { walletStore.switchWallet(); setMobileOpen(false); }}
                className="mt-4 rounded-2xl bg-surface px-4 py-3.5 text-sm font-semibold"
              >
                Switch Wallet
              </button>
            ) : (
              <button
                onClick={() => { walletStore.connect(); setMobileOpen(false); }}
                className="mt-4 rounded-2xl bg-primary text-black px-4 py-3.5 text-sm font-semibold"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === "/" }}
      className="px-4 py-1.5 rounded-full text-sm text-muted-foreground hover:text-foreground transition"
      activeProps={{ className: "px-4 py-1.5 rounded-full text-sm bg-background text-foreground shadow-soft font-medium" }}
    >
      {children}
    </Link>
  );
}

function MobileLink({ to, children, onClick }: { to: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <Link to={to} onClick={onClick} className="rounded-2xl px-4 py-3 text-base font-medium hover:bg-surface">
      {children}
    </Link>
  );
}
