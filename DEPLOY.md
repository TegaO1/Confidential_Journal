# Deploying ConfidentialTradingJournal to Sepolia

## 1. Install dependencies (needs unrestricted network access — run locally, not in a sandboxed CI)

```bash
npm install
```

## 2. Configure your secrets (Hardhat's encrypted `vars` store, not a plaintext .env)

```bash
npx hardhat vars set MNEMONIC
# paste a BIP-39 mnemonic for a wallet funded with Sepolia ETH
# (get testnet ETH from https://sepoliafaucet.com or the Zama Discord faucet channel)

npx hardhat vars set INFURA_API_KEY
# paste your Infura project ID (or swap the sepolia `url` in hardhat.config.ts for Alchemy/another RPC)

npx hardhat vars set ETHERSCAN_API_KEY
# optional — only needed if you want `hardhat verify` to work
```

## 3. Compile

```bash
npx hardhat compile
```

## 4. Run the local mock test suite first (fast, free, catches logic bugs before touching Sepolia)

```bash
npx hardhat test
```

## 5. Deploy to Sepolia

```bash
npx hardhat deploy --network sepolia
```

This prints the deployed contract address and saves it under `deployments/sepolia/`.

## 6. Sanity-check the deployment from the CLI (real FHE encryption, real relayer, real gas)

```bash
# Confirm the address
npx hardhat --network sepolia journal:address

# Log a trade: +150 P&L, marked as a win
npx hardhat --network sepolia journal:submit-trade --pnl 150 --win true

# Log a losing trade: -40 P&L
npx hardhat --network sepolia journal:submit-trade --pnl 40 --win false

# Read back your own decrypted aggregates
npx hardhat --network sepolia journal:aggregates --trader <your-deployer-address>

# Grant a second wallet (a "verifier") access to your aggregates only
npx hardhat --network sepolia journal:grant-verifier --verifier <verifier-address>
```

## 7. (Optional) Verify on Etherscan

```bash
npx hardhat verify --network sepolia <deployed-address>
```

## Notes for the demo video

- Sepolia FHE operations are asynchronous under the hood (the coprocessor + KMS take a
  couple of blocks), so transactions may feel a beat slower than a normal ERC-20 transfer —
  budget for that when timing your 3-minute pitch.
- The strongest visual moment: show `journal:aggregates` failing/reverting for a random
  wallet, then succeeding the instant you run `journal:grant-verifier` for it. That's the
  whole value proposition in ten seconds of screen time.
