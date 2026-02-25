import BigNumber from "bignumber.js";
import { bn } from "@/common/bigNumber";

const EXPLORER_URL = "https://api.sigmaspace.io/api/v1";
const ERGODEX_TREES = [
  "1999030f0400040204020404040405feffffffffffffffff0105feffffffffffffffff01050004d00f040004000406050005000580dac409d819d601b2a5730000d602e4c6a70404d603db63087201d604db6308a7d605b27203730100d606b27204730200d607b27203730300d608b27204730400d6099973058c720602d60a999973068c7205027209d60bc17201d60cc1a7d60d99720b720cd60e91720d7307d60f8c720802d6107e720f06d6117e720d06d612998c720702720fd6137e720c06d6147308d6157e721206d6167e720a06d6177e720906d6189c72117217d6199c72157217d1ededededededed93c27201c2a793e4c672010404720293b27203730900b27204730a00938c7205018c720601938c7207018c72080193b17203730b9593720a730c95720e929c9c721072117e7202069c7ef07212069a9c72137e7214067e9c720d7e72020506929c9c721372157e7202069c7ef0720d069a9c72107e7214067e9c72127e7202050695ed720e917212730d907216a19d721872139d72197210ed9272189c721672139272199c7216721091720b730e"
];
const INITIAL_LP_SUPPLY = bn("9223372036854774807");

export type ExplorerBox = {
  value: number;
  assets: Array<{
    tokenId: string;
    amount: string | number;
    decimals: number;
  }>;
};

class ErgodexService {
  async getPools(minErgInPool = 250): Promise<ExplorerBox[]> {
    const minNanoErg = bn(minErgInPool).multipliedBy(1e9);

    const requests = ERGODEX_TREES.map(async (tree) => {
      try {
        const url = `${EXPLORER_URL}/boxes/unspent/byErgoTree/${tree.trim()}?limit=500&offset=0`;
        const response = await fetch(url);
        if (!response.ok) return [];

        const data = await response.json();
        const items: ExplorerBox[] = data.items ?? [];

        return items.filter((box) => bn(box.value).isGreaterThan(minNanoErg));
      } catch {
        return [];
      }
    });

    const results = await Promise.all(requests);
    return results.flat();
  }

  async getRates(minErgInPool = 250): Promise<Map<string, BigNumber>> {
    const pools = await this.getPools(minErgInPool);
    const map = new Map<string, BigNumber>();

    for (const pool of pools) {
      if (!pool.assets || pool.assets.length < 3) continue;

      const ergReserveNano = bn(pool.value);

      const lpAsset = pool.assets[1];
      if (!lpAsset) continue;

      const lpInBox = bn(lpAsset.amount);
      const providedLp = INITIAL_LP_SUPPLY.minus(lpInBox);
      if (providedLp.isZero()) continue;

      const lpPriceInErg = ergReserveNano
        .multipliedBy(2)
        .div(providedLp.multipliedBy(bn(10).pow(9)));

      map.set(lpAsset.tokenId, lpPriceInErg);

      const tokenAsset = pool.assets[2];
      const tokenAmount = bn(tokenAsset.amount);
      const decimals = tokenAsset.decimals ?? 0;

      if (!tokenAsset || tokenAmount.isZero()) continue;

      const tokenPriceInErg = ergReserveNano
        .multipliedBy(bn(10).pow(decimals))
        .div(tokenAmount.multipliedBy(bn(10).pow(9)));

      map.set(tokenAsset.tokenId, tokenPriceInErg);
    }

    return map;
  }
}

export const ergodexService = new ErgodexService();
