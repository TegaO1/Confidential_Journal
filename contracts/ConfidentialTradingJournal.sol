// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {FHE, euint32, euint64, ebool, externalEuint64, externalEbool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title Confidential Trading Journal
/// @author BigGbotex
/// @notice Lets a trader log per-trade P&L fully encrypted on-chain, while letting
///         them selectively reveal only *aggregate* performance stats (total gains,
///         total losses, win rate, trade count) to a chosen verifier — without ever
///         exposing individual trade sizes, entries, or strategy patterns.
/// @dev Individual trades are stored as ciphertext handles the trader alone can decrypt.
///      Aggregates are ciphertext handles too; a trader can grant a specific verifier
///      address ACL permission to decrypt *only* the aggregates via the Zama relayer's
///      user-decryption flow, keeping every individual trade private forever.
contract ConfidentialTradingJournal is ZamaEthereumConfig {
    /// @notice A single encrypted trade record.
    struct Trade {
        euint64 pnlMagnitude; // absolute value of the trade's P&L, encrypted
        ebool isWin; // true if this trade was profitable, encrypted
        uint256 timestamp; // plaintext — reveals *when* a trade happened, not its size
    }

    /// @notice Encrypted running aggregates for a trader.
    struct Aggregates {
        euint64 totalGains; // sum of pnlMagnitude across winning trades
        euint64 totalLosses; // sum of pnlMagnitude across losing trades
        euint32 winCount;
        euint32 lossCount;
    }

    mapping(address => Trade[]) private _trades;
    mapping(address => Aggregates) private _aggregates;
    mapping(address => bool) private _initialized;

    event TradeSubmitted(address indexed trader, uint256 indexed tradeIndex, uint256 timestamp);
    event VerifierAccessGranted(address indexed trader, address indexed verifier);

    /// @notice Submit a new encrypted trade result.
    /// @param encPnlMagnitude Encrypted absolute P&L of the trade (client-encrypted euint64).
    /// @param encIsWin Encrypted flag: true if the trade was a win, false if a loss.
    /// @param inputProof Zama relayer proof binding both ciphertexts to this contract + sender.
    function submitTrade(
        externalEuint64 encPnlMagnitude,
        externalEbool encIsWin,
        bytes calldata inputProof
    ) external {
        euint64 pnlMagnitude = FHE.fromExternal(encPnlMagnitude, inputProof);
        ebool isWin = FHE.fromExternal(encIsWin, inputProof);

        // --- store the individual trade (private to the trader only) ---
        _trades[msg.sender].push(Trade({pnlMagnitude: pnlMagnitude, isWin: isWin, timestamp: block.timestamp}));

        FHE.allowThis(pnlMagnitude);
        FHE.allow(pnlMagnitude, msg.sender);
        FHE.allowThis(isWin);
        FHE.allow(isWin, msg.sender);

        // --- update running encrypted aggregates ---
        Aggregates storage agg = _aggregates[msg.sender];
        if (!_initialized[msg.sender]) {
            agg.totalGains = FHE.asEuint64(0);
            agg.totalLosses = FHE.asEuint64(0);
            agg.winCount = FHE.asEuint32(0);
            agg.lossCount = FHE.asEuint32(0);
            _initialized[msg.sender] = true;
        }

        euint64 zero64 = FHE.asEuint64(0);
        euint64 gainAdd = FHE.select(isWin, pnlMagnitude, zero64);
        euint64 lossAdd = FHE.select(isWin, zero64, pnlMagnitude);
        agg.totalGains = FHE.add(agg.totalGains, gainAdd);
        agg.totalLosses = FHE.add(agg.totalLosses, lossAdd);

        euint32 one32 = FHE.asEuint32(1);
        euint32 zero32 = FHE.asEuint32(0);
        agg.winCount = FHE.add(agg.winCount, FHE.select(isWin, one32, zero32));
        agg.lossCount = FHE.add(agg.lossCount, FHE.select(isWin, zero32, one32));

        FHE.allowThis(agg.totalGains);
        FHE.allow(agg.totalGains, msg.sender);
        FHE.allowThis(agg.totalLosses);
        FHE.allow(agg.totalLosses, msg.sender);
        FHE.allowThis(agg.winCount);
        FHE.allow(agg.winCount, msg.sender);
        FHE.allowThis(agg.lossCount);
        FHE.allow(agg.lossCount, msg.sender);

        emit TradeSubmitted(msg.sender, _trades[msg.sender].length - 1, block.timestamp);
    }

    /// @notice Grants a verifier permission to decrypt ONLY your aggregate stats
    ///         (total gains, total losses, win count, loss count) — never your
    ///         individual trades. Call this once per verifier you want to prove
    ///         your track record to.
    /// @param verifier The address that should be able to decrypt your aggregates.
    function grantVerifierAccess(address verifier) external {
        require(_initialized[msg.sender], "No trades submitted yet");
        Aggregates storage agg = _aggregates[msg.sender];

        FHE.allow(agg.totalGains, verifier);
        FHE.allow(agg.totalLosses, verifier);
        FHE.allow(agg.winCount, verifier);
        FHE.allow(agg.lossCount, verifier);

        emit VerifierAccessGranted(msg.sender, verifier);
    }

    /// @notice Returns the encrypted aggregate stat handles for a trader.
    /// @dev The caller can only decrypt these client-side via the relayer if they
    ///      hold ACL permission (i.e. they are the trader, or were granted access).
    function getAggregates(
        address trader
    ) external view returns (euint64 totalGains, euint64 totalLosses, euint32 winCount, euint32 lossCount) {
        Aggregates storage agg = _aggregates[trader];
        return (agg.totalGains, agg.totalLosses, agg.winCount, agg.lossCount);
    }

    /// @notice Returns how many trades a trader has logged. Plaintext — reveals
    ///         activity level only, never size or outcome of any trade.
    function getTradeCount(address trader) external view returns (uint256) {
        return _trades[trader].length;
    }

    /// @notice Returns a single encrypted trade record. Only the trader (or anyone
    ///         they've individually granted ACL access to via FHE.allow) can decrypt it.
    function getTrade(
        address trader,
        uint256 index
    ) external view returns (euint64 pnlMagnitude, ebool isWin, uint256 timestamp) {
        Trade storage t = _trades[trader][index];
        return (t.pnlMagnitude, t.isWin, t.timestamp);
    }
}
