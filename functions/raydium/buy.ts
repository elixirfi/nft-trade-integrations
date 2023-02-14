import { PROGRAM_ADDRESS as MPL_AUTH } from "@metaplex-foundation/mpl-token-auth-rules";
import { BN, utils } from "@project-serum/anchor";
import { getATAAddressSync } from "@saberhq/token-utils";
import {
    LAMPORTS_PER_SOL,
    PublicKey,
    SYSVAR_CLOCK_PUBKEY,
    SYSVAR_INSTRUCTIONS_PUBKEY,
    Transaction,
    TransactionInstruction,
    TransactionMessage,
    VersionedTransaction
} from "@solana/web3.js";
import { Compose, Vault } from "../../program";

import {
    PROGRAM_IDS,
    composeProgram,
    getExtraComputeTxn,
    getLookupTable,
    getProgramsLookupTable,
    AnchorState,
    NftMetadata,
    TransactionResult,
    PriorityFee,
    V0_PRIORITY_FEE,
    BUY_TXN_FEES,
    TOTAL_RAYDIUM_FEE,
    V0_COMPUTE_INCREASE,
    TREASURY,
    TokenStandard
} from "../../utils";
import { createAppraisal } from "../utils/createAppraisal";

// anchorState -- See type
// fnftMint -- Mint of the fraction you're buying
// nftMint -- Mint of the NFT you're buying
// poolMint -- Mint of the pool you're buying from
// lookupTable -- The pool specific lookup table address
// lookupTableAddresses -- The contents of the lookup table
// numFractions -- The number of fractions of the underlying fnftMint you need to buy
// doSwap -- If you want to include a swap txn at the begining or just use existing funds
// maxSolToSpend -- The maximum SOL you're willing to spend to buy the NFT
/// NFT --> Whole/Normal NFT [Okay Bear #9622]
/// FNFT --> Fracitonalized Individual NFTs [Token Okay Bear #9622]
/// PNFT --> Pooled NFTs (Collection based) [Token Okay Bears Floor Index]
export const raydiumBuy = async (
    anchorState: AnchorState<Vault>,
    fnftMint: PublicKey,
    nftMint: PublicKey,
    poolMint: PublicKey,
    metadata: NftMetadata,
    lookupTableAddresses: Array<PublicKey>,
    lookupTable: PublicKey,
    numFractions: number,
    doSwap: boolean,
    maxSolToSpend?: number,
    priorityFee?: PriorityFee
): Promise<TransactionResult> => {
    if (!anchorState.wallet) return { transactions: [], status: false };
    const prioFee = priorityFee ?? V0_PRIORITY_FEE;
    // passed into raydium. needs to be pre-fee amount so we add on fees
    const preFee = (maxSolToSpend || 0) - BUY_TXN_FEES;
    const postFee = preFee * (1 + TOTAL_RAYDIUM_FEE);
    const maxBuy = postFee;
    const metadata_pid = PROGRAM_IDS.metadata;

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

    const instructions: TransactionInstruction[] = [];

    const compose = composeProgram(anchorState.provider.connection);

    const transactions: Transaction[] = [];
    const appraiseTxn = await createAppraisal(
        anchorState,
        poolMint,
        externalAccount,
        nftMint,
        poolAccount,
        appraisalAccount,
        false
    );
    if (appraiseTxn) {
        transactions.push(appraiseTxn);
    }
    instructions.push(...getExtraComputeTxn(V0_COMPUTE_INCREASE, prioFee));

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

    const remainingAccounts = [
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
            pubkey: PROGRAM_IDS.system,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: SYSVAR_INSTRUCTIONS_PUBKEY,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: PROGRAM_IDS.metadata,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: PROGRAM_IDS.associatedToken,
            isSigner: false,
            isWritable: false
        },
        {
            pubkey: nftEdition,
            isSigner: false,
            isWritable: true
        }
    ];

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

    if (metadata.token_standard === TokenStandard.ProgrammableNonFungible) {
        remainingAccounts.push(
            ...[
                {
                    pubkey: programTokenRecord,
                    isSigner: false,
                    isWritable: true
                },
                {
                    pubkey: userTokenRecord,
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
        const creators = metadata.data.creators
            ?.map((creator) => {
                return creator.share !== 0 ? creator : null;
            })
            .filter((creator) => creator !== null);

        if (creators) {
            remainingAccounts.push(
                ...creators.map((creator) => {
                    return {
                        pubkey: new PublicKey(creator!.address),
                        isSigner: false,
                        isWritable: true
                    };
                })
            );
        }
    }

    const buyIx = await compose.methods
        .buy(new BN(numFractions * 100), new BN(maxBuy * LAMPORTS_PER_SOL), doSwap)
        .accounts({
            initializer: anchorState.wallet.publicKey,
            nftMint,
            nftMetadata,
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
            treasury: TREASURY,
            composeFeeMint: PROGRAM_IDS.wrapped_sol,
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

    instructions.push(buyIx);

    const blockhash = (await anchorState.provider.connection.getLatestBlockhash()).blockhash;
    const messageV0 = new TransactionMessage({
        payerKey: anchorState.wallet.publicKey,
        recentBlockhash: blockhash,
        instructions // note this is an array of instructions
    }).compileToV0Message([getProgramsLookupTable(), getLookupTable(lookupTableAddresses, lookupTable)]);

    // create a v0 transaction from the v0 message
    const transactionV0 = new VersionedTransaction(messageV0);
    transactions.push(transactionV0 as unknown as any);

    return { transactions, status: true };
};
