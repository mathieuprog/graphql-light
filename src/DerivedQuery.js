import AbstractQuery from './AbstractQuery';
import FetchStrategy from './FetchStrategy';

export default class DerivedQuery extends AbstractQuery {
  constructor(queries, resolver) {
    super(resolver);
    this.queries = queries;
  }

  async fetchAndCache(variables, options) {
    const fetchedData = [];

    const queries =
      this.queries
        .map(async ({ query, takeVariables }, i) => {
          variables = takeVariables ? takeVariables(variables) : {};

          const data = await query.fetchAndCache(variables, options?.fetchStrategy || FetchStrategy.CACHE_FIRST);
          fetchedData[i] = data;
          return data;
        });

    await Promise.all(queries);

    return fetchedData;
  }
}
