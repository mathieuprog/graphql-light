import store from '../store';
import AbstractQueryForVars from './AbstractQueryForVars';
import FetchStrategy from '../constants/FetchStrategy';
import { isObjectSubset } from '../utils';

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
    return this.derivedQuery.resolver(resolvedData, this.variables, store.getEntities());
  }

  subscribe(subscriber) {
    const _subscribe = (_data, updates) => {
      for (let update of updates) {
        const isUpdate = this.derivedQuery.onQueryUpdate(update, this.variables, isObjectSubset);

        if (isUpdate || isUpdate === undefined) {
          subscriber(this.resolve());
          break;
        }
      }
    }

    const unsubscribers = this.queries.map(query => query.subscribe(_subscribe));

    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }
}
