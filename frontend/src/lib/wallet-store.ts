import { useSyncExternalStore } from "react";

type Notification = {
  id: string;
  title: string;
  detail?: string;
  ts: number;
};

type State = {
  address: string | null;
  entries: { id: string; label: string; encrypted: string; ts: number; kind: "gain" | "loss" }[];
  reveals: { address: string; enabled: boolean }[];
  notifications: Notification[];
};

let state: State = {
  address: null,
  entries: [
    { id: "e1", label: "ETH swing (Q3)", encrypted: "0x8f…c21a", ts: Date.now() - 86400000 * 3, kind: "gain" },
    { id: "e2", label: "Perp short SOL", encrypted: "0x14…9ab2", ts: Date.now() - 86400000 * 5, kind: "loss" },
    { id: "e3", label: "Basis trade BTC", encrypted: "0xa2…7f01", ts: Date.now() - 86400000 * 8, kind: "gain" },
  ],
  reveals: [],
  notifications: [
    { id: "n1", title: "Transaction confirmed on Sepolia", detail: "0xa2…7f01", ts: Date.now() - 1000 * 60 * 12 },
    { id: "n2", title: "Encrypted entry submitted", detail: "Basis trade BTC", ts: Date.now() - 1000 * 60 * 60 * 2 },
  ],
};

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const walletStore = {
  getState: () => state,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  connect: () => {
    const rand = Math.random().toString(16).slice(2, 6);
    state = {
      ...state,
      address: `0x1a2f${rand}${Math.random().toString(16).slice(2, 6)}9f3`,
      notifications: [
        { id: crypto.randomUUID(), title: "Wallet connected", detail: "Sepolia network", ts: Date.now() },
        ...state.notifications,
      ],
    };
    emit();
  },
  disconnect: () => {
    state = { ...state, address: null };
    emit();
  },
  addEntry: (label: string, amount: number) => {
    const kind = amount >= 0 ? "gain" : "loss";
    state = {
      ...state,
      entries: [
        { id: crypto.randomUUID(), label, encrypted: `0x${Math.random().toString(16).slice(2, 6)}…${Math.random().toString(16).slice(2, 6)}`, ts: Date.now(), kind },
        ...state.entries,
      ],
      notifications: [
        { id: crypto.randomUUID(), title: "Encrypted entry submitted", detail: label, ts: Date.now() },
        ...state.notifications,
      ],
    };
    emit();
  },
  grantReveal: (addr: string) => {
    state = {
      ...state,
      reveals: [{ address: addr, enabled: true }, ...state.reveals.filter((r) => r.address !== addr)],
      notifications: [
        { id: crypto.randomUUID(), title: "Reveal granted", detail: addr, ts: Date.now() },
        ...state.notifications,
      ],
    };
    emit();
  },
  toggleReveal: (addr: string) => {
    state = {
      ...state,
      reveals: state.reveals.map((r) => (r.address === addr ? { ...r, enabled: !r.enabled } : r)),
    };
    emit();
  },
  clearNotifications: () => {
    state = { ...state, notifications: [] };
    emit();
  },
};

export function useWallet() {
  return useSyncExternalStore(walletStore.subscribe, walletStore.getState, walletStore.getState);
}

export function truncate(addr: string) {
  return `${addr.slice(0, 5)}…${addr.slice(-3)}`;
}

export function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
