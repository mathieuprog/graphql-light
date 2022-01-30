import Watcher from './Watcher';

export default class AbstractQuery {
  constructor() {
    this.updateSubscribersForVars = [];
  }

  watcher(unsubscribeFn) {
    return new Watcher(this, unsubscribeFn);
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

    const queryForVars = this.getQueryForVars(variables);

    await queryForVars.fetchByStrategy(options);

    const resolved = queryForVars.resolve();

    const unsubscribe = queryForVars.subscribe(subscriber);

    getUnsubscribeFn(unsubscribe);

    return resolved;
  }

  async query(variables, options = {}) {
    if (!variables) {
      throw new Error('invalid argument: variables');
    }

    const queryForVars = this.getQueryForVars(variables);

    await queryForVars.fetchByStrategy(options);

    return queryForVars.resolve();
  }

  getQueryForVars() {
    throw new Error("method `getQueryForVars(variables)` must be implemented");
  }
}
