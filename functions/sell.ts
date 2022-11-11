import { BN, utils } from "@project-serum/anchor";
import { getATAAddressSync } from "@saberhq/token-utils";
import {
    Keypair,
    PublicKey,
    SYSVAR_CLOCK_PUBKEY,
    Transaction,
    TransactionInstruction,
    TransactionMessage,
    VersionedTransaction
} from "@solana/web3.js";

import {
    MPL_TOKEN_METADATA_ID,
    PROGRAM_IDS,
    TREASURY,
    composeProgram,
    getExtraComputeTxn,
    getLookupTable,
    getProgramsLookupTable
} from "..";
import { NftMetadata, getAssetName, getMetadataKey } from "../../common";
import { TransactionsAndSteps, createFailResult } from "../../util";
import { FEE_PID } from "../fee";
import { createAppraisal } from "../indexes";
import { AnchorState } from "../types";

export const elixirSell = async (
    anchorState: AnchorState,
    nftMint: PublicKey,
    poolMint: PublicKey,
    metadata: NftMetadata,
    lookupTableAddresses: Array<PublicKey>,
    lookupTable: PublicKey,
    doSwap: boolean,
    minSolReceived?: number
): Promise<TransactionsAndSteps> => {
    if (!anchorState.wallet) return createFailResult("No connected wallet");

    const nonceAccount = Keypair.generate();
    const nonce = nonceAccount.publicKey;

    const [fnftMint] = await PublicKey.findProgramAddress([nonce.toBytes()], anchorState.program.programId);

    const [poolAccount] = await PublicKey.findProgramAddress(
        [Buffer.from(utils.bytes.utf8.encode("fractions")), poolMint.toBytes()],
        anchorState.program.programId
    );

    const [vaultAccount] = await PublicKey.findProgramAddress(
        [Buffer.from(utils.bytes.utf8.encode("vault")), fnftMint.toBytes()],
        anchorState.program.programId
    );

    const [externalAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from(utils.bytes.utf8.encode("fractions-seed")), poolMint.toBytes()],
        PROGRAM_IDS.vault
    );

    const [appraisalAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from(utils.bytes.utf8.encode("appraisal")), poolMint.toBytes(), nftMint.toBytes()],
        anchorState.program.programId
    );

    const [nftMetadata] = PublicKey.findProgramAddressSync(
        [Buffer.from(utils.bytes.utf8.encode("metadata")), MPL_TOKEN_METADATA_ID.toBytes(), nftMint.toBytes()],
        MPL_TOKEN_METADATA_ID
    );

    const [feeAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from(utils.bytes.utf8.encode("fee")), poolMint.toBytes(), lookupTableAddresses[2].toBytes()],
        FEE_PID
    );

    const metadataAccount = await getMetadataKey(fnftMint);

    const initializerSolTa = getATAAddressSync({
        mint: new PublicKey(PROGRAM_IDS.wrapped_sol),
        owner: anchorState.wallet.publicKey
    });

    const initializerNftTa = getATAAddressSync({
        mint: nftMint,
        owner: anchorState.wallet.publicKey
    });

    const initializerFractionsTa = getATAAddressSync({
        mint: fnftMint,
        owner: anchorState.wallet.publicKey
    });

    const initializerPoolTa = getATAAddressSync({
        mint: poolMint,
        owner: anchorState.wallet.publicKey
    });

    const vaultProgramNftTa = getATAAddressSync({
        mint: nftMint,
        owner: vaultAccount
    });

    const vaultProgramFractionsTa = getATAAddressSync({
        mint: fnftMint,
        owner: poolAccount
    });

    const composeFeeSolTa = getATAAddressSync({
        mint: new PublicKey(PROGRAM_IDS.wrapped_sol),
        owner: feeAccount
    });

    const treasurySolFeeTa = getATAAddressSync({
        mint: new PublicKey(PROGRAM_IDS.wrapped_sol),
        owner: TREASURY
    });

    const treasuryPoolFeeTa = getATAAddressSync({
        mint: poolMint,
        owner: TREASURY
    });

    const instructions: TransactionInstruction[] = [];

    const transactions: Transaction[] = [];

    const appraisalTxn = await createAppraisal(
        anchorState,
        poolMint,
        externalAccount,
        nftMint,
        poolAccount,
        appraisalAccount,
        false
    );

    appraisalTxn && transactions.push(appraisalTxn);

    const compose = composeProgram(anchorState);

    const sellIx = await compose.methods
        .sell(nonce, new BN(minSolReceived || 0), doSwap)
        .accounts({
            initializer: anchorState.wallet.publicKey,
            nftMint,
            fractionsMint: fnftMint,
            poolMint,
            vaultAccount,
            poolAccount,
            initializerSolTa,
            initializerNftTa,
            initializerFractionsTa,
            initializerPoolTa,
            vaultProgramNftTa,
            vaultProgramFractionsTa,
            composeFeeMint: PROGRAM_IDS.wrapped_sol,
            treasury: TREASURY,
            composeFeeAccount: feeAccount,
            composeFeeSolTa,
            treasurySolFeeTa,
            treasuryPoolFeeTa,
            feeProgram: FEE_PID,
            vaultProgram: PROGRAM_IDS.vault,
            ammProgram: PROGRAM_IDS.amm,
            mplTokenMetadata: MPL_TOKEN_METADATA_ID,
            associatedTokenProgram: PROGRAM_IDS.associatedToken,
            tokenProgram: PROGRAM_IDS.token,
            systemProgram: PROGRAM_IDS.system,
            rent: PROGRAM_IDS.rent,
            clock: SYSVAR_CLOCK_PUBKEY
        })
        .remainingAccounts([
            {
                pubkey: metadataAccount,
                isSigner: false,
                isWritable: true
            },
            {
                pubkey: appraisalAccount,
                isSigner: false,
                isWritable: true
            },
            {
                pubkey: lookupTableAddresses[2],
                isSigner: false,
                isWritable: true
            },
            {
                pubkey: lookupTableAddresses[3],
                isSigner: false,
                isWritable: true
            },
            {
                pubkey: lookupTableAddresses[4],
                isSigner: false,
                isWritable: true
            },
            {
                pubkey: lookupTableAddresses[5],
                isSigner: false,
                isWritable: true
            },
            {
                pubkey: lookupTableAddresses[6],
                isSigner: false,
                isWritable: true
            },
            {
                pubkey: lookupTableAddresses[7],
                isSigner: false,
                isWritable: true
            },
            {
                pubkey: lookupTableAddresses[8],
                isSigner: false,
                isWritable: false
            },
            {
                pubkey: lookupTableAddresses[9],
                isSigner: false,
                isWritable: true
            },
            {
                pubkey: lookupTableAddresses[10],
                isSigner: false,
                isWritable: true
            },
            {
                pubkey: lookupTableAddresses[11],
                isSigner: false,
                isWritable: true
            },
            {
                pubkey: lookupTableAddresses[12],
                isSigner: false,
                isWritable: true
            },
            {
                pubkey: lookupTableAddresses[13],
                isSigner: false,
                isWritable: true
            },
            {
                pubkey: lookupTableAddresses[14],
                isSigner: false,
                isWritable: true
            },
            {
                pubkey: lookupTableAddresses[15],
                isSigner: false,
                isWritable: true
            },
            {
                pubkey: nftMetadata,
                isSigner: false,
                isWritable: false
            }
        ])
        .instruction();

    instructions.push(...getExtraComputeTxn(800_000));
    instructions.push(sellIx);

    const blockhash = (await anchorState.provider.connection.getLatestBlockhash()).blockhash;

    const messageV0 = new TransactionMessage({
        payerKey: anchorState.wallet.publicKey,
        recentBlockhash: blockhash,
        instructions // note this is an array of instructions
    }).compileToV0Message([getProgramsLookupTable(), getLookupTable(lookupTableAddresses, lookupTable)]);

    // create a v0 transaction from the v0 message
    const transactionV0 = new VersionedTransaction(messageV0);
    transactions.push(transactionV0 as unknown as any);

    return {
        transactions,
        steps: [`Appraising ${getAssetName(metadata)}`, `Selling ${getAssetName(metadata)}`]
    };
};
