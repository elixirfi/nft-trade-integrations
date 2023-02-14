import { Idl, Program, Wallet } from "@project-serum/anchor";
import { Provider } from "@saberhq/solana-contrib";
import { PublicKey, Transaction } from "@solana/web3.js";
import { Compose } from "../program/compose";

export type May<T> = T | undefined;

export interface AnchorState<T extends Idl> {
    provider: Provider;
    program: Program<T>;
    wallet: Wallet | null;
    vault: PublicKey;
    idl: Idl;
}

export interface TransactionResult {
    transactions?: Transaction[];
    error?: string;
    status: boolean;
}

export enum TokenStandard {
    NonFungible = "NonFungible",
    FungibleAsset = "FungibleAsset",
    Fungible = "Fungible",
    NonFungibleEdition = "NonFungibleEdition",
    ProgrammableNonFungible = "ProgrammableNonFungible"
}

export interface Creator {
    address: string;
    verified: boolean;
    share: number;
}

export interface NftData {
    name: string;
    symbol: string;
    uri: string;
    seller_fee_basis_points: number;
    creators?: Array<Creator>;
}
export interface Attribute {
    trait_type: string;
    value: string;
}

export type RawNftAttributes = May<Attribute[] | { [attribute: string]: string }>;

export interface Collection {
    name: string;
    family: string;
}

export interface ExtraMetadata {
    name: string;
    symbol: string;
    description: string;
    image: string;
    attributes?: Attribute[];
    collection?: Collection;
    animation_url?: string;
    external_url?: string;
    update_authority?: string;
}

export interface NftMetadata {
    update_authority: string;
    mint: string;
    image: string;
    data: NftData;
    primary_sale_happened: boolean;
    is_mutable: boolean;
    token_standard: TokenStandard;
    extra_metadata: ExtraMetadata;
    programmable_config?: string;
    pools?: Array<string>;
}

export enum PriorityFee {
    NONE = 0,
    BASE_LINE = 500_000,
    HIGH = 1_000_000
}

export interface WhirlpoolElixirData {
    whirlpool: string;
    tokenVaultA: string;
    tokenVaultB: string;
    tickArray0: string;
    tickArray1: string;
    tickArray2: string;
    oracle: string;
}


export interface Price {
    price: number | null;
    cumulativePrice: number | null;
    observationId?: string;
    ticks?: string[];
}

export interface OrcaPoolInfo {
    mint: string;
    collectionId: string;
    whirlpool: string;
    oracle: string;
    tokenVaultA: string;
    tokenVaultB: string;
    tokenPrice: number;
    buys: Price[];
    sells: Price[];
}

export interface RaydiumPoolInfo {
    mint: string;
    collectionId: string;
    tokenPrice: number;
    buys: Price[];
    sells: Price[];
}

export interface PoolInfoV2 {
    mint: string;
    collectionId: string;
    fee: number;
    royalty: number;
    tokenPrice: number;
    raydium: RaydiumPoolInfo | null;
    orca: OrcaPoolInfo | null;
}