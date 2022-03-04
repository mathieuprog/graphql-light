import FetchStrategy from '../constants/FetchStrategy';
import NotFoundInCacheError from '../errors/NotFoundInCacheError';

export default function getFetchStrategyAlgorithm(strategy) {
  return async ({ isCached, fetchData, cacheData }) => {
    switch (strategy) {
      default:
        throw new Error(`unknown strategy ${strategy}`);

      case FetchStrategy.CACHE_FIRST:
        if (!isCached) {
          await cacheData(await fetchData());
        }
        break;

      case FetchStrategy.CACHE_AND_NETWORK:
        if (!isCached) {
          await cacheData(await fetchData());
        } else {
          fetchData().then(cacheData);
        }
        break;

      case FetchStrategy.NETWORK_ONLY:
        await cacheData(await fetchData());
        break;

      case FetchStrategy.CACHE_ONLY:
        if (!isCached) {
          throw new NotFoundInCacheError('not found in cache');
        }
        break;
    }
  }
}
