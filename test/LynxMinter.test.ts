import { ethers } from "hardhat";
import "@nomicfoundation/hardhat-chai-matchers";
import { Contract, EventLog } from "ethers";
import { parseEther } from "@ethersproject/units";
import { LynxMinter, MockHederaTokenService } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";

describe("LynxMinter", function () {
    let lynxMinter: LynxMinter;
    let mockHts: MockHederaTokenService;
    let user: SignerWithAddress;
    let tokenAddress: string;
    let sauceTokenAddress: string;
    let clxyTokenAddress: string;

    beforeEach(async function () {
        // Get signers
        [user] = await ethers.getSigners();

        // Deploy mock HTS
        const MockHTS = await ethers.getContractFactory("MockHederaTokenService");
        mockHts = (await MockHTS.deploy()) as unknown as MockHederaTokenService;
        await mockHts.waitForDeployment();

        // Set up token addresses
        tokenAddress = "0x0000000000000000000000000000000000000001";
        sauceTokenAddress = "0x0000000000000000000000000000000000000002";
        clxyTokenAddress = "0x0000000000000000000000000000000000000003";

        // Initialize tokens in mock HTS
        await mockHts.setupTokens(tokenAddress, sauceTokenAddress, clxyTokenAddress, user.address);

        // Clear any transfer results
        await mockHts.clearTransferResults();

        // Set initial balances and allowances
        const initialAmount = parseEther("10000").toString(); // Increase initial amount to ensure sufficient balance

        // Deploy LynxMinter with mock HTS address
        const LynxMinter = await ethers.getContractFactory("LynxMinter");
        lynxMinter = (await LynxMinter.deploy(
            tokenAddress,
            sauceTokenAddress,
            clxyTokenAddress,
            await mockHts.getAddress()
        )) as unknown as LynxMinter;
        await lynxMinter.waitForDeployment();

        // Set supply key holder for LynxMinter
        await mockHts.setSupplyKeyHolder(tokenAddress, await lynxMinter.getAddress());
        await mockHts.setSupplyKeyHolder(sauceTokenAddress, await lynxMinter.getAddress());
        await mockHts.setSupplyKeyHolder(clxyTokenAddress, await lynxMinter.getAddress());

        // Set token service to mock HTS
        await lynxMinter.setTokenService(await mockHts.getAddress());

        // Check supply key status
        await lynxMinter.checkSupplyKey();

        // Associate tokens with LynxMinter
        await mockHts.associateToken(await lynxMinter.getAddress(), tokenAddress);
        await mockHts.associateToken(await lynxMinter.getAddress(), sauceTokenAddress);
        await mockHts.associateToken(await lynxMinter.getAddress(), clxyTokenAddress);

        // Associate tokens with user
        await mockHts.associateToken(user.address, tokenAddress);
        await mockHts.associateToken(user.address, sauceTokenAddress);
        await mockHts.associateToken(user.address, clxyTokenAddress);

        // Set balances for the user
        await mockHts.setBalance(tokenAddress, user.address, initialAmount);
        await mockHts.setBalance(sauceTokenAddress, user.address, initialAmount);
        await mockHts.setBalance(clxyTokenAddress, user.address, initialAmount);

        // Set balances for the mock HTS contract
        await mockHts.setBalance(tokenAddress, await mockHts.getAddress(), initialAmount);
        await mockHts.setBalance(sauceTokenAddress, await mockHts.getAddress(), initialAmount);
        await mockHts.setBalance(clxyTokenAddress, await mockHts.getAddress(), initialAmount);

        // Set balances for the LynxMinter contract
        await mockHts.setBalance(tokenAddress, await lynxMinter.getAddress(), initialAmount);
        await mockHts.setBalance(sauceTokenAddress, await lynxMinter.getAddress(), initialAmount);
        await mockHts.setBalance(clxyTokenAddress, await lynxMinter.getAddress(), initialAmount);

        // Transfer tokens to user
        await mockHts.transferToken(
            tokenAddress,
            await mockHts.getAddress(),
            user.address,
            initialAmount
        );
        await mockHts.transferToken(
            sauceTokenAddress,
            await mockHts.getAddress(),
            user.address,
            initialAmount
        );
        await mockHts.transferToken(
            clxyTokenAddress,
            await mockHts.getAddress(),
            user.address,
            initialAmount
        );

        // Approve LynxMinter to spend tokens
        await mockHts.setAllowance(tokenAddress, user.address, await lynxMinter.getAddress(), initialAmount);
        await mockHts.setAllowance(sauceTokenAddress, user.address, await lynxMinter.getAddress(), initialAmount);
        await mockHts.setAllowance(clxyTokenAddress, user.address, await lynxMinter.getAddress(), initialAmount);

        // Verify supply key is set correctly
        const hasSupplyKey = await mockHts.isSupplyKey(tokenAddress, await lynxMinter.getAddress());
        expect(hasSupplyKey).to.be.true;
    });

    describe("mint", function () {
        it("should mint tokens successfully with correct ratios", async function () {
            const lynxAmount = parseEther("1").toString();
            const hbarRequired = await lynxMinter.calculateRequiredHBAR(lynxAmount);
            const sauceRequired = await lynxMinter.calculateRequiredSAUCE(lynxAmount);
            const clxyRequired = await lynxMinter.calculateRequiredCLXY(lynxAmount);

            // Verify correct ratios - 10 tinybar per LYNX (not 10 ETH)
            // In Solidity/EVM, 10 tinybar = 10 wei = BigInt(10)
            expect(hbarRequired).to.equal("10"); // 10 tinybar per LYNX (actual value from contract)
            expect(sauceRequired).to.equal(parseEther("100").toString()); // 100 SAUCE per LYNX
            expect(clxyRequired).to.equal(parseEther("50").toString()); // 50 CLXY per LYNX

            const tx = await lynxMinter.connect(user).mint(lynxAmount, {
                value: hbarRequired,
            });

            const receipt = await tx.wait();
            const event = receipt?.logs.find(
                (log) => log instanceof EventLog && log.eventName === "LynxMinted"
            ) as EventLog;

            expect(event).to.not.be.undefined;
            expect(event.args[0]).to.equal(user.address);
            expect(event.args[1]).to.equal(lynxAmount);
            expect(event.args[2]).to.equal(hbarRequired);
            expect(event.args[3]).to.equal(sauceRequired);
            expect(event.args[4]).to.equal(clxyRequired);

            const userBalance = await mockHts.balanceOf(tokenAddress, user.address);
            expect(userBalance).to.equal(parseEther("10001").toString());
        });

        it("should fail if tokens are not associated", async function () {
            const lynxAmount = parseEther("1").toString();
            const hbarRequired = await lynxMinter.calculateRequiredHBAR(lynxAmount);

            // Dissociate tokens
            await mockHts.disassociateToken(user.address, tokenAddress);
            await mockHts.disassociateToken(user.address, sauceTokenAddress);
            await mockHts.disassociateToken(user.address, clxyTokenAddress);

            await expect(lynxMinter.connect(user).mint(lynxAmount, {
                value: hbarRequired,
            })).to.be.revertedWithCustomError(lynxMinter, "TokenNotAssociated");
        });

        it("should fail if contract does not have supply key", async function () {
            const lynxAmount = parseEther("1").toString();
            const hbarRequired = await lynxMinter.calculateRequiredHBAR(lynxAmount);

            // Remove supply key
            await lynxMinter.setSupplyKeyStatus(false);

            await expect(lynxMinter.connect(user).mint(lynxAmount, {
                value: hbarRequired,
            })).to.be.revertedWithCustomError(lynxMinter, "NoSupplyKeyForToken");
        });

        it("should fail if SAUCE transfer fails", async function () {
            const lynxAmount = parseEther("1").toString();
            const hbarRequired = await lynxMinter.calculateRequiredHBAR(lynxAmount);

            // Make SAUCE transfer fail
            await mockHts.setTransferResult(sauceTokenAddress, -2); // Insufficient balance error

            await expect(lynxMinter.connect(user).mint(lynxAmount, {
                value: hbarRequired,
            })).to.be.revertedWithCustomError(lynxMinter, "HtsError")
              .withArgs(sauceTokenAddress, -2, "Insufficient balance");
        });

        it("should fail if CLXY transfer fails", async function () {
            const lynxAmount = parseEther("1").toString();
            const hbarRequired = await lynxMinter.calculateRequiredHBAR(lynxAmount);

            // Make CLXY transfer fail
            await mockHts.setTransferResult(clxyTokenAddress, -2); // Insufficient balance error

            await expect(lynxMinter.connect(user).mint(lynxAmount, {
                value: hbarRequired,
            })).to.be.revertedWithCustomError(lynxMinter, "HtsError")
              .withArgs(clxyTokenAddress, -2, "Insufficient balance");
        });

        it("should fail if HBAR amount is insufficient", async function () {
            const lynxAmount = parseEther("1").toString();
            const hbarRequired = await lynxMinter.calculateRequiredHBAR(lynxAmount);

            await expect(
                lynxMinter.connect(user).mint(lynxAmount, {
                    value: BigInt(hbarRequired) / 2n,
                })
            ).to.be.revertedWithCustomError(lynxMinter, "MustSendExactHBAR");
        });

        it("should fail if SAUCE allowance is insufficient", async function () {
            const lynxAmount = parseEther("1").toString();
            const hbarRequired = await lynxMinter.calculateRequiredHBAR(lynxAmount);

            // Revoke SAUCE allowance
            await mockHts.setAllowance(sauceTokenAddress, user.address, await lynxMinter.getAddress(), 0);

            await expect(
                lynxMinter.connect(user).mint(lynxAmount, {
                    value: hbarRequired,
                })
            ).to.be.revertedWithCustomError(lynxMinter, "InsufficientSauceAllowance");
        });

        it("should fail if CLXY allowance is insufficient", async function () {
            const lynxAmount = parseEther("1").toString();
            const hbarRequired = await lynxMinter.calculateRequiredHBAR(lynxAmount);

            // Revoke CLXY allowance
            await mockHts.setAllowance(clxyTokenAddress, user.address, await lynxMinter.getAddress(), 0);

            await expect(
                lynxMinter.connect(user).mint(lynxAmount, {
                    value: hbarRequired,
                })
            ).to.be.revertedWithCustomError(lynxMinter, "InsufficientClxyAllowance");
        });

        it("should fail if contract is not associated with LYNX token", async function () {
            // Revoke contract's token association
            await mockHts.revokeTokenAssociation(tokenAddress, await lynxMinter.getAddress());
            
            await expect(
                lynxMinter.connect(user).mint(parseEther("1").toString(), {
                    value: await lynxMinter.calculateRequiredHBAR(parseEther("1").toString()),
                })
            ).to.be.revertedWithCustomError(lynxMinter, "TokenNotAssociated");
        });

        it("should fail if user is not associated with LYNX token", async function () {
            // Revoke user's token association
            await mockHts.revokeTokenAssociation(tokenAddress, user.address);
            
            await expect(
                lynxMinter.connect(user).mint(parseEther("1").toString(), {
                    value: await lynxMinter.calculateRequiredHBAR(parseEther("1").toString()),
                })
            ).to.be.revertedWithCustomError(lynxMinter, "TokenNotAssociated");
        });

        it("should transfer tokens in correct sequence", async function () {
            const lynxAmount = parseEther("1").toString();
            const hbarRequired = await lynxMinter.calculateRequiredHBAR(lynxAmount);
            const sauceRequired = await lynxMinter.calculateRequiredSAUCE(lynxAmount);
            const clxyRequired = await lynxMinter.calculateRequiredCLXY(lynxAmount);
            
            // Get initial balances
            const initialSauceBalance = await mockHts.balanceOf(sauceTokenAddress, user.address);
            const initialClxyBalance = await mockHts.balanceOf(clxyTokenAddress, user.address);
            
            await lynxMinter.connect(user).mint(lynxAmount, {
                value: hbarRequired,
            });
            
            // Verify token transfers
            const finalSauceBalance = await mockHts.balanceOf(sauceTokenAddress, user.address);
            const finalClxyBalance = await mockHts.balanceOf(clxyTokenAddress, user.address);
            
            expect(finalSauceBalance).to.equal(initialSauceBalance - sauceRequired);
            expect(finalClxyBalance).to.equal(initialClxyBalance - clxyRequired);
        });

        it("should handle token transfer failures", async function () {
            const lynxAmount = parseEther("1").toString();
            const hbarRequired = await lynxMinter.calculateRequiredHBAR(lynxAmount);
            
            // Set SAUCE transfer to succeed
            await mockHts.setTransferResult(sauceTokenAddress, 0);
            
            // Set CLXY transfer to fail with insufficient balance
            await mockHts.setTransferResult(clxyTokenAddress, -2);
            
            await expect(
                lynxMinter.connect(user).mint(lynxAmount, {
                    value: hbarRequired,
                })
            ).to.be.revertedWithCustomError(lynxMinter, "HtsError")
              .withArgs(clxyTokenAddress, -2, "Insufficient balance");
        });

        it("should fail if user has insufficient token balance", async function () {
            // Set user balance to 0
            await mockHts.setBalance(sauceTokenAddress, user.address, 0);
            
            await expect(
                lynxMinter.connect(user).mint(parseEther("1").toString(), {
                    value: await lynxMinter.calculateRequiredHBAR(parseEther("1").toString()),
                })
            ).to.be.revertedWithCustomError(lynxMinter, "HtsError");
        });

        it("should fail if minting fails", async function () {
            // Simulate mint failure
            await mockHts.setMintFailure(tokenAddress, true);
            
            await expect(
                lynxMinter.connect(user).mint(parseEther("1").toString(), {
                    value: await lynxMinter.calculateRequiredHBAR(parseEther("1").toString()),
                })
            ).to.be.revertedWithCustomError(lynxMinter, "HtsError");
        });
    });
});