import { AnchorProvider, Idl, Program, Wallet } from "@project-serum/anchor";
import { AnchorState, NftMetadata } from "./types";
import { ASSOCIATED_PROGRAM_ID } from "@project-serum/anchor/dist/cjs/utils/token";
import {
    AddressLookupTableAccount,
    ComputeBudgetProgram,
    Connection,
    PublicKey,
    SYSVAR_CLOCK_PUBKEY,
    SYSVAR_RENT_PUBKEY
} from "@solana/web3.js";

import { BRIDGESPLIT_API, METADATA_PREFIX, PROGRAM_IDS } from "./constants";
import { Compose, Vault } from "../program";
import composeIdl from "../program/compose/compose.json";
import vaultIdl from "../program/vault/vault.json";
import axios from "axios";

export const COMPOSE_PID = new PublicKey("E1XRkj9fPF2NQUdoq41AHPqwMDHykYfn5PzBXAyDs7Be");
export const TREASURY = new PublicKey("6kLLewcYCvUK6xLQE1ep36ReamuTLFuTWwhCnbMCb3pd");
export const PROGRAMS_LOOKUP_TABLE = new PublicKey("4oA28x6ZA1sNPvXLWLG7aNcoPoNj4a6F3QYPyTS2HvYE");
export const FEE_PID = new PublicKey("fee6uQpfQYhfZUxiYLvpAjuCGNE7NTJrCoXV8tsqsn6");

export function getAssetName(metadata?: NftMetadata): string {
    let name = metadata?.data.name.replace(/\0/g, "");
    if (name) {
        return name;
    }
    name = metadata?.extra_metadata.name.replace(/\0/g, "");
    if (name) {
        return name;
    }

    return "Unknown Asset";
}

export const composeIdlParsed = composeIdl as Idl;
export const vaultIdlParsed = vaultIdl as Idl;


export const getExtraComputeTxn = (compute: number, fee?: number, heap?: number) => {
    const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
        units: compute
    });
    const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: fee || 1
    });
    const txns = [modifyComputeUnits, addPriorityFee];
    if (heap) {
        const modifyHeapLimit = ComputeBudgetProgram.requestHeapFrame({
            bytes: 1024 * heap
        });
        txns.push(modifyHeapLimit);
    }
    return txns;
};

export const getLookupTableForMint = async (mint: string) => {
    const subroute = `token/lookup_table/${mint}`;
    const res = await axios.get(BRIDGESPLIT_API + subroute);

    return res;
}

export const getProgramsLookupTable = () => {
    return getLookupTable(
        [
            ASSOCIATED_PROGRAM_ID,
            PROGRAM_IDS.token,
            PROGRAM_IDS.system,
            PROGRAM_IDS.metadata,
            SYSVAR_RENT_PUBKEY,
            SYSVAR_CLOCK_PUBKEY,
            PROGRAM_IDS.amm,
            PROGRAM_IDS.vault,
            COMPOSE_PID,
            PROGRAM_IDS.metadata,
            PROGRAM_IDS.whirlpool,
            FEE_PID,
            new PublicKey(PROGRAM_IDS.wrapped_sol),
            TREASURY
        ],
        PROGRAMS_LOOKUP_TABLE
    );
};

export const getLookupTable = (addresses: Array<PublicKey>, address: PublicKey) => {
    return {
        key: address,
        state: {
            deactivationSlot: BigInt("1000000"),
            lastExtendedSlot: 400000000000,
            lastExtendedSlotStartIndex: 400000000000,
            authority: PublicKey.default,
            addresses
        },
        isActive: function (): boolean {
            return true;
        }
    } as AddressLookupTableAccount;
};

export const composeProgram = (connection: Connection) => {
    const provider = new AnchorProvider(
        connection,
        { publicKey: PublicKey.default } as unknown as Wallet,
        AnchorProvider.defaultOptions()
    );
    const program = new Program(composeIdlParsed, COMPOSE_PID, provider) as unknown as Program<Compose>;
    return program;
};

const findProgramAddress = async (seeds: (Buffer | Uint8Array)[], programId: PublicKey): Promise<PublicKey> => {
    const result = await PublicKey.findProgramAddress(seeds, programId);
    // find out if this is faster or fetching from localstorage is faster
    return result[0];
};

export async function getMetadataKey(tokenMint: PublicKey): Promise<PublicKey> {
    return findProgramAddress(
        [Buffer.from(METADATA_PREFIX), PROGRAM_IDS.metadata.toBytes(), tokenMint.toBytes()],
        PROGRAM_IDS.metadata
    );
}