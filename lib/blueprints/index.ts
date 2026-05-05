import { STOCKS_BLUEPRINT } from './stocks';
import { CRYPTO_BLUEPRINT } from './crypto';
import { COMMODITIES_BLUEPRINT } from './commodities';
import type { AssetClass, Blueprint } from './types';

export type { AssetClass, Blueprint, BlueprintParams } from './types';
export { STOCKS_BLUEPRINT, CRYPTO_BLUEPRINT, COMMODITIES_BLUEPRINT };

export const BLUEPRINTS: Readonly<Record<AssetClass, Blueprint>> = {
  stocks: STOCKS_BLUEPRINT,
  crypto: CRYPTO_BLUEPRINT,
  commodities: COMMODITIES_BLUEPRINT,
};

export const BLUEPRINT_LIST: readonly Blueprint[] = [
  STOCKS_BLUEPRINT,
  CRYPTO_BLUEPRINT,
  COMMODITIES_BLUEPRINT,
];
