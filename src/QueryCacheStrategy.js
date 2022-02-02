import AbstractQueryResolverStrategy from './AbstractQueryResolverStrategy';
import QueryCache from './QueryCache';
import cleanDenormalized from './cleanDenormalized';

export default class QueryCacheStrategy extends AbstractQueryResolverStrategy {
  constructor() {
    super();
    this.queryCache = null;
    this.freshlyFetched = false;
  }

  getCachedData() {
    return this.queryCache.get() || this.resolve();
  }

  resolve() {
    const resolvedData = (this.freshlyFetched)
      ? this.queryCache.get()
      : this.queryCache.refresh();

    this.freshlyFetched = false;

    return resolvedData;
  }

  setFetchedData(data) {
    this.queryCache = new QueryCache(cleanDenormalized(data));
    this.freshlyFetched = true;
  }

  processUpdates(updates, onStoreUpdate, isUpdate, notifySubscribers) {
    const relevantUpdates = [];

    for (let update of updates) {
      const updateQueryCacheFun = onStoreUpdate(update);

      if (updateQueryCacheFun) {
        this.queryCache.set(updateQueryCacheFun(this.queryCache.get()));
        relevantUpdates.push(update);
        continue;
      }

      if (isUpdate(update)) {
        this.queryCache.applyUpdate(update);
        relevantUpdates.push(update);
        continue;
      }
    }

    if (relevantUpdates.length > 0) {
      notifySubscribers(this.queryCache.get(), relevantUpdates);
    }
  }
}
