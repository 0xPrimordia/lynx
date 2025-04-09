import { expect } from "chai";
import { ethers } from "hardhat";

describe("IndexVault", function () {
  let vault: any;
  const PLACEHOLDER_ADDRESS = "0x0000000000000000000000000000000000000000";

  beforeEach(async function () {
    const IndexVault = await ethers.getContractFactory("IndexVault");
    vault = await IndexVault.deploy(PLACEHOLDER_ADDRESS);
    await vault.deployed();
  });

  it("Should deploy with the correct initial state", async function () {
    expect(await vault.getController()).to.equal(PLACEHOLDER_ADDRESS);
  });

  it("Should allow updating the controller", async function () {
    const newController = "0x0000000000000000000000000000000000000001";
    await vault.updateController(newController);
    expect(await vault.getController()).to.equal(newController);
  });
}); 