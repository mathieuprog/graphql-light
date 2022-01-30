import AbstractQueryForVars from './AbstractQueryForVars';
import FetchStrategy from './FetchStrategy';

export default class DerivedQueryForVars extends AbstractQueryForVars {
  constructor(derivedQuery, variables) {
    super(variables);
    this.derivedQuery = derivedQuery;
    this.queries =
      derivedQuery.queries.map(({ query, takeVariables }) => {
        variables = takeVariables ? takeVariables(variables) : {};
        return query.getQueryForVars(variables);
      });
  }

  async fetchByStrategy(options) {
    const promises =
      this.queries.map(query =>
        query.fetchByStrategy(options?.fetchStrategy || FetchStrategy.CACHE_FIRST));

    await Promise.all(promises);
  }

  resolve() {
    const resolvedData = this.queries.map(query => query.resolve());
    return this.derivedQuery.resolver(resolvedData);
  }

  subscribe(subscriber) {
    const unsubscribers =
      this.queries.map(query =>
        query.subscribe(_data => subscriber(this.resolve())));

    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }
}
