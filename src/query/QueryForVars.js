import store from '../store';
import AbstractQueryForVars from './AbstractQueryForVars';
import FetchStrategy from '../constants/FetchStrategy';
import OnUnobservedStrategy from '../constants/OnUnobservedStrategy';
import getFetchStrategyAlgorithm from './getFetchStrategyAlgorithm';
import QueryCacheStrategy from './resolvers/QueryCacheStrategy';
import CustomResolverStrategy from './resolvers/CustomResolverStrategy';
import { isObjectSubset } from '../utils';

export default class QueryForVars extends AbstractQueryForVars {
  constructor(query, executeRequest, variables, onUnobservedStrategy, options) {
    super(variables);
    this.query = query;
    this.executeRequest = executeRequest;
    this.pendingPromise = null;
    this.isCached = false;
    this.updatesToListenTo = [];
    this.unsubscribeFromStore = null;
    this.subscribers = new Set();
    this.onUnobservedStrategy = onUnobservedStrategy;

    this.options = options;
    this.initTimeoutClearWhenInactiveForDuration = () => this._initTimeoutClearWhenInactiveForDuration(options);
    this.initTimeoutRefreshAfterDuration(options);

    this.solicitedAt = null;

    this.strategy = this.getResolverStrategy();
  }

  _initTimeoutClearWhenInactiveForDuration({ clearWhenInactiveForDuration }) {
    clearTimeout(this.timeoutClearWhenInactiveForDuration);

    this.timeoutClearWhenInactiveForDuration = clearWhenInactiveForDuration && setTimeout(() => {
      this.query.removeQueryForVars(this.variables);
    }, clearWhenInactiveForDuration.total({ unit: 'millisecond' }));
  }

  initTimeoutRefreshAfterDuration({ refreshAfterDuration }) {
    this.timeoutRefreshAfterDuration = refreshAfterDuration && setInterval(() => {
      this.isCached = false;
      this.strategy = this.getResolverStrategy();
      this.fetchByStrategy({ fetchStrategy: FetchStrategy.NETWORK_ONLY });
    }, refreshAfterDuration.total({ unit: 'millisecond' }));
  }

  clear() {
    clearTimeout(this.timeoutClearWhenInactiveForDuration);
    clearTimeout(this.timeoutRefreshAfterDuration);
    this.subscribers.clear();
    this.unsubscribeFromStore && this.unsubscribeFromStore();
    this.unsubscribeFromStore = null;
  }

  getResolverStrategy() {
    if (this.query.customResolver) {
      const resolver = () => this.query.customResolver(this.variables, store.getEntities());
      return new CustomResolverStrategy(resolver);
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

  notifySubscribers(data, updates) {
    for (const { subscriber } of this.subscribers) {
      subscriber(data, updates);
    }

    if (this.subscribers.size > 0) {
      this.solicitedAt = new Date();
      this.initTimeoutClearWhenInactiveForDuration();
    }
  }

  subscribeToStore() {
    const unsubscriber = store.subscribe(updates => {
      const onStoreUpdate = update => this.query.onStoreUpdate(update, this.variables, isObjectSubset);
      const isUpdate = update => this.updatesToListenTo.some(u => {
        return update.entity.id === u.entity.id && isObjectSubset(update, u);
      });

      this.strategy.processUpdates(updates, onStoreUpdate, isUpdate, this.notifySubscribers.bind(this));
    });

    return () => {
      unsubscriber();
    };
  }

  async fetchByStrategy(options) {
    this.solicitedAt = new Date();
    this.initTimeoutClearWhenInactiveForDuration();

    if (this.query.dependentQueries.length > 0) {
      await Promise.all(this.query.dependentQueries.map(fun => fun(this.variables)));
    }

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

  async cacheData(data) {
    const onFetchEntity =
      (entity) => this.query.onFetchEntity(entity, this.variables, data);

    const onFetchArrayOfEntities =
      (propName, object) => this.query.onFetchArrayOfEntities(propName, object, this.variables, data);

    const { updatesToListenTo, denormalizedData } = await store.store(data, { onFetchEntity, onFetchArrayOfEntities });
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
