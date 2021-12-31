import AbstractQuery from './AbstractQuery';
import FetchStrategy from './FetchStrategy';
import NetworkRequest from './NetworkRequest';

export default class DerivedQuery extends AbstractQuery {
  constructor(queries, resolver) {
    super(resolver);
    this.queries = queries;
  }

  async fetchByStrategy(variables, options) {
    const queries =
      this.queries
        .map(({ query, takeVariables }, i) => {
          variables = takeVariables ? takeVariables(variables) : {};

          if (query instanceof NetworkRequest) {
            query = query.getQuery();
          }

          return query.fetchByStrategy(variables, options?.fetchStrategy || FetchStrategy.CACHE_FIRST);
        });

    await Promise.all(queries);
  }
}
