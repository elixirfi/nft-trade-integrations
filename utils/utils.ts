import { AnchorProvider, Idl, Program, Wallet } from "@project-serum/anchor";
import { AnchorState, NftMetadata } from "./types";
import {
    AddressLookupTableAccount,
    ComputeBudgetProgram,
    Connection,
    PublicKey,
    SYSVAR_CLOCK_PUBKEY,
    SYSVAR_RENT_PUBKEY
} from "@solana/web3.js";

import { METADATA_PREFIX, PROGRAM_IDS } from "./constants";
import { Compose, Vault } from "../program";
import composeIdl from "../program/compose/compose.json";
import vaultIdl from "../program/vault/vault.json";

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

export const getExtraComputeTxn = (compute: number) => {
    const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
        units: compute
    });
    const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 1
    });
    return [modifyComputeUnits, addPriorityFee];
};

export const getProgramsLookupTable = () => {
    return getLookupTable(
        [
            PROGRAM_IDS.associatedToken,
            PROGRAM_IDS.token,
            PROGRAM_IDS.system,
            PROGRAM_IDS.metadata,
            SYSVAR_RENT_PUBKEY,
            SYSVAR_CLOCK_PUBKEY,
            PROGRAM_IDS.amm,
            PROGRAM_IDS.vault
        ],
        PROGRAM_IDS.lookups
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
    const program = new Program(composeIdlParsed, PROGRAM_IDS.compose, provider) as unknown as Program<Compose>;
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