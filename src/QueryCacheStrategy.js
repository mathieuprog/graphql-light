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
    let mustNotify = false;

    for (let update of updates) {
      const updateQueryCacheFun = onStoreUpdate(update);

      if (updateQueryCacheFun) {
        this.queryCache.set(updateQueryCacheFun(this.queryCache.get()));
        mustNotify = true;
        continue;
      }

      if (isUpdate(update)) {
        this.queryCache.applyUpdate(update);
        mustNotify = true;
        continue;
      }
    }

    if (mustNotify) {
      notifySubscribers(this.queryCache.get());
    }
  }
}
