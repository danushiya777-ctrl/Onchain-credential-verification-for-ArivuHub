import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("CredentialRegistry", function () {
  const HASH = ethers.sha256(ethers.toUtf8Bytes("certificate-of-alice.pdf"));
  const OTHER_HASH = ethers.sha256(ethers.toUtf8Bytes("some-other-file.pdf"));

  async function deployFixture() {
    const [admin, issuer, outsider, verifier] = await ethers.getSigners();
    const registry = await ethers.deployContract("CredentialRegistry");
    await registry.waitForDeployment();
    return { registry, admin, issuer, outsider, verifier };
  }

  async function withIssuerFixture() {
    const ctx = await deployFixture();
    await ctx.registry.addIssuer(ctx.issuer.address);
    return ctx;
  }

  async function withCredentialFixture() {
    const ctx = await withIssuerFixture();
    await ctx.registry.connect(ctx.issuer).issueCredential(HASH);
    return ctx;
  }

  describe("Deployment", function () {
    it("sets the deployer as admin", async function () {
      const { registry, admin } = await loadFixture(deployFixture);
      expect(await registry.admin()).to.equal(admin.address);
    });

    it("starts with no issuers", async function () {
      const { registry, issuer } = await loadFixture(deployFixture);
      expect(await registry.isIssuer(issuer.address)).to.equal(false);
    });
  });

  describe("Issuer management", function () {
    it("admin can add an issuer and emits IssuerAdded", async function () {
      const { registry, issuer } = await loadFixture(deployFixture);
      await expect(registry.addIssuer(issuer.address))
        .to.emit(registry, "IssuerAdded")
        .withArgs(issuer.address);
      expect(await registry.isIssuer(issuer.address)).to.equal(true);
    });

    it("admin can remove an issuer and emits IssuerRemoved", async function () {
      const { registry, issuer } = await loadFixture(withIssuerFixture);
      await expect(registry.removeIssuer(issuer.address))
        .to.emit(registry, "IssuerRemoved")
        .withArgs(issuer.address);
      expect(await registry.isIssuer(issuer.address)).to.equal(false);
    });

    it("non-admin cannot add an issuer", async function () {
      const { registry, issuer, outsider } = await loadFixture(withIssuerFixture);
      await expect(
        registry.connect(issuer).addIssuer(outsider.address)
      ).to.be.revertedWith("Not admin");
    });

    it("non-admin cannot remove an issuer", async function () {
      const { registry, issuer, outsider } = await loadFixture(withIssuerFixture);
      await expect(
        registry.connect(outsider).removeIssuer(issuer.address)
      ).to.be.revertedWith("Not admin");
    });

    it("rejects the zero address and duplicate issuers", async function () {
      const { registry, issuer } = await loadFixture(withIssuerFixture);
      await expect(registry.addIssuer(ethers.ZeroAddress)).to.be.revertedWith("Zero address");
      await expect(registry.addIssuer(issuer.address)).to.be.revertedWith("Already an issuer");
    });

    it("cannot remove an address that is not an issuer", async function () {
      const { registry, outsider } = await loadFixture(deployFixture);
      await expect(registry.removeIssuer(outsider.address)).to.be.revertedWith("Not an issuer");
    });
  });

  describe("Issuing", function () {
    it("approved issuer can issue and emits CredentialIssued", async function () {
      const { registry, issuer } = await loadFixture(withIssuerFixture);
      await expect(registry.connect(issuer).issueCredential(HASH))
        .to.emit(registry, "CredentialIssued")
        .withArgs(HASH, issuer.address);
    });

    it("duplicate issue reverts", async function () {
      const { registry, issuer } = await loadFixture(withCredentialFixture);
      await expect(
        registry.connect(issuer).issueCredential(HASH)
      ).to.be.revertedWith("Already issued");
    });

    it("non-issuer cannot issue", async function () {
      const { registry, outsider } = await loadFixture(withIssuerFixture);
      await expect(
        registry.connect(outsider).issueCredential(OTHER_HASH)
      ).to.be.revertedWith("Not an approved issuer");
    });

    it("rejects an empty hash", async function () {
      const { registry, issuer } = await loadFixture(withIssuerFixture);
      await expect(
        registry.connect(issuer).issueCredential(ethers.ZeroHash)
      ).to.be.revertedWith("Empty hash");
    });

    it("removed issuer can no longer issue", async function () {
      const { registry, issuer } = await loadFixture(withIssuerFixture);
      await registry.removeIssuer(issuer.address);
      await expect(
        registry.connect(issuer).issueCredential(OTHER_HASH)
      ).to.be.revertedWith("Not an approved issuer");
    });

    it("credentials issued before removal stay valid", async function () {
      const { registry, issuer } = await loadFixture(withCredentialFixture);
      await registry.removeIssuer(issuer.address);
      const [valid] = await registry.verifyCredential(HASH);
      expect(valid).to.equal(true);
    });
  });

  describe("Verifying", function () {
    it("returns valid=true with issuer and timestamp for an issued hash", async function () {
      const { registry, issuer, verifier } = await loadFixture(withCredentialFixture);
      const [valid, who, issuedAt, revoked] = await registry
        .connect(verifier)
        .verifyCredential(HASH);
      expect(valid).to.equal(true);
      expect(who).to.equal(issuer.address);
      expect(issuedAt).to.equal(await time.latest());
      expect(revoked).to.equal(false);
    });

    it("returns valid=false and zero address for an unknown hash", async function () {
      const { registry } = await loadFixture(withCredentialFixture);
      const [valid, who, issuedAt, revoked] = await registry.verifyCredential(OTHER_HASH);
      expect(valid).to.equal(false);
      expect(who).to.equal(ethers.ZeroAddress);
      expect(issuedAt).to.equal(0n);
      expect(revoked).to.equal(false);
    });
  });

  describe("Revoking", function () {
    it("only the original issuer can revoke", async function () {
      const { registry, outsider } = await loadFixture(withCredentialFixture);
      await expect(
        registry.connect(outsider).revokeCredential(HASH)
      ).to.be.revertedWith("Only original issuer");
    });

    it("another approved issuer cannot revoke someone else's credential", async function () {
      const { registry, outsider } = await loadFixture(withCredentialFixture);
      await registry.addIssuer(outsider.address);
      await expect(
        registry.connect(outsider).revokeCredential(HASH)
      ).to.be.revertedWith("Only original issuer");
    });

    it("issuer revokes, event is emitted, and verify returns valid=false, revoked=true", async function () {
      const { registry, issuer } = await loadFixture(withCredentialFixture);
      await expect(registry.connect(issuer).revokeCredential(HASH))
        .to.emit(registry, "CredentialRevoked")
        .withArgs(HASH, issuer.address);
      const [valid, who, , revoked] = await registry.verifyCredential(HASH);
      expect(valid).to.equal(false);
      expect(who).to.equal(issuer.address);
      expect(revoked).to.equal(true);
    });

    it("cannot revoke twice", async function () {
      const { registry, issuer } = await loadFixture(withCredentialFixture);
      await registry.connect(issuer).revokeCredential(HASH);
      await expect(
        registry.connect(issuer).revokeCredential(HASH)
      ).to.be.revertedWith("Already revoked");
    });

    it("cannot revoke an unknown hash", async function () {
      const { registry, issuer } = await loadFixture(withIssuerFixture);
      await expect(
        registry.connect(issuer).revokeCredential(OTHER_HASH)
      ).to.be.revertedWith("Not found");
    });

    it("a revoked hash cannot be re-issued", async function () {
      const { registry, issuer } = await loadFixture(withCredentialFixture);
      await registry.connect(issuer).revokeCredential(HASH);
      await expect(
        registry.connect(issuer).issueCredential(HASH)
      ).to.be.revertedWith("Already issued");
    });
  });
});

