import { ERG_TOKEN_ID } from "@/constants/ergo";
import { coinGeckoService } from "./coinGeckoService";
import { ergodexService } from "./ergodexService";
import { dexyService } from "./dexyService";
import BigNumber from "bignumber.js";

export type AssetRate = { erg: number; fiat: number };

class AssetPricingService {
  async getRates(
    fiatCurrency: string
  ): Promise<Map<string, AssetRate> | undefined> {
    const [ergFiatRate, tokenRates, dexyRates] = await Promise.all([
      coinGeckoService.getPrice(fiatCurrency),
      ergodexService.getRates(),
      dexyService.getRates()
    ]);

    if (!ergFiatRate && !tokenRates && !dexyRates) return undefined;

    const rates = new Map<string, AssetRate>();

    // =============================
    // ERG base price
    // =============================
    if (ergFiatRate) {
      rates.set(ERG_TOKEN_ID, {
        erg: 1,
        fiat: ergFiatRate
      });
    }

    // =============================
    // Spectrum / ErgoDex rates
    // (includes tokens + LP tokens)
    // =============================
    if (tokenRates && ergFiatRate) {
      for (const [tokenId, priceInErg] of tokenRates) {
        if (!priceInErg || !(priceInErg instanceof BigNumber)) continue;

        const fiatValue = priceInErg
          .multipliedBy(ergFiatRate)
          .toNumber();

        rates.set(tokenId, {
          erg: priceInErg.toNumber(),
          fiat: fiatValue
        });
      }
    }

    // =============================
    // Dexy rates
    // =============================
    if (dexyRates && ergFiatRate) {
      for (const [tokenId, priceInErg] of dexyRates) {
        if (!priceInErg || !(priceInErg instanceof BigNumber)) continue;

        const fiatValue = priceInErg
          .multipliedBy(ergFiatRate)
          .toNumber();

        rates.set(tokenId, {
          erg: priceInErg.toNumber(),
          fiat: fiatValue
        });
      }
    }

    return rates;
  }
}

export const assetPricingService = new AssetPricingService();
