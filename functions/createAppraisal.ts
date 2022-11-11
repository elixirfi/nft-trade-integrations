import { PublicKey, SYSVAR_CLOCK_PUBKEY, SystemProgram, Transaction } from "@solana/web3.js";
import { AnchorState, BRIDGESPLIT_API, May } from "../utils";
import { Vault } from "../program";

export async function createAppraisal(
    anchorState: AnchorState<Vault>,
    poolMint: PublicKey,
    externalAccount: PublicKey,
    nftMint: PublicKey,
    poolAccount: PublicKey,
    appraisalAccount: PublicKey,
    send: boolean
): Promise<May<Transaction>> {
    try {
        await anchorState.program.account.appraisal.fetch(appraisalAccount);
    } catch (error) {
        const appraiserQuery = await fetch(BRIDGESPLIT_API + "appraiser/ix", {
            method: "POST",
            body: JSON.stringify({
                appraiser: "3RDTwtVmMcH9zvzqj8mZi9GH8apqWpRZyXB9DWL7QqrP",
                initializer: anchorState.wallet?.publicKey.toString(),
                index_mint: poolMint.toString(),
                index: poolAccount.toString(),
                external_account: externalAccount.toString(),
                asset_mint: nftMint.toString(),
                appraisal: appraisalAccount.toString(),
                system: SystemProgram.programId.toString(),
                clock: SYSVAR_CLOCK_PUBKEY.toString()
            })
        })
            .then(async (response) => {
                // Need to format this response and add this ixn to the txn
                return await response.text();
            })
            .catch((err) => {
                // eslint-disable-next-line no-console
                console.log("Error creating an appraisal", err);
                return null;
            });

        if (appraiserQuery && appraiserQuery !== "false") {
            let recoveredTransaction: Transaction | undefined = Transaction.from(Buffer.from(appraiserQuery, "base64"));
            if (send) {
                recoveredTransaction = await anchorState.wallet?.signTransaction(recoveredTransaction);

                recoveredTransaction &&
                    (await anchorState.provider.connection.sendRawTransaction(
                        recoveredTransaction.serialize({ verifySignatures: false, requireAllSignatures: false })
                    ));
            } else {
                return recoveredTransaction;
            }
        }
    }
    return;
}
