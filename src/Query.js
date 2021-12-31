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
    this.pendingPromisesWithVarsWithVars = [];
    this.requestsMadeForVars = [];
  }

  async fetchAndCache(variables, options) {
    let fetchedData = null;

    const pendingPromisesWithVars = this.pendingPromisesWithVars.find(({ variables: v }) => areObjectsEqual(v, variables));

    if (pendingPromisesWithVars) {
      fetchedData = await pendingPromisesWithVars.promise;
    } else {
      const promise = this.doFetchAndCache(variables, options);

      this.pendingPromisesWithVars.push({ variables, promise });

      try {
        fetchedData = await promise;
      } finally {
        this.pendingPromisesWithVars = this.pendingPromisesWithVars.filter(({ variables: v }) => v !== variables);
      }
    }

    return fetchedData;
  }

  async doFetchAndCache(variables, options) {
    let fetchedData = null;

    await getFetchStrategyAlgorithm(options?.fetchStrategy || FetchStrategy.CACHE_FIRST)({
      isCached: this.isCached(variables),
      fetchData: () => fetchedData = this.fetchData(variables),
      cacheData: data => this.cacheData(data, variables)
    });

    return fetchedData;
  }

  async fetchData(variables) {
    let data = await this.client.request(this.queryDocument, variables);

    return this.transformer(data, variables);
  }

  cacheData(data, variables) {
    if (data) {
      store.store(data);
    }

    this.requestsMadeForVars = this.requestsMadeForVars.filter(v => !areObjectsEqual(v, variables));
    this.requestsMadeForVars.push(variables);
  }

  isCached(variables) {
    return this.requestsMadeForVars.some(v => areObjectsEqual(v, variables));
  }
}
