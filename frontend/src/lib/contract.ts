// Deployed on Sepolia — see ../../../DEPLOY.md at the repo root to redeploy your own.
export const CONTRACT_ADDRESS = "0x916deA5b2B7e1c55fec6e39F77cFFF43D5121081";

export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7";

// Matches contracts/ConfidentialTradingJournal.sol. Ciphertext handles (euint64 / ebool /
// euint32 / externalEuint64 / externalEbool) are all ABI-encoded as bytes32 on the wire.
export const JOURNAL_ABI = [
  "function submitTrade(bytes32 encPnlMagnitude, bytes32 encIsWin, bytes inputProof) external",
  "function grantVerifierAccess(address verifier) external",
  "function getAggregates(address trader) external view returns (bytes32 totalGains, bytes32 totalLosses, bytes32 winCount, bytes32 lossCount)",
  "function getTradeCount(address trader) external view returns (uint256)",
  "function getTrade(address trader, uint256 index) external view returns (bytes32 pnlMagnitude, bytes32 isWin, uint256 timestamp)",
  "event TradeSubmitted(address indexed trader, uint256 indexed tradeIndex, uint256 timestamp)",
  "event VerifierAccessGranted(address indexed trader, address indexed verifier)",
] as const;
