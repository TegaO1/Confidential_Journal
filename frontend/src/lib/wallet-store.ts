import { useSyncExternalStore } from "react";
import { Contract, type Signer } from "ethers";
import { CONTRACT_ADDRESS, JOURNAL_ABI } from "./contract";
import { connectWallet, encryptTrade, userDecryptHandles } from "./fhevm";

type Notification = {
  id: string;
  title: string;
  detail?: string;
  ts: number;
};

export type Entry = {
  index: number;
  ts: number; // real on-chain timestamp (seconds)
  pnlHandle: string;
  isWinHandle: string;
  // Labels/assets aren't stored on-chain (the contract only stores
  // magnitude + win/loss + timestamp), so this metadata lives in
  // localStorage, scoped to the connected address.
  label: string;
  asset: string;
  decryptedPnl?: bigint;
  decryptedIsWin?: boolean;
};

export type AggregatesState = {
  totalGainsHandle?: string;
  totalLossesHandle?: string;
  winCountHandle?: string;
  lossCountHandle?: string;
  gains?: bigint;
  losses?: bigint;
  winCount?: bigint;
  lossCount?: bigint;
};

export type Reveal = {
  address: string;
  enabled: boolean; // whether we keep refreshing their access on new trades
  grantedAt: number;
};

type State = {
  address: string | null;
  signer: Signer | null;
  connecting: boolean;
  connectError: string | null;

  entries: Entry[];
  loadingEntries: boolean;
  decryptingEntries: boolean;

  aggregates: AggregatesState;
  decryptingAggregates: boolean;

  reveals: Reveal[];

  notifications: Notification[];
};

const initialState: State = {
  address: null,
  signer: null,
  connecting: false,
  connectError: null,
  entries: [],
  loadingEntries: false,
  decryptingEntries: false,
  aggregates: {},
  decryptingAggregates: false,
  reveals: [],
  notifications: [],
};

let state: State = { ...initialState };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
function setState(patch: Partial<State>) {
  state = { ...state, ...patch };
  emit();
}
function pushNotification(title: string, detail?: string) {
  setState({
    notifications: [{ id: crypto.randomUUID(), title, detail, ts: Date.now() }, ...state.notifications],
  });
}

// --- localStorage-backed metadata (labels/assets/reveal grants aren't on-chain) ---

function metaKey(address: string) {
  return `journal:meta:${address.toLowerCase()}`;
}
function revealsKey(address: string) {
  return `journal:reveals:${address.toLowerCase()}`;
}

function readMeta(address: string): Record<number, { label: string; asset: string }> {
  try {
    return JSON.parse(localStorage.getItem(metaKey(address)) ?? "{}");
  } catch {
    return {};
  }
}
function writeMeta(address: string, meta: Record<number, { label: string; asset: string }>) {
  localStorage.setItem(metaKey(address), JSON.stringify(meta));
}
function readReveals(address: string): Reveal[] {
  try {
    return JSON.parse(localStorage.getItem(revealsKey(address)) ?? "[]");
  } catch {
    return [];
  }
}
function writeReveals(address: string, reveals: Reveal[]) {
  localStorage.setItem(revealsKey(address), JSON.stringify(reveals));
}

function getContract(runner: Signer) {
  return new Contract(CONTRACT_ADDRESS, JOURNAL_ABI, runner);
}

export const walletStore = {
  getState: () => state,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },

  async connect() {
    setState({ connecting: true, connectError: null });
    try {
      const { signer, address } = await connectWallet();
      setState({ signer, address, reveals: readReveals(address) });
      pushNotification("Wallet connected", "Sepolia network");
      await Promise.all([walletStore.refreshEntries(), walletStore.refreshAggregates()]);
    } catch (err: any) {
      setState({ connectError: err?.message ?? "Failed to connect wallet" });
    } finally {
      setState({ connecting: false });
    }
  },

  disconnect() {
    // Dapps can't force-disconnect an injected wallet session; this only
    // clears local app state. Fully disconnecting happens from MetaMask itself.
    setState({ ...initialState, notifications: state.notifications });
  },

  async refreshEntries() {
    const { signer, address } = state;
    if (!signer || !address) return;
    setState({ loadingEntries: true });
    try {
      const contract = getContract(signer);
      const count: bigint = await contract.getTradeCount(address);
      const meta = readMeta(address);
      const prevByIndex = new Map(state.entries.map((e) => [e.index, e]));
      const loaded: Entry[] = [];
      for (let i = 0; i < Number(count); i++) {
        const [pnlHandle, isWinHandle, ts] = await contract.getTrade(address, i);
        const prev = prevByIndex.get(i);
        loaded.push({
          index: i,
          ts: Number(ts),
          pnlHandle,
          isWinHandle,
          label: meta[i]?.label ?? `Trade #${i + 1}`,
          asset: meta[i]?.asset ?? "—",
          decryptedPnl: prev?.decryptedPnl,
          decryptedIsWin: prev?.decryptedIsWin,
        });
      }
      setState({ entries: loaded.reverse() });
    } finally {
      setState({ loadingEntries: false });
    }
  },

  async refreshAggregates() {
    const { signer, address } = state;
    if (!signer || !address) return;
    const contract = getContract(signer);
    const [totalGainsHandle, totalLossesHandle, winCountHandle, lossCountHandle] = await contract.getAggregates(
      address,
    );
    setState({
      aggregates: { ...state.aggregates, totalGainsHandle, totalLossesHandle, winCountHandle, lossCountHandle },
    });
  },

  /** Encrypts + submits a trade, then re-grants any tracked verifiers so their
   *  access follows the fresh aggregate ciphertext handles (each FHE.add
   *  produces a new handle — see submitTrade in the contract — so a verifier's
   *  earlier grant would otherwise go stale the moment a new trade is logged). */
  async addEntry(label: string, asset: string, amount: number) {
    const { signer, address } = state;
    if (!signer || !address) return;
    const magnitude = BigInt(Math.abs(Math.trunc(amount)));
    const isWin = amount >= 0;
    if (magnitude === 0n) {
      pushNotification("Enter a non-zero P&L", "Amount must not be zero");
      return;
    }
    try {
      pushNotification("Encrypting trade client-side…", label);
      const { encPnlMagnitude, encIsWin, inputProof } = await encryptTrade(CONTRACT_ADDRESS, address, magnitude, isWin);
      const contract = getContract(signer);
      const tx = await contract.submitTrade(encPnlMagnitude, encIsWin, inputProof);
      await tx.wait();

      const meta = readMeta(address);
      const nextIndex = state.entries.length ? Math.max(...state.entries.map((e) => e.index)) + 1 : 0;
      meta[nextIndex] = { label, asset };
      writeMeta(address, meta);

      pushNotification("Encrypted entry submitted", `${label} · tx ${tx.hash.slice(0, 10)}…`);
      await walletStore.refreshEntries();
      await walletStore.refreshAggregates();
      await walletStore.reGrantTrackedReveals();
    } catch (err: any) {
      pushNotification("Trade submission failed", err?.shortMessage ?? err?.message ?? "Unknown error");
    }
  },

  async decryptEntries() {
    const { signer, entries } = state;
    if (!signer || entries.length === 0) return;
    setState({ decryptingEntries: true });
    try {
      const labeled: Record<string, string> = {};
      entries.forEach((e) => {
        labeled[`pnl:${e.index}`] = e.pnlHandle;
        labeled[`win:${e.index}`] = e.isWinHandle;
      });
      const result = await userDecryptHandles(CONTRACT_ADDRESS, signer, labeled);
      setState({
        entries: state.entries.map((e) => ({
          ...e,
          decryptedPnl: result[`pnl:${e.index}`],
          decryptedIsWin: Boolean(result[`win:${e.index}`]),
        })),
      });
    } catch (err: any) {
      pushNotification("Decryption failed", err?.message ?? "Unknown error");
    } finally {
      setState({ decryptingEntries: false });
    }
  },

  async decryptAggregates() {
    const { signer, aggregates } = state;
    if (!signer || !aggregates.totalGainsHandle) return;
    setState({ decryptingAggregates: true });
    try {
      const result = await userDecryptHandles(CONTRACT_ADDRESS, signer, {
        gains: aggregates.totalGainsHandle,
        losses: aggregates.totalLossesHandle!,
        winCount: aggregates.winCountHandle!,
        lossCount: aggregates.lossCountHandle!,
      });
      setState({
        aggregates: {
          ...aggregates,
          gains: result.gains,
          losses: result.losses,
          winCount: result.winCount,
          lossCount: result.lossCount,
        },
      });
    } catch (err: any) {
      pushNotification("Decryption failed", err?.message ?? "Unknown error");
    } finally {
      setState({ decryptingAggregates: false });
    }
  },

  async grantReveal(addr: string) {
    const { signer, address } = state;
    if (!signer || !address) return;
    try {
      const contract = getContract(signer);
      const tx = await contract.grantVerifierAccess(addr);
      await tx.wait();
      const reveals = [
        { address: addr, enabled: true, grantedAt: Date.now() },
        ...state.reveals.filter((r) => r.address.toLowerCase() !== addr.toLowerCase()),
      ];
      setState({ reveals });
      writeReveals(address, reveals);
      pushNotification("Reveal granted", `${addr.slice(0, 10)}… · tx ${tx.hash.slice(0, 10)}…`);
    } catch (err: any) {
      pushNotification("Grant failed", err?.shortMessage ?? err?.message ?? "Unknown error");
    }
  },

  /** Soft "revoke": fhEVM ACL grants can't be un-granted once made, so this
   *  only stops this verifier from being auto-refreshed on your next trade.
   *  Their access to the *current* aggregates remains valid until then. */
  toggleReveal(addr: string) {
    const { address } = state;
    if (!address) return;
    const reveals = state.reveals.map((r) => (r.address === addr ? { ...r, enabled: !r.enabled } : r));
    setState({ reveals });
    writeReveals(address, reveals);
  },

  removeReveal(addr: string) {
    const { address } = state;
    if (!address) return;
    const reveals = state.reveals.filter((r) => r.address !== addr);
    setState({ reveals });
    writeReveals(address, reveals);
    pushNotification(
      "Verifier removed from auto-refresh",
      "Their access to already-granted aggregates lapses after your next trade.",
    );
  },

  async reGrantTrackedReveals() {
    const { signer, address, reveals } = state;
    if (!signer || !address) return;
    const contract = getContract(signer);
    for (const r of reveals.filter((r) => r.enabled)) {
      try {
        const tx = await contract.grantVerifierAccess(r.address);
        await tx.wait();
      } catch (err: any) {
        pushNotification(
          "Verifier re-grant failed",
          `${r.address.slice(0, 10)}… — ${err?.shortMessage ?? err?.message ?? "unknown error"}`,
        );
      }
    }
  },

  clearNotifications() {
    setState({ notifications: [] });
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
