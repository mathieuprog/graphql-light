import store from './store';
import AbstractQueryForVars from './AbstractQueryForVars';
import FetchStrategy from './FetchStrategy';
import getFetchStrategyAlgorithm from './getFetchStrategyAlgorithm';
import QueryCacheStrategy from './QueryCacheStrategy';
import UserResolverStrategy from './UserResolverStrategy';
import OnUnobservedStrategy from './OnUnobservedStrategy';
import { isObjectSubset } from './utils';

export { OnUnobservedStrategy };

export default class QueryForVars extends AbstractQueryForVars {
  constructor(query, executeRequest, variables, onUnobservedStrategy) {
    super(variables);
    this.query = query;
    this.executeRequest = executeRequest;
    this.pendingPromise = null;
    this.isCached = false;
    this.updatesToListenTo = [];
    this.unsubscribeFromStore = null;
    this.subscribers = new Set();
    this.onUnobservedStrategy = onUnobservedStrategy;

    this.clearWhenInactiveForDuration = null; // TODO
    this.refreshAfterDuration = null; // TODO

    this.solicitedAt = null;

    this.strategy = this.getResolverStrategy();
  }

  getResolverStrategy() {
    if (this.query.userResolver) {
      const resolver = () => this.query.userResolver(this.variables, store.getEntities());
      return new UserResolverStrategy(resolver);
    }

    return new QueryCacheStrategy();
  }

  resolve() {
    const resolved = (this.unsubscribeFromStore) // currently updating
      ? this.strategy.getCachedData()
      : this.strategy.resolve();

    this.maybeSubscribeToStore();

    return resolved;
  }

  subscribe(subscriber) {
    const item = { subscriber };
    this.subscribers.add(item);

    this.maybeSubscribeToStore();

    return () => {
      this.subscribers.delete(item);

      this.maybeUnsubscribeFromStore();
    };
  }

  maybeSubscribeToStore() {
    if (
      !this.unsubscribeFromStore
      && (
        this.onUnobservedStrategy === OnUnobservedStrategy.KEEP_UPDATING
        || this.subscribers.size === 1
      )
    ) {
      this.unsubscribeFromStore = this.subscribeToStore();
    }
  }

  maybeUnsubscribeFromStore() {
    if (
      this.unsubscribeFromStore
      && this.subscribers.size === 0
      && this.onUnobservedStrategy === OnUnobservedStrategy.PAUSE_UPDATING
    ) {
      this.unsubscribeFromStore();
      this.unsubscribeFromStore = null;
    }
  }

  notifySubscribers(data) {
    for (const { subscriber } of this.subscribers) {
      subscriber(data);
    }

    if (this.subscribers.size > 0) {
      this.solicitedAt = new Date();
    }
  }

  subscribeToStore() {
    const unsubscriber = store.subscribe(updates => {
      const onStoreUpdate = update => this.query.onStoreUpdate(update, this.variables, isObjectSubset);
      const isUpdate = update => this.updatesToListenTo.some(u => isObjectSubset(update, u));

      this.strategy.processUpdates(updates, onStoreUpdate, isUpdate, this.notifySubscribers.bind(this));
    });

    return () => {
      unsubscriber();
    };
  }

  async fetchByStrategy(options) {
    this.solicitedAt = new Date();

    await getFetchStrategyAlgorithm(options.fetchStrategy || FetchStrategy.CACHE_FIRST)({
      fetchData: this.fetchData.bind(this),
      cacheData: this.cacheData.bind(this),
      isCached: this.isCached
    });
  }

  async fetchData() {
    const data = await this.executePromiseOrWaitPending();
    return this.query.transformer(data, this.variables);
  }

  cacheData(data) {
    const { updatesToListenTo, denormalizedData } = store.store(data);
    this.updatesToListenTo = updatesToListenTo;

    this.strategy.setFetchedData(denormalizedData);

    this.isCached = true;
  }

  async executePromiseOrWaitPending() {
    let result;

    if (this.pendingPromise) {
      result = await this.pendingPromise;
    } else {
      const promise = this.executeRequest();

      this.pendingPromise = promise;

      try {
        result = await promise;
      } finally {
        this.pendingPromise = null;
      }
    }

    return result;
  }
}
