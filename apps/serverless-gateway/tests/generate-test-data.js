/**
 * generate-test-data.js — Generates real PRE cryptographic material
 * for Gateway integration tests.
 *
 * Outputs JSON with all fields needed by the test script.
 */

async function main() {
    const { CryptoService } = await import('@locket/crypto-engine');
    const cs = new CryptoService();

    // Step 1: Generate keypairs
    const alice = cs.generateUserKeys();  // Data owner
    const bob = cs.generateUserKeys();    // Provider / recipient

    // Step 2: Encrypt data
    const payload = await cs.encryptLocalData(
        { flow: 'heavy', date: '2026-02-25', mood: 'calm' },
        alice.publicKeyB64
    );

    // Step 3: Generate consent kFrag
    const consent = cs.generateConsentKFrag(
        alice.secretKeyB64,
        bob.publicKeyB64
    );

    // Output all test material as JSON
    const testData = {
        alice: {
            secretKeyB64: alice.secretKeyB64,
            publicKeyB64: alice.publicKeyB64
        },
        bob: {
            secretKeyB64: bob.secretKeyB64,
            publicKeyB64: bob.publicKeyB64
        },
        ciphertextB64: payload.ciphertextB64,
        capsuleB64: payload.capsuleB64,
        anchorHash: payload.anchorHash,
        kfragB64: consent.kfragB64,
        verifyingKeyB64: consent.verifyingKeyB64
    };

    console.log(JSON.stringify(testData));
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
