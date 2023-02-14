import { PROGRAM_ADDRESS as MPL_AUTH } from "@metaplex-foundation/mpl-token-auth-rules";
import { BN, utils } from "@project-serum/anchor";
import { getATAAddressSync } from "@saberhq/token-utils";
import {
    Keypair,
    LAMPORTS_PER_SOL,
    PublicKey,
    SYSVAR_CLOCK_PUBKEY,
    SYSVAR_INSTRUCTIONS_PUBKEY,
    Transaction,
    TransactionInstruction,
    TransactionMessage,
    VersionedTransaction
} from "@solana/web3.js";
import { Vault } from "../../program";
import { AnchorState, composeProgram, FEE_PID, getExtraComputeTxn, getLookupTable, getMetadataKey, getProgramsLookupTable, NftMetadata, PriorityFee, PROGRAM_IDS, SELL_TXN_FEES, TokenStandard, TOTAL_RAYDIUM_FEE, TransactionResult, TREASURY, V0_COMPUTE_INCREASE, V0_PRIORITY_FEE } from "../../utils";
import { createAppraisal } from "../utils/createAppraisal";

// anchorState -- See type
// nftMint -- Mint of the NFT you're buying
// poolMint -- Mint of the pool you're selling into
// lookupTable -- The pool specific lookup table address
// lookupTableAddresses -- The contents of the lookup table
// numFractions -- The number of fractions of the underlying fnftMint you need to buy
// doSwap -- If you want to include a swap txn at the begining or just use existing funds
// minSolReceived -- The minimum SOL you're willing to receive selling the NFT
export const raydiumSell = async (
    anchorState: AnchorState<Vault>,
    nftMint: PublicKey,
    poolMint: PublicKey,
    metadata: NftMetadata,
    lookupTableAddresses: Array<PublicKey>,
    lookupTable: PublicKey,
    doSwap: boolean,
    minSolReceived?: number,
    priorityFee?: PriorityFee
): Promise<TransactionResult> => {
    if (!anchorState.wallet) return { transactions: [], status: false };

    const nonceAccount = Keypair.generate();
    const nonce = nonceAccount.publicKey;

    const prioFee = priorityFee ?? V0_PRIORITY_FEE;
    const metadata_pid = PROGRAM_IDS.metadata;

    // passed into raydium. needs to be pre-fee amount so we add on fees
    const preFee = (minSolReceived || 0) + SELL_TXN_FEES;
    const postFee = preFee / (1 - TOTAL_RAYDIUM_FEE);
    const minOutAmount = postFee;

    const [fnftMint] = PublicKey.findProgramAddressSync([nonce.toBytes()], anchorState.program.programId);

    const [poolAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from(utils.bytes.utf8.encode("fractions")), poolMint.toBytes()],
        anchorState.program.programId
    );

    const [vaultAccount] = PublicKey.findProgramAddressSync(
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
        [Buffer.from(utils.bytes.utf8.encode("metadata")), metadata_pid.toBytes(), nftMint.toBytes()],
        metadata_pid
    );

    const [nftEdition] = PublicKey.findProgramAddressSync(
        [
            Buffer.from(utils.bytes.utf8.encode("metadata")),
            metadata_pid.toBytes(),
            nftMint.toBytes(),
            Buffer.from(utils.bytes.utf8.encode("edition"))
        ],
        metadata_pid
    );

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

    const treasurySolFeeTa = getATAAddressSync({
        mint: new PublicKey(PROGRAM_IDS.wrapped_sol),
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

    if (appraisalTxn) {
        transactions.push(appraisalTxn);
    }

    instructions.push(...getExtraComputeTxn(V0_COMPUTE_INCREASE, prioFee));
    const compose = composeProgram(anchorState.provider.connection);

    const [userTokenRecord] = PublicKey.findProgramAddressSync(
        [
            Buffer.from(utils.bytes.utf8.encode("metadata")),
            metadata_pid.toBytes(),
            nftMint.toBytes(),
            Buffer.from(utils.bytes.utf8.encode("token_record")),
            initializerNftTa.toBytes()
        ],
        metadata_pid
    );

    const [programTokenRecord] = PublicKey.findProgramAddressSync(
        [
            Buffer.from(utils.bytes.utf8.encode("metadata")),
            metadata_pid.toBytes(),
            nftMint.toBytes(),
            Buffer.from(utils.bytes.utf8.encode("token_record")),
            vaultProgramNftTa.toBytes()
        ],
        metadata_pid
    );

    const remainingAccounts = [
        {
            pubkey: nftMetadata,
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
            pubkey: SYSVAR_INSTRUCTIONS_PUBKEY,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: nftEdition,
            isSigner: false,
            isWritable: true
        }
    ];

    // only push when pnft
    if (metadata.token_standard === TokenStandard.ProgrammableNonFungible) {
        remainingAccounts.push(
            ...[
                {
                    pubkey: userTokenRecord,
                    isSigner: false,
                    isWritable: true
                },
                {
                    pubkey: programTokenRecord,
                    isSigner: false,
                    isWritable: true
                },
                {
                    pubkey: new PublicKey(metadata.programmable_config!),
                    isSigner: false,
                    isWritable: true
                },
                {
                    pubkey: new PublicKey(MPL_AUTH),
                    isSigner: false,
                    isWritable: false
                }
            ]
        );
    }

    const sellIx = await compose.methods
        .sell(nonce, new BN(minOutAmount * LAMPORTS_PER_SOL), doSwap)
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
            treasurySolFeeTa,
            vaultProgram: PROGRAM_IDS.vault,
            ammProgram: PROGRAM_IDS.amm,
            mplTokenMetadata: metadata_pid,
            associatedTokenProgram: PROGRAM_IDS.associatedToken,
            tokenProgram: PROGRAM_IDS.token,
            systemProgram: PROGRAM_IDS.system,
            rent: PROGRAM_IDS.rent
        })
        .remainingAccounts(remainingAccounts)
        .instruction();

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
        status: true
    };
};
