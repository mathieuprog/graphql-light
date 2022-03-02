import AbstractQuery from './AbstractQuery';
import DerivedQueryForVars from './DerivedQueryForVars';

export default class DerivedQuery extends AbstractQuery {
  constructor(queries, resolver) {
    super();
    this.queries = queries;
    this.resolver = resolver;
    this.onQueryUpdate = () => undefined;
  }

  setOnQueryUpdate(onQueryUpdate) {
    this.onQueryUpdate = onQueryUpdate;
  }

  getQueryForVars(variables) {
    return new DerivedQueryForVars(this, variables);
  }
}
