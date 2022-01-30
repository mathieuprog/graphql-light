import AbstractQuery from './AbstractQuery';
import QueryForVars, { OnUnobservedStrategy } from './QueryForVars';

export { OnUnobservedStrategy };

export default class Query extends AbstractQuery {
  // resolver: function retrieving the data from the cache and from the server's response data
  // transformer: function transforming data before storage
  constructor(client, queryDocument) {
    super();
    this.userResolver = null;
    this.client = client;
    this.queryDocument = queryDocument;
    this.transformer = data => data;
    this.onStoreUpdate = () => undefined;
    this.queriesForVars = [];
    this.getOnUnobservedStrategy = _variables => OnUnobservedStrategy.PAUSE_UPDATING;
  }

  setResolver(resolver) {
    this.userResolver = resolver;
  }

  setTransformer(transformer) {
    this.transformer = transformer;
  }

  setOnStoreUpdate(onStoreUpdate) {
    this.onStoreUpdate = onStoreUpdate;
  }

  setOnUnobservedStrategy(callback) {
    this.getOnUnobservedStrategy = callback;
  }

  getQueryForVars(variables) {
    const stringifiedVars = JSON.stringify(variables);
    let queryForVars = this.queriesForVars[stringifiedVars];

    if (!queryForVars) {
      const executeRequest = () => this.client.request(this.queryDocument, this.variables);
      const onUnobservedStrategy = this.getOnUnobservedStrategy(variables);
      queryForVars = new QueryForVars(this, executeRequest, variables, onUnobservedStrategy);
      this.queriesForVars[stringifiedVars] = queryForVars;
    }

    return queryForVars;
  }
}
