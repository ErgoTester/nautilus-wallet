import BigNumber from "bignumber.js";
import { bn } from "@/common/bigNumber";

const EXPLORER_URL = "https://api.sigmaspace.io/api/v1";
const USE_POOL = {
  tree: "1013040004020402040404020400040004000404040404060e20ef461517a55b8bfcd30356f112928f3333b5b50faf472e8374081307a09110cf0e202cf9fb512f487254777ac1d086a55cda9e74a1009fe0d30390a3792f050de58f0e201bfea21924f670ca5f13dd6819ed3bf833ec5a3113d5b6ae87d806db29b94b9a040004000e20dbf655f0f6101cb03316e931a689412126fefbfb7c78bd9869ad6a1a58c1b4240e20bc685d6ad1703ba5775736308fd892807edc04f48ba7a52e802fab241a59962c0500d807d601b2a5730000d602db6308a7d603db63087201d604b27203730100d605b27202730200d606db6308b2a4730300d6078cb2db6308b2a473040073050001d1ededededed93c27201c2a793b27202730600b27203730700938c7204018c720501938cb27203730800018cb272027309000193b17203730aececec937207730b937207730c937207730dedeced91b17206730e938cb27206730f00017310937207731193998c7205028c7204027312",
  initialLpSupply: bn("9223372036854774784")
};
const DEXYGOLD_POOL = {
  tree: "1013040004020402040404020400040004000404040404060e20ff7b7eff3c818f9dc573ca03a723a7f6ed1615bf27980ebd4a6c91986b26f8010e2010b755771f7253cff9727a9ca54bb2867e22b1b236657051c47ea9556c517e100e20471057efea32bf406d529902217844a258d3d6bedfcdcd3cfbab01872cc0b74c040004000e206597acef421c21a6468a2b58017df6577b23f00099d9e0772c0608deabdf6d130e20615be55206b1fea6d7d6828c1874621d5a6eb0e318f98a4e08c94a786f947cec0500d807d601b2a5730000d602db6308a7d603db63087201d604b27203730100d605b27202730200d606db6308b2a4730300d6078cb2db6308b2a473040073050001d1ededededed93c27201c2a793b27202730600b27203730700938c7204018c720501938cb27203730800018cb272027309000193b17203730aececec937207730b937207730c937207730dedeced91b17206730e938cb27206730f00017310937207731193998c7205028c7204027312",
  initialLpSupply: bn("100000000000")
};
const DEXY_POOLS = [USE_POOL, DEXYGOLD_POOL];

export type ExplorerBox = {
  value: number;
  assets: Array<{
    tokenId: string;
    amount: string | number;
    decimals: number;
  }>;
};

class DexyService {
  async getPools() {
    const requests = DEXY_POOLS.map(async (config) => {
      try {
        const url = `${EXPLORER_URL}/boxes/unspent/byErgoTree/${config.tree.trim()}?limit=500&offset=0`;
        const response = await fetch(url);
        if (!response.ok) return [];

        const data = await response.json();
        const items: ExplorerBox[] = data.items ?? [];

        return items.map((box) => ({
          box,
          config
        }));
      } catch {
        return [];
      }
    });

    const results = await Promise.all(requests);
    return results.flat();
  }

  async getRates(): Promise<Map<string, BigNumber>> {
    const pools = await this.getPools();
    const map = new Map<string, BigNumber>();

    for (const { box, config } of pools) {
      if (!box.assets || box.assets.length < 3) continue;

      const ergReserveNano = bn(box.value);

      const lpAsset = box.assets[1];
      if (lpAsset) {
        const lpInBox = bn(lpAsset.amount);
        const providedLp = config.initialLpSupply.minus(lpInBox);

        if (!providedLp.isZero()) {
          const lpPriceInErg = ergReserveNano
            .multipliedBy(2)
            .div(providedLp.multipliedBy(bn(10).pow(9)));

          map.set(lpAsset.tokenId, lpPriceInErg);
        }
      }

      const tokenAsset = box.assets[2];
      if (tokenAsset) {
        const tokenAmount = bn(tokenAsset.amount);
        if (tokenAmount.isZero()) continue;

        const decimals = tokenAsset.decimals ?? 0;

        const tokenPriceInErg = ergReserveNano
          .multipliedBy(bn(10).pow(decimals))
          .div(tokenAmount.multipliedBy(bn(10).pow(9)));

        map.set(tokenAsset.tokenId, tokenPriceInErg);
      }
    }

    return map;
  }
}

export const dexyService = new DexyService();
