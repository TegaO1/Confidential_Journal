import { FhevmType } from "@fhevm/hardhat-plugin";
import { task, types } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

/**
 * Example usage:
 *
 *   npx hardhat --network localhost journal:address
 *   npx hardhat --network localhost journal:submit-trade --pnl 100 --win true
 *   npx hardhat --network localhost journal:aggregates --trader 0xabc...
 *   npx hardhat --network localhost journal:grant-verifier --verifier 0xdef...
 *
 * Swap --network localhost for --network sepolia once deployed there.
 */

task("journal:address", "Prints the deployed ConfidentialTradingJournal address").setAction(async (_args, hre) => {
  const deployment = await hre.deployments.get("ConfidentialTradingJournal");
  console.log("ConfidentialTradingJournal:", deployment.address);
});

task("journal:submit-trade", "Submits an encrypted trade (pnl magnitude + win/loss flag)")
  .addParam("pnl", "Absolute P&L of the trade (integer, no decimals)", undefined, types.int)
  .addParam("win", "true if this trade was profitable, false otherwise", undefined, types.boolean)
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments, fhevm } = hre;
    await fhevm.initializeCLIApi();

    const deployment = await deployments.get("ConfidentialTradingJournal");
    const [trader] = await ethers.getSigners();
    const journal = await ethers.getContractAt("ConfidentialTradingJournal", deployment.address);

    const input = fhevm.createEncryptedInput(deployment.address, trader.address);
    input.add64(BigInt(args.pnl));
    input.addBool(args.win);
    const encrypted = await input.encrypt();

    const tx = await journal
      .connect(trader)
      .submitTrade(encrypted.handles[0], encrypted.handles[1], encrypted.inputProof);
    const receipt = await tx.wait();

    console.log(`Trade submitted by ${trader.address} — tx: ${receipt?.hash}`);
  });

task("journal:grant-verifier", "Grants a verifier address permission to decrypt YOUR aggregates only")
  .addParam("verifier", "Address to grant aggregate-decrypt access to")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments } = hre;
    const deployment = await deployments.get("ConfidentialTradingJournal");
    const [trader] = await ethers.getSigners();
    const journal = await ethers.getContractAt("ConfidentialTradingJournal", deployment.address);

    const tx = await journal.connect(trader).grantVerifierAccess(args.verifier);
    const receipt = await tx.wait();

    console.log(`Granted ${args.verifier} access to ${trader.address}'s aggregates — tx: ${receipt?.hash}`);
  });

task("journal:aggregates", "Decrypts a trader's aggregate stats (caller must have ACL access)")
  .addParam("trader", "Address of the trader whose aggregates to read")
  .setAction(async (args: TaskArguments, hre) => {
    const { ethers, deployments, fhevm } = hre;
    await fhevm.initializeCLIApi();

    const deployment = await deployments.get("ConfidentialTradingJournal");
    const [caller] = await ethers.getSigners();
    const journal = await ethers.getContractAt("ConfidentialTradingJournal", deployment.address);

    const tradeCount = await journal.getTradeCount(args.trader);
    console.log(`Trade count for ${args.trader}: ${tradeCount}`);

    const [encGains, encLosses, encWins, encLossCount] = await journal.getAggregates(args.trader);

    const gains = await fhevm.userDecryptEuint(FhevmType.euint64, encGains, deployment.address, caller);
    const losses = await fhevm.userDecryptEuint(FhevmType.euint64, encLosses, deployment.address, caller);
    const winCount = await fhevm.userDecryptEuint(FhevmType.euint32, encWins, deployment.address, caller);
    const lossCount = await fhevm.userDecryptEuint(FhevmType.euint32, encLossCount, deployment.address, caller);

    console.log(`Total gains:  ${gains}`);
    console.log(`Total losses: ${losses}`);
    console.log(`Win / Loss count: ${winCount} / ${lossCount}`);
  });
