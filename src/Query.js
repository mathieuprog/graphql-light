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
    this.pendingPromisesForVars = [];
    this.requestsMadeForVars = [];
  }

  async fetchByStrategy(variables, options) {
    await getFetchStrategyAlgorithm(options.fetchStrategy || FetchStrategy.CACHE_FIRST)({
      isCached: this.isCached(variables),
      fetchData: () => this.fetchData(variables),
      cacheData: data => this.cacheData(data, variables)
    });
  }

  async fetchData(variables) {
    const makePromise = () => this.client.request(this.queryDocument, variables);
    let data = await this.executePromiseIfNotAlreadyPendingForVars(makePromise, variables);

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

  async executePromiseIfNotAlreadyPendingForVars(getPromise, variables) {
    const pendingPromisesForVars = this.pendingPromisesForVars.find(({ variables: v }) => areObjectsEqual(v, variables));

    let result;

    if (pendingPromisesForVars) {
      result = await pendingPromisesForVars.promise;
    } else {
      const promise = getPromise();

      this.pendingPromisesForVars.push({ variables, promise });

      try {
        result = await promise;
      } finally {
        this.pendingPromisesForVars = this.pendingPromisesForVars.filter(({ variables: v }) => v !== variables);
      }
    }

    return result;
  }
}
