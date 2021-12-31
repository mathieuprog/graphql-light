import AbstractQuery from './AbstractQuery';
import FetchStrategy from './FetchStrategy';

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

          return query.fetchByStrategy(variables, options?.fetchStrategy || FetchStrategy.CACHE_FIRST);
        });

    await Promise.all(queries);
  }
}
