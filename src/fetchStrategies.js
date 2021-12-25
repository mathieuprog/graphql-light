import NotFoundInCacheError from './NotFoundInCacheError';

/**
 * cache-first
 * First executes the query against the cache. If all requested data is present in the cache, that data is returned. Otherwise, executes the query against your GraphQL server and returns that data after caching it.
 * 
 * Prioritizes minimizing the number of network requests sent by your application.
 * 
 * This is the default fetch policy.
 * 
 * cache-only
 * Executes the query only against the cache. It never queries your server in this case.
 * 
 * A cache-only query throws an error if the cache does not contain data for all requested fields.
 * 
 * cache-and-network
 * Executes the full query against both the cache and your GraphQL server. The query automatically updates if the result of the server-side query modifies cached fields.
 * 
 * Provides a fast response while also helping to keep cached data consistent with server data.
 * 
 * network-only
 * Executes the full query against your GraphQL server, without first checking the cache. The query's result is stored in the cache.
 * 
 * Prioritizes consistency with server data, but can't provide a near-instantaneous response when cached data is available.
 */

const strategies = Object.freeze({
  CACHE_FIRST: 'CACHE_FIRST',
  CACHE_ONLY: 'CACHE_ONLY',
  CACHE_AND_NETWORK: 'CACHE_AND_NETWORK',
  NETWORK_ONLY: 'NETWORK_ONLY'
});

export default strategies;

export async function fetch({ strategy, isCached, fetchData, cacheData }) {
  switch (strategy) {
    case strategies.CACHE_AND_NETWORK:
      if (!isCached) {
        cacheData(await fetchData());
      } else {
        fetchData().then(data => cacheData(data));
      }
      break;

    case strategies.CACHE_FIRST:
      if (!isCached) {
        cacheData(await fetchData());
      }
      break;

    case strategies.NETWORK_ONLY:
      cacheData(await fetchData());
      break;

    case strategies.CACHE_ONLY:
      if (!isCached) {
        throw new NotFoundInCacheError('not found in cache');
      }
      break;
  }
};
