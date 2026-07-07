# Confidential Trading Journal

Prove your trading track record without leaking a single trade.

Built for the [Zama Developer Program Builder Track](https://docs.zama.org/protocol), this is a confidential
dApp where traders log encrypted P&L on-chain and selectively reveal only their **aggregate** performance
(total gains, total losses, win rate) to chosen verifiers, while every individual trade stays permanently
encrypted, even from the trader's own view outside of a decrypt request.

**Live demo:** https://confidentialtradingjournal.netlify.app
**Contract (Sepolia):** [`0x916deA5b2B7e1c55fec6e39F77cFFF43D5121081`](https://sepolia.etherscan.io/address/0x916deA5b2B7e1c55fec6e39F77cFFF43D5121081)

## The problem

Traders who want to prove their track record i.e, to an investor, a DAO, a copy-trading platform and have two bad
options today: publish every trade (leaking strategy and position sizing to competitors), or publish nothing
(and lose all credibility). There's no way to prove *you're good* without revealing *how* you're good.

## The solution

Every trade is encrypted client-side using Fully Homomorphic Encryption (FHE) before it ever touches the
blockchain. The smart contract updates running aggregates (total gains, total losses, win/loss counts)
*homomorphically*. computing on ciphertext without ever decrypting it. A trader can then grant a specific
verifier address permission to decrypt only those four aggregate values, never a single underlying trade.

## How it works

1. **Log a trade** — a trader submits an encrypted `(pnlMagnitude, isWin)` pair. The contract never sees the
   plaintext value.
2. **Aggregates update on ciphertext** — `FHE.select` branches on the encrypted win/loss flag to route the
   magnitude into either the encrypted `totalGains` or `totalLosses` running sum, with no plaintext branching.
3. **Grant verifier access** — the trader calls `grantVerifierAccess(address)`, giving one address ACL
   permission to decrypt the four aggregate ciphertexts (and only those).
4. **Verify** — anyone can attempt to decrypt any trader's aggregates. Without a grant, the Zama relayer
   rejects the request outright — individual trades are never exposed, to anyone, at any point.

## Repo structure
## Quick start

**Contracts:**

```bash
npm install
npx hardhat vars set MNEMONIC
npx hardhat vars set INFURA_API_KEY
npx hardhat compile
npx hardhat test
npx hardhat deploy --network sepolia
```

See [DEPLOY.md](./DEPLOY.md) for the full runbook, including CLI tasks to submit trades and read aggregates
without needing the frontend.

**Frontend:**

```bash
cd frontend
npm install
# paste your deployed contract address into src/lib/contract.ts
npm run dev
```

See [frontend/README.md](./frontend/README.md) for details on how the UI maps to the contract's ACL model.

## Tech stack

- **Solidity + FHEVM** (`@fhevm/solidity`) — encrypted `euint64`/`euint32`/`ebool` types, homomorphic
  aggregate updates, ACL-gated decryption
- **Hardhat** — compilation, testing (mock FHEVM), deployment to Sepolia
- **Vite + React + TypeScript** — frontend
- **`@zama-fhe/relayer-sdk`** — client-side encryption and EIP-712-authorized user decryption
- **ethers v6** — wallet connection and contract calls

## Built by

[BigGbotex](https://github.com/BigGbotex)
