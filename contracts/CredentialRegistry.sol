// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title CredentialRegistry
/// @notice Approved issuers register the hash of a certificate; anyone can verify it.
///         Only the hash is stored on-chain, so personal data stays private.
contract CredentialRegistry {
    /// @notice The account that deployed the contract and manages the issuer list.
    address public admin;

    /// @notice True if the address is an approved issuer.
    mapping(address => bool) public isIssuer;

    /// @dev What we record for each certificate hash.
    struct Credential {
        address issuer;   // who registered the hash
        uint256 issuedAt; // block timestamp; 0 means "never issued"
        bool revoked;     // set to true by the original issuer
    }

    /// @dev certificate hash => credential record
    mapping(bytes32 => Credential) private credentials;

    event IssuerAdded(address indexed issuer);
    event IssuerRemoved(address indexed issuer);
    event CredentialIssued(bytes32 indexed hash, address indexed issuer);
    event CredentialRevoked(bytes32 indexed hash, address indexed issuer);

    /// @dev Reverts unless the caller is the admin.
    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    /// @dev Reverts unless the caller is an approved issuer.
    modifier onlyIssuer() {
        require(isIssuer[msg.sender], "Not an approved issuer");
        _;
    }

    /// @notice Sets the deployer as admin.
    constructor() {
        admin = msg.sender;
    }

    /// @notice Approve an address as a trusted issuer.
    /// @param issuer The institution or educator address to approve.
    function addIssuer(address issuer) external onlyAdmin {
        require(issuer != address(0), "Zero address");
        require(!isIssuer[issuer], "Already an issuer");
        isIssuer[issuer] = true;
        emit IssuerAdded(issuer);
    }

    /// @notice Remove an address from the trusted issuer list.
    /// @dev Credentials already issued by this address stay on record.
    /// @param issuer The address to remove.
    function removeIssuer(address issuer) external onlyAdmin {
        require(isIssuer[issuer], "Not an issuer");
        isIssuer[issuer] = false;
        emit IssuerRemoved(issuer);
    }

    /// @notice Register the SHA-256 hash of a certificate.
    /// @param hash The 32-byte hash of the certificate file.
    function issueCredential(bytes32 hash) external onlyIssuer {
        require(hash != bytes32(0), "Empty hash");
        require(credentials[hash].issuedAt == 0, "Already issued");
        credentials[hash] = Credential(msg.sender, block.timestamp, false);
        emit CredentialIssued(hash, msg.sender);
    }

    /// @notice Revoke a credential. Only the issuer who registered it can do this.
    /// @dev Revocation is a flag, not a delete: blockchain history cannot be erased.
    /// @param hash The hash of the credential to revoke.
    function revokeCredential(bytes32 hash) external {
        Credential storage c = credentials[hash];
        require(c.issuedAt != 0, "Not found");
        require(c.issuer == msg.sender, "Only original issuer");
        require(!c.revoked, "Already revoked");
        c.revoked = true;
        emit CredentialRevoked(hash, msg.sender);
    }

    /// @notice Check a certificate hash against the registry. Free to call (view).
    /// @param hash The hash of the certificate file to check.
    /// @return valid True only if the hash was issued and is not revoked.
    /// @return issuer The issuer address (zero address if never issued).
    /// @return issuedAt The block timestamp of issuance (0 if never issued).
    /// @return revoked True if the issuer revoked it.
    function verifyCredential(bytes32 hash)
        external
        view
        returns (bool valid, address issuer, uint256 issuedAt, bool revoked)
    {
        Credential memory c = credentials[hash];
        valid = (c.issuedAt != 0 && !c.revoked);
        return (valid, c.issuer, c.issuedAt, c.revoked);
    }
}

