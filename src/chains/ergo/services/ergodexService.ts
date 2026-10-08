import BigNumber from "bignumber.js";
import { bn } from "@/common/bigNumber";

const EXPLORER_URL = "https://api.ergoplatform.com/api/v1";
const ERG_TOKEN_POOL = {
  tree: "1999030f0400040204020404040405feffffffffffffffff0105feffffffffffffffff01050004d00f040004000406050005000580dac409d819d601b2a5730000d602e4c6a70404d603db63087201d604db6308a7d605b27203730100d606b27204730200d607b27203730300d608b27204730400d6099973058c720602d60a999973068c7205027209d60bc17201d60cc1a7d60d99720b720cd60e91720d7307d60f8c720802d6107e720f06d6117e720d06d612998c720702720fd6137e720c06d6147308d6157e721206d6167e720a06d6177e720906d6189c72117217d6199c72157217d1ededededededed93c27201c2a793e4c672010404720293b27203730900b27204730a00938c7205018c720601938c7207018c72080193b17203730b9593720a730c95720e929c9c721072117e7202069c7ef07212069a9c72137e7214067e9c720d7e72020506929c9c721372157e7202069c7ef0720d069a9c72107e7214067e9c72127e7202050695ed720e917212730d907216a19d721872139d72197210ed9272189c721672139272199c7216721091720b730e",
  initialLpSupply: bn("9223372036854774807")
};
const TOKEN_TOKEN_POOL = {
  tree: "19a9030f040004020402040404040406040605feffffffffffffffff0105feffffffffffffffff01050004d00f0400040005000500d81ad601b2a5730000d602e4c6a70404d603db63087201d604db6308a7d605b27203730100d606b27204730200d607b27203730300d608b27204730400d609b27203730500d60ab27204730600d60b9973078c720602d60c999973088c720502720bd60d8c720802d60e998c720702720dd60f91720e7309d6108c720a02d6117e721006d6127e720e06d613998c7209027210d6147e720d06d615730ad6167e721306d6177e720c06d6187e720b06d6199c72127218d61a9c72167218d1edededededed93c27201c2a793e4c672010404720292c17201c1a793b27203730b00b27204730c00938c7205018c720601ed938c7207018c720801938c7209018c720a019593720c730d95720f929c9c721172127e7202069c7ef07213069a9c72147e7215067e9c720e7e72020506929c9c721472167e7202069c7ef0720e069a9c72117e7215067e9c72137e7202050695ed720f917213730e907217a19d721972149d721a7211ed9272199c7217721492721a9c72177211",
  initialLpSupply: bn("9223372036854774807")
};
const ERGODEX_POOLS = [ERG_TOKEN_POOL,TOKEN_TOKEN_POOL];

export type ExplorerBox = {
  value: number;
  assets: Array<{
    tokenId: string;
    amount: string | number;
    decimals: number;
  }>;
};

class ErgodexService {
  async getPools() {
    const requests = ERGODEX_POOLS.map(async (pool) => {
      try {
        const url = `${EXPLORER_URL}/boxes/unspent/byErgoTree/${pool.tree.trim()}?limit=500&offset=0`;
        const response = await fetch(url);
        if (!response.ok) return [];

        const data = await response.json();

        return (data.items ?? []).map((box: ExplorerBox) => ({
          ...box,
          pool
        }));
      } catch {
        return [];
      }
    });

    const results = await Promise.all(requests);
    return results.flat();
  }

  async getRates(minErgInPool = 250): Promise<Map<string, BigNumber>> {
    const pools = await this.getPools();
    const map = new Map<string, BigNumber>();

    const minNanoErg = bn(minErgInPool).multipliedBy(1e9);

    for (const pool of pools) {
      if (pool.pool !== ERG_TOKEN_POOL) continue;
      if (bn(pool.value).isLessThan(minNanoErg)) continue;
      if (!pool.assets || pool.assets.length < 3) continue;

      const ergReserveNano = bn(pool.value);
      const lpAsset = pool.assets[1];
      const tokenAsset = pool.assets[2];

      if (!lpAsset || !tokenAsset) continue;

      const providedLp = pool.pool.initialLpSupply.minus(lpAsset.amount);
      if (providedLp.isZero()) continue;

      const lpPriceInErg = ergReserveNano
        .multipliedBy(2)
        .div(providedLp.multipliedBy(bn(10).pow(9)));

      map.set(lpAsset.tokenId, lpPriceInErg);

      const tokenPriceInErg = ergReserveNano
        .multipliedBy(bn(10).pow(tokenAsset.decimals ?? 0))
        .div(
          bn(tokenAsset.amount)
            .multipliedBy(bn(10).pow(9))
        );

      map.set(tokenAsset.tokenId, tokenPriceInErg);
    }

    for (const pool of pools) {
      if (pool.pool !== TOKEN_TOKEN_POOL) continue;
      if (!pool.assets || pool.assets.length < 3) continue;

      const tokenA = pool.assets[0];
      const lpAsset = pool.assets[1];
      const tokenB = pool.assets[2];

      if (!tokenA || !lpAsset || !tokenB) continue;

      const tokenAPrice = map.get(tokenA.tokenId);
      const tokenBPrice = map.get(tokenB.tokenId);

      if (!tokenAPrice && !tokenBPrice) continue;

      const providedLp = pool.pool.initialLpSupply.minus(lpAsset.amount);
      if (providedLp.isZero()) continue;

      const reserveA = bn(tokenA.amount)
        .div(bn(10).pow(tokenA.decimals ?? 0));

      const reserveB = bn(tokenB.amount)
        .div(bn(10).pow(tokenB.decimals ?? 0));

      let poolValueInErg: BigNumber;

      if (tokenAPrice && tokenBPrice) {
        poolValueInErg = reserveA
          .multipliedBy(tokenAPrice)
          .plus(reserveB.multipliedBy(tokenBPrice));
      } else if (tokenAPrice) {
        poolValueInErg = reserveA
          .multipliedBy(tokenAPrice)
          .multipliedBy(2);
      } else {
        poolValueInErg = reserveB
          .multipliedBy(tokenBPrice!)
          .multipliedBy(2);
      }

      const lpPriceInErg = poolValueInErg.div(providedLp);

      map.set(lpAsset.tokenId, lpPriceInErg);
    }

    return map;
  }
}

export const ergodexService = new ErgodexService();
