import Query from './Query';
import FetchStrategy from './FetchStrategy';
import getFetchStrategyAlgorithm from './getFetchStrategyAlgorithm';

export default class DerivedQuery {
  constructor(queries, resolver) {
    this.queries = queries;
    this.resolver = resolver;
  }

  async subscribe(variables, subscriber, getUnsubscribeFn, options) {
    if (!getUnsubscribeFn) {
      throw new Error('must pass a callback as third argument to retrieve the unsubscribe function');
    }

    variables = variables || {};

    const fetchedData = [];

    const queries =
      this.queries
        .map(({ query, takeVariables }) => {
          variables = takeVariables ? takeVariables(variables) : {};

          return getFetchStrategyAlgorithm(options?.fetchStrategy || FetchStrategy.CACHE_FIRST)({
            isCached: query.isCached(variables),
            fetchData: () => fetchedData.push(query.fetchData(variables)),
            cacheData: data => query.cacheData(data, variables)
          });
        });

    await Promise.all(queries);

    return Query.resolveAndSubscribe(variables, this.resolver, subscriber, getUnsubscribeFn, fetchedData);
  }
}
