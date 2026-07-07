import type { BrowserProvider as BrowserProviderType, Signer, TypedDataField } from "ethers";
import type { FhevmInstance } from "@zama-fhe/relayer-sdk/web";

let instancePromise: Promise<FhevmInstance> | null = null;
let sdkInitPromise: Promise<boolean> | null = null;

/**
 * Loads ethers + the Zama relayer SDK lazily, client-side only. This file is
 * imported from routes that render on the server (TanStack Start SSR), so a
 * static top-level import of the relayer SDK's WASM engine would run during
 * SSR and fail — every export below dynamically imports what it needs.
 */
async function loadEthers() {
  return import("ethers");
}

async function loadRelayerSdk() {
  return import("@zama-fhe/relayer-sdk/web");
}

function ensureSdkInitialized(): Promise<boolean> {
  if (!sdkInitPromise) {
    sdkInitPromise = loadRelayerSdk().then(({ initSDK }) => initSDK());
  }
  return sdkInitPromise;
}

/** Lazily creates (and caches) the Zama FHEVM relayer instance for Sepolia. */
export function getFhevmInstance(): Promise<FhevmInstance> {
  if (!instancePromise) {
    const eth = (window as any).ethereum;
    if (!eth) {
      throw new Error("No injected wallet found. Install MetaMask to use this app.");
    }
    instancePromise = ensureSdkInitialized().then(async () => {
      const { createInstance, SepoliaConfig } = await loadRelayerSdk();
      return createInstance({ ...SepoliaConfig, network: eth });
    });
  }
  return instancePromise;
}

/** Encrypts a (pnlMagnitude: uint64, isWin: bool) pair for submission to submitTrade. */
export async function encryptTrade(
  contractAddress: string,
  userAddress: string,
  pnlMagnitude: bigint,
  isWin: boolean,
) {
  const instance = await getFhevmInstance();
  const input = instance.createEncryptedInput(contractAddress, userAddress);
  input.add64(pnlMagnitude);
  input.addBool(isWin);
  const encrypted = await input.encrypt();
  return {
    encPnlMagnitude: encrypted.handles[0],
    encIsWin: encrypted.handles[1],
    inputProof: encrypted.inputProof,
  };
}

/**
 * Batched user-decryption of one or more ciphertext handles, all scoped to the
 * same contract. Throws if the connected wallet lacks ACL permission for any
 * of the handles — that's the "access denied" path the UI relies on.
 */
export async function userDecryptHandles(
  contractAddress: string,
  signer: Signer,
  labeledHandles: Record<string, string>,
): Promise<Record<string, bigint>> {
  const instance = await getFhevmInstance();

  const labels = Object.keys(labeledHandles);
  const handleContractPairs = labels.map((label) => ({
    handle: labeledHandles[label],
    contractAddress,
  }));

  const keypair = instance.generateKeypair();
  const startTimestamp = Math.floor(Date.now() / 1000);
  const durationDays = 1;
  const contractAddresses = [contractAddress];

  const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimestamp, durationDays);

  const signature = await signer.signTypedData(
    eip712.domain,
    { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification as unknown as TypedDataField[] },
    eip712.message,
  );

  const userAddress = await signer.getAddress();

  const result = await instance.userDecrypt(
    handleContractPairs,
    keypair.privateKey,
    keypair.publicKey,
    signature.replace("0x", ""),
    contractAddresses,
    userAddress,
    startTimestamp,
    durationDays,
  );

  const out: Record<string, bigint> = {};
  labels.forEach((label, i) => {
    const handle = handleContractPairs[i].handle as `0x${string}`;
    out[label] = BigInt(result[handle] as unknown as string | number | bigint);
  });
  return out;
}

const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7";

/** Connects MetaMask (or any injected wallet), switching to Sepolia if needed. */
export async function connectWallet(): Promise<{ signer: Signer; address: string }> {
  const eth = (window as any).ethereum;
  if (!eth) {
    throw new Error("No injected wallet found. Install MetaMask to use this app.");
  }
  const { BrowserProvider } = await loadEthers();
  const provider: BrowserProviderType = new BrowserProvider(eth);
  await provider.send("eth_requestAccounts", []);

  const network = await provider.getNetwork();
  if (`0x${network.chainId.toString(16)}` !== SEPOLIA_CHAIN_ID_HEX) {
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }] });
    } catch (switchErr: any) {
      if (switchErr?.code === 4902) {
        throw new Error("Sepolia isn't added to your wallet yet. Add it, then reconnect.");
      }
      throw new Error("Please switch your wallet to the Sepolia network to use this app.");
    }
  }

  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  return { signer, address };
}
