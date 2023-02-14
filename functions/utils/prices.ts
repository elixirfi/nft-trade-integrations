import axios from "axios";
import { PRICES_V2, PoolInfoV2 } from "../../utils";

export async function retrievePrices(mints?: string[], numNfts?: number): Promise<PoolInfoV2[]> {
    let url = numNfts ? PRICES_V2 + "?numNfts=" + numNfts : PRICES_V2;

    const { data: prices } = await axios.get(url) as { data: PoolInfoV2[] };

    let filteredPrices = mints ? prices.filter((p) => mints.includes(p.mint)) : prices;
    
    return filteredPrices
}
