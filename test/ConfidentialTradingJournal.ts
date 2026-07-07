import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { ConfidentialTradingJournal, ConfidentialTradingJournal__factory } from "../types";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import { FhevmType } from "@fhevm/hardhat-plugin";

// fhevm.userDecryptEuint() runs the mock relayer's decrypt check off-chain — an
// unauthorized request rejects with a plain JS Error, not an EVM revert, so
// hardhat-chai-matchers' `.reverted` can't assert on it. `.rejected` (from
// chai-as-promised) asserts the promise rejects, regardless of reason shape.
chai.use(chaiAsPromised);

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner; // the trader
  bob: HardhatEthersSigner; // a verifier (e.g. an investor) alice grants access to
  carol: HardhatEthersSigner; // an outsider who should see nothing
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("ConfidentialTradingJournal")) as ConfidentialTradingJournal__factory;
  const journal = (await factory.deploy()) as ConfidentialTradingJournal;
  const journalAddress = await journal.getAddress();
  return { journal, journalAddress };
}

async function submitTrade(
  journal: ConfidentialTradingJournal,
  journalAddress: string,
  trader: HardhatEthersSigner,
  pnlMagnitude: number,
  isWin: boolean,
) {
  const input = fhevm.createEncryptedInput(journalAddress, trader.address);
  input.add64(pnlMagnitude);
  input.addBool(isWin);
  const encrypted = await input.encrypt();

  const tx = await journal
    .connect(trader)
    .submitTrade(encrypted.handles[0], encrypted.handles[1], encrypted.inputProof);
  await tx.wait();
}

describe("ConfidentialTradingJournal", function () {
  let signers: Signers;
  let journal: ConfidentialTradingJournal;
  let journalAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2], carol: ethSigners[3] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }
    ({ journal, journalAddress } = await deployFixture());
  });

  it("starts with zero trades for a fresh trader", async function () {
    expect(await journal.getTradeCount(signers.alice.address)).to.eq(0);
  });

  it("logs a trade and lets the trader decrypt its own aggregates", async function () {
    // Alice logs 3 trades: +100 (win), -40 (loss), +25 (win)
    await submitTrade(journal, journalAddress, signers.alice, 100, true);
    await submitTrade(journal, journalAddress, signers.alice, 40, false);
    await submitTrade(journal, journalAddress, signers.alice, 25, true);

    expect(await journal.getTradeCount(signers.alice.address)).to.eq(3);

    const [encGains, encLosses, encWins, encLosses32] = await journal.getAggregates(signers.alice.address);

    const gains = await fhevm.userDecryptEuint(FhevmType.euint64, encGains, journalAddress, signers.alice);
    const losses = await fhevm.userDecryptEuint(FhevmType.euint64, encLosses, journalAddress, signers.alice);
    const winCount = await fhevm.userDecryptEuint(FhevmType.euint32, encWins, journalAddress, signers.alice);
    const lossCount = await fhevm.userDecryptEuint(FhevmType.euint32, encLosses32, journalAddress, signers.alice);

    expect(gains).to.eq(125); // 100 + 25
    expect(losses).to.eq(40);
    expect(winCount).to.eq(2);
    expect(lossCount).to.eq(1);
  });

  it("blocks an unauthorized address from decrypting aggregates", async function () {
    await submitTrade(journal, journalAddress, signers.alice, 100, true);

    const [encGains] = await journal.getAggregates(signers.alice.address);

    // Carol was never granted access — her user-decrypt attempt must fail.
    await expect(
      fhevm.userDecryptEuint(FhevmType.euint64, encGains, journalAddress, signers.carol),
    ).to.be.rejected;
  });

  it("lets a trader grant a verifier access to aggregates only", async function () {
    await submitTrade(journal, journalAddress, signers.alice, 100, true);
    await submitTrade(journal, journalAddress, signers.alice, 30, false);

    await (await journal.connect(signers.alice).grantVerifierAccess(signers.bob.address)).wait();

    const [encGains, encLosses] = await journal.getAggregates(signers.alice.address);

    // Bob (the verifier) can now decrypt the aggregate...
    const gains = await fhevm.userDecryptEuint(FhevmType.euint64, encGains, journalAddress, signers.bob);
    const losses = await fhevm.userDecryptEuint(FhevmType.euint64, encLosses, journalAddress, signers.bob);
    expect(gains).to.eq(100);
    expect(losses).to.eq(30);

    // ...but NOT the individual trade record, since access was never granted for it.
    const [encTradePnl] = await journal.getTrade(signers.alice.address, 0);
    await expect(
      fhevm.userDecryptEuint(FhevmType.euint64, encTradePnl, journalAddress, signers.bob),
    ).to.be.rejected;
  });
});
