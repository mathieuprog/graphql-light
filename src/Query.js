import store from './store';
import { areObjectsEqual } from './utils';
import FetchStrategy from './FetchStrategy';
import getStrategyAlgorithm from './getStrategyAlgorithm';

export default class Query {
  // resolver: function retrieving the data from the cache and from the server's response data
  // transformer: function transforming data before storage
  constructor(client, queryDocument, resolver, transformer) {
    this.client = client;
    this.queryDocument = queryDocument;
    this.resolver = resolver;
    this.transformer = transformer || (data => data);
    this.fetching = [];
    this.cache = [];
  }

  async subscribe(variables, subscriber, getUnsubscribeFn, options) {
    if (!getUnsubscribeFn) {
      throw new Error('must pass a callback as third argument to retrieve the unsubscribe function');
    }

    variables = variables || {};

    await getStrategyAlgorithm(options?.fetchStrategy || FetchStrategy.CACHE_FIRST)({
      isCached: this.isCached(variables),
      fetchData: () => this.fetchData(variables),
      cacheData: data => this.cacheData(data, variables)
    });

    return Query.resolveAndSubscribe(variables, this.resolver, subscriber, getUnsubscribeFn);
  }

  static resolveAndSubscribe(variables, resolver, subscriber, getUnsubscribeFn) {
    let isUpdate = false;
    let filteredData = null;
    const unsubscribe = store.subscribe(entities => {
      const newFilteredData = resolver(variables, entities);

      if (isUpdate) {
        if (newFilteredData !== filteredData) {
          subscriber(newFilteredData);
        }
      } else {
        isUpdate = true;
      }

      filteredData = newFilteredData;
    });

    getUnsubscribeFn(unsubscribe);

    return filteredData;
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
