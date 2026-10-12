import { ERG_TOKEN_ID } from "@/constants/ergo";
import { coinGeckoService } from "./coinGeckoService";
import { ergodexService } from "./ergodexService";
import { dexyService } from "./dexyService";
import { lithosService } from "./lithosService";

export type AssetRate = { erg: number; fiat: number; lpRate?: number };

class AssetPricingService {
  async getRates(fiatCurrency: string): Promise<Map<string, AssetRate> | undefined> {
    const [ergFiatRate, tokenRates, dexyRates, lithosRates] = await Promise.all([
      coinGeckoService.getPrice(fiatCurrency),
      ergodexService.getRates(),
      dexyService.getRates(),
      lithosService.getRates(),
    ]);

    if (!ergFiatRate && !tokenRates && !dexyRates && !lithosRates) return undefined;

    const rates = new Map<string, AssetRate>([[ERG_TOKEN_ID, { erg: 1, fiat: ergFiatRate }]]);

    if (tokenRates) {
      for (const [key, value] of tokenRates) {
        rates.set(key, {
          erg: value.toNumber(),
          fiat: value.times(ergFiatRate).toNumber(),
          lpRate: value.toNumber(),
        });
      }
    }

    if (dexyRates) {
      for (const [key, value] of dexyRates) {
        rates.set(key, {
          erg: value.toNumber(),
          fiat: value.times(ergFiatRate).toNumber(),
          lpRate: value.toNumber(),
        });
      }
    }

    if (lithosRates) {
      for (const [key, value] of lithosRates) {
        rates.set(key, {
          erg: value.toNumber(),
          fiat: value.times(ergFiatRate).toNumber(),
        });
      }
    }

    return rates;
  }
}

export const assetPricingService = new AssetPricingService();
