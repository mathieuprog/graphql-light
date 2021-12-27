import store from './store';

export default class AbstractQuery {
  constructor(resolver) {
    this.resolver = resolver;
  }

  async subscribe(variables, subscriber, getUnsubscribeFn, options) {
    if (!getUnsubscribeFn) {
      throw new Error('must pass a callback as third argument to retrieve the unsubscribe function');
    }

    variables = variables || {};

    await this.fetchAndCache(variables, options);

    return this.resolveAndSubscribe(variables, subscriber, getUnsubscribeFn);
  }

  async query(variables, options) {
    variables = variables || {};

    const fetchedData = await this.fetchAndCache(variables, options);

    return this.resolver(variables, entities, fetchedData);
  }

  resolveAndSubscribe(variables, subscriber, getUnsubscribeFn) {
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

    return filteredData;
  }

  fetchAndCache() {
    throw new Error("method `fetchAndCache(variables, options)` must be implemented");
  }
}
