import store from './store';

export default class DerivedQuery {
  constructor(queries, resolver) {
    this.queries = queries;
    this.resolver = resolver;
  }

  async subscribe(variables, subscriber, getUnsubscribeFn) {
    if (!getUnsubscribeFn) {
      throw new Error('must pass a callback as third argument to retrieve the unsubscribe function');
    }

    const queries =
      this.queries
        .map(({query, takeVariables}) => ({ query, variables: takeVariables(variables) }))
        .filter(({query, variables}) => !query.isCached(variables))
        .map(({query, variables}) => query.fetchAndUpdateStore(variables));

    await Promise.all(queries);

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
}
