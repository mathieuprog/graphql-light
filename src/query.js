import store from './store';
import { areObjectsEqual } from './utils';

// TODO support multiple caching strategies
// https://www.apollographql.com/docs/react/data/queries/#supported-fetch-policies

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

  async subscribe(variables, subscriber, getUnsubscribeFn) {
    if (!getUnsubscribeFn) {
      throw new Error('must pass a callback as third argument to retrieve the unsubscribe function');
    }

    variables = variables || {};

    const isCached = this.isCached(variables);

    // if not cached, first execute request, then return data from store
    if (!isCached) {
      await this.fetchAndUpdateStore(variables);
    }

    let isUpdate = false;
    let filteredData = null;
    const unsubscribe = store.subscribe(entities => {
      const newFilteredData = this.resolver(variables, entities);

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

    // if cached, first return data from store, then execute request, any updates (stale cache) will be sent consecutively
    if (isCached) {
      await this.fetchAndUpdateStore(variables);
    }

    return filteredData;
  }

  fetchAndUpdateStore(variables) {
    return this._getRequestPromiseForVariables(variables)
        || this._doFetchAndUpdateStore(variables);
  }

  async _doFetchAndUpdateStore(variables) {
    const promise = this.client.request(this.queryDocument, variables);

    this.fetching.push({ variables, promise });

    let data;
    try {
      data = await promise;
    } finally {
      this.fetching = this.fetching.filter(({ variables: v, _ }) => v !== variables);
    }

    data = this.transformer(data, variables);
    if (data) {
      store.store(data);
    }

    this.cache = this.cache.filter(v => !areObjectsEqual(v, variables));
    this.cache.push(variables);
  }

  isCached(variables) {
    return this.cache.some(v => areObjectsEqual(v, variables));
  }

  _getRequestPromiseForVariables(variables) {
    const fetching = this.fetching.find(({ variables: v, _ }) => areObjectsEqual(v, variables));
    return fetching && fetching.promise;
  }
}
