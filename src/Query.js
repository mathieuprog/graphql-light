import AbstractQuery from './AbstractQuery';
import store from './store';
import { areObjectsEqual } from './utils';
import FetchStrategy from './FetchStrategy';
import getFetchStrategyAlgorithm from './getFetchStrategyAlgorithm';

export default class Query extends AbstractQuery {
  // resolver: function retrieving the data from the cache and from the server's response data
  // transformer: function transforming data before storage
  constructor(client, queryDocument, resolver, transformer) {
    super(resolver);
    this.client = client;
    this.queryDocument = queryDocument;
    this.transformer = transformer || (data => data);
    this.fetching = [];
    this.cache = [];
  }

  async fetchAndCache(variables, options) {
    let fetchedData = null;

    await getFetchStrategyAlgorithm(options?.fetchStrategy || FetchStrategy.CACHE_FIRST)({
      isCached: this.isCached(variables),
      fetchData: () => fetchedData = this.fetchData(variables),
      cacheData: data => this.cacheData(data, variables)
    });

    return fetchedData;
  }

  async fetchData(variables) {
    let data;

    const fetching = this.fetching.find(({ variables: v }) => areObjectsEqual(v, variables));

    if (fetching) {
      data = await fetching.promise;
    } else {
      const promise = this.client.request(this.queryDocument, variables);

      this.fetching.push({ variables, promise });

      try {
        data = await promise;
      } finally {
        this.fetching = this.fetching.filter(({ variables: v }) => v !== variables);
      }
    }

    data = this.transformer(data, variables);

    return data;
  }

  cacheData(data, variables) {
    if (data) {
      store.store(data);
    }

    this.cache = this.cache.filter(v => !areObjectsEqual(v, variables));
    this.cache.push(variables);
  }

  isCached(variables) {
    return this.cache.some(v => areObjectsEqual(v, variables));
  }
}
