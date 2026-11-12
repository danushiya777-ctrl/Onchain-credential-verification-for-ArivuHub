import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Network:  ${network.name}`);
  console.log(`Deployer: ${deployer.address} (will be admin)`);

  const registry = await ethers.deployContract("CredentialRegistry");
  await registry.waitForDeployment();
  const address = await registry.getAddress();

  console.log(`CredentialRegistry deployed to: ${address}`);
  const tx = registry.deploymentTransaction();
  if (tx) console.log(`Deployment tx: ${tx.hash}`);
  if (network.name === "sepolia") {
    console.log(`Etherscan: https://sepolia.etherscan.io/address/${address}`);
  }
  console.log("Next: put this address in frontend/src/config.ts and README.md");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

