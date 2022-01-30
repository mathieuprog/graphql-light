export default class AbstractQueryResolverStrategy {
  constructor() {
    this.data = null;
  }

  getCachedData() {
    throw new Error("method `getCachedData()` must be implemented");
  }

  resolve() {
    throw new Error("method `resolve()` must be implemented");
  }

  setFetchedData(_data) {
    throw new Error("method `setFetchedData(data)` must be implemented");
  }

  processStoreUpdates(_updates, _onStoreUpdate, _isUpdate, _notifySubscribers) {
    throw new Error("method `processStoreUpdates(updates, onStoreUpdate, isUpdate, notifySubscribers)` must be implemented");
  }
}
