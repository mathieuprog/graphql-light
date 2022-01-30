import AbstractQueryResolverStrategy from './AbstractQueryResolverStrategy';

export default class UserResolverStrategy extends AbstractQueryResolverStrategy {
  constructor(resolver) {
    super();
    this.resolver = resolver;
  }

  getCachedData() {
    return this.data || this.resolve();
  }

  resolve() {
    this.data = this.resolver();
    return this.data;
  }

  setFetchedData(_data) {}

  processUpdates(updates, onStoreUpdate, isUpdate, notifySubscribers) {
    let mustResolve = false;

    for (let update of updates) {
      const _isUpdate = onStoreUpdate(update);

      if (_isUpdate || ((_isUpdate === undefined || _isUpdate === null) && isUpdate(update))) {
        mustResolve = true;
        break;
      }
    }

    if (mustResolve) {
      notifySubscribers(this.resolve());
    }
  }
}
