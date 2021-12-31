import store from './store';

export default class AbstractQuery {
  constructor(resolver) {
    this.resolver = resolver;
  }

  async watch(variables, subscriber, getUnsubscribeFn, options = {}) {
    if (!variables) {
      throw new Error('invalid argument: variables');
    }

    if (!subscriber) {
      throw new Error('invalid argument: subscriber');
    }

    if (!getUnsubscribeFn) {
      throw new Error('invalid argument: getUnsubscribeFn');
    }

    await this.fetchByStrategy(variables, options);

    return this.resolveAndSubscribe(variables, subscriber, getUnsubscribeFn);
  }

  async query(variables, options= {}) {
    if (!variables) {
      throw new Error('invalid argument: variables');
    }

    await this.fetchByStrategy(variables, options);

    return this.resolver(variables, store.getEntities());
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

  fetchByStrategy() {
    throw new Error("method `fetchByStrategy(variables, options)` must be implemented");
  }
}
