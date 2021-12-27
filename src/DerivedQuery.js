import AbstractQuery from './AbstractQuery';
import FetchStrategy from './FetchStrategy';
import getFetchStrategyAlgorithm from './getFetchStrategyAlgorithm';

export default class DerivedQuery extends AbstractQuery {
  constructor(queries, resolver) {
    super(resolver);
    this.queries = queries;
  }

  async fetchAndCache(variables, options) {
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

    return fetchedData;
  }
}
