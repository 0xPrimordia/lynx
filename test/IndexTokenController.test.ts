import { expect } from "chai";
import { ethers } from "hardhat";
import { IndexTokenController, IndexVault, MockHederaTokenService } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ContractTransactionReceipt, EventLog } from "ethers";

describe("IndexTokenController", function () {
    let controller: IndexTokenController;
    let vault: IndexVault;
    let mockHts: MockHederaTokenService;
    let admin: SignerWithAddress;
    let user: SignerWithAddress;

    beforeEach(async function () {
        [admin, user] = await ethers.getSigners();

        // Deploy mock HTS
        const MockHTS = await ethers.getContractFactory("MockHederaTokenService");
        mockHts = await MockHTS.deploy();
        await mockHts.waitForDeployment();

        // Deploy IndexVault
        const IndexVault = await ethers.getContractFactory("IndexVault");
        vault = await IndexVault.deploy(admin.address);
        await vault.waitForDeployment();

        // Deploy IndexTokenController
        const IndexTokenController = await ethers.getContractFactory("IndexTokenController");
        controller = await IndexTokenController.deploy(
            await vault.getAddress(),
            await mockHts.getAddress()
        );
        await controller.waitForDeployment();

        // Update controller in vault
        await vault.updateController(await controller.getAddress());
    });

    describe("createIndexToken", function () {
        it("should create token successfully with correct parameters", async function () {
            const name = "Test Token";
            const symbol = "TEST";
            const memo = "Test token for testing";

            // Create token
            const tx = await controller.createIndexToken(name, symbol, memo, {
                value: ethers.parseEther("1.0") // Send 1 HBAR for fees
            });

            const receipt = await tx.wait() as ContractTransactionReceipt;

            // Check events
            const creationAttempt = receipt.logs.find(
                (log) => log instanceof EventLog && log.eventName === "TokenCreationAttempt"
            ) as EventLog;

            expect(creationAttempt).to.not.be.undefined;
            expect(creationAttempt.args.name).to.equal(name);
            expect(creationAttempt.args.symbol).to.equal(symbol);
            expect(creationAttempt.args.treasury).to.equal(await vault.getAddress());

            const creationResponse = receipt.logs.find(
                (log) => log instanceof EventLog && log.eventName === "TokenCreationResponse"
            ) as EventLog;

            expect(creationResponse).to.not.be.undefined;
            expect(creationResponse.args.responseCode).to.equal(0n);
            expect(creationResponse.args.errorMessage).to.equal("Success");

            // Verify token address is set
            const tokenAddress = await controller.getTokenAddress();
            expect(tokenAddress).to.not.equal(ethers.ZeroAddress);

            // Verify supply key
            const hasSupplyKey = await controller.hasSupplyKey();
            expect(hasSupplyKey).to.be.true;
        });

        it("should fail if token already exists", async function () {
            const name = "Test Token";
            const symbol = "TEST";
            const memo = "Test token for testing";

            // Create token first time
            await controller.createIndexToken(name, symbol, memo, {
                value: ethers.parseEther("1.0")
            });

            // Try to create again
            await expect(
                controller.createIndexToken(name, symbol, memo, {
                    value: ethers.parseEther("1.0")
                })
            ).to.be.revertedWith("Index token already exists");
        });

        it("should fail if HTS returns error", async function () {
            const name = "Test Token";
            const symbol = "TEST";
            const memo = "Test token for testing";

            // Make HTS return error
            await mockHts.setMockedCreateTokenResponse(-1, ethers.ZeroAddress);

            await expect(
                controller.createIndexToken(name, symbol, memo, {
                    value: ethers.parseEther("1.0")
                })
            ).to.be.revertedWithCustomError(controller, "TokenCreationFailed");
        });
    });
}); 