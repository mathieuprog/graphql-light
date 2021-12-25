import FetchStrategy from './FetchStrategy';
import NotFoundInCacheError from './NotFoundInCacheError';

export default function getStrategyAlgorithm(strategy) {
  return async ({ isCached, fetchData, cacheData }) => {
    switch (strategy) {
      case FetchStrategy.CACHE_AND_NETWORK:
        if (!isCached) {
          cacheData(await fetchData());
        } else {
          fetchData().then(data => cacheData(data));
        }
        break;
  
      case FetchStrategy.CACHE_FIRST:
        if (!isCached) {
          cacheData(await fetchData());
        }
        break;
  
      case FetchStrategy.NETWORK_ONLY:
        cacheData(await fetchData());
        break;
  
      case FetchStrategy.CACHE_ONLY:
        if (!isCached) {
          throw new NotFoundInCacheError('not found in cache');
        }
        break;
    }
  }
}
