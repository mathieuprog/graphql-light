import AbstractQuery from './AbstractQuery';
import DerivedQueryForVars from './DerivedQueryForVars';

export default class DerivedQuery extends AbstractQuery {
  constructor(queries, resolver) {
    super();
    this.queries = queries;
    this.resolver = resolver;
  }

  getQueryForVars(variables) {
    return new DerivedQueryForVars(this, variables);
  }
}
