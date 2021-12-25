import Query from './Query';
import FetchStrategy from './FetchStrategy';
import getStrategyAlgorithm from './getStrategyAlgorithm';

export default class DerivedQuery {
  constructor(queries, resolver) {
    this.queries = queries;
    this.resolver = resolver;
  }

  async subscribe(variables, subscriber, getUnsubscribeFn, options) {
    if (!getUnsubscribeFn) {
      throw new Error('must pass a callback as third argument to retrieve the unsubscribe function');
    }

    options = options || {};
    variables = variables || {};

    const queries =
      this.queries
        .map(({ query, takeVariables }) => {
          variables = takeVariables ? takeVariables(variables) : {};

          return getStrategyAlgorithm(options.fetchStrategy || FetchStrategy.CACHE_FIRST)({
            isCached: query.isCached(variables),
            fetchData: () => query.fetchData(variables),
            cacheData: data => query.cacheData(data, variables)
          });
        });

    await Promise.all(queries);

    return Query.resolveAndSubscribe(variables, this.resolver, subscriber, getUnsubscribeFn);
  }
}
