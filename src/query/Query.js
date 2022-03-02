import AbstractQuery from './AbstractQuery';
import QueryForVars from './QueryForVars';
import OnUnobservedStrategy from '../constants/OnUnobservedStrategy';

export default class Query extends AbstractQuery {
  // resolver: function retrieving the data from the cache and from the server's response data
  // transformer: function transforming data before storage
  constructor(client, queryDocument) {
    super();
    this.userResolver = null;
    this.client = client;
    this.queryDocument = queryDocument;
    this.transformer = data => data;
    this.onFetchEntity = () => undefined;
    this.onFetchArrayOfEntities = () => undefined;
    this.onStoreUpdate = () => undefined;
    this.queriesForVars = {};
    this.getOnUnobservedStrategy = _variables => OnUnobservedStrategy.PAUSE_UPDATING;
    this.getOptions = _variables => ({});
  }

  setResolver(resolver) {
    this.userResolver = resolver;
  }

  setTransformer(transformer) {
    this.transformer = transformer;
  }

  setOnFetchEntity(onFetchEntity) {
    this.onFetchEntity = onFetchEntity;
  }

  setOnFetchArrayOfEntities(onFetchArrayOfEntities) {
    this.onFetchArrayOfEntities = onFetchArrayOfEntities;
  }

  setOnStoreUpdate(onStoreUpdate) {
    this.onStoreUpdate = onStoreUpdate;
  }

  setOnUnobservedStrategy(callback) {
    this.getOnUnobservedStrategy = callback;
  }

  setOptions(callback) {
    this.getOptions = callback;
  }

  getQueryForVars(variables) {
    const stringifiedVars = JSON.stringify(variables);
    let queryForVars = this.queriesForVars[stringifiedVars];

    if (!queryForVars) {
      const executeRequest = () => this.client.request(this.queryDocument, variables);
      const onUnobservedStrategy = this.getOnUnobservedStrategy(variables);
      const options = this.getOptions(variables);
      queryForVars = new QueryForVars(this, executeRequest, variables, onUnobservedStrategy, options);
      this.queriesForVars[stringifiedVars] = queryForVars;
    }

    return queryForVars;
  }

  removeQueryForVars(variables) {
    const stringifiedVars = JSON.stringify(variables);
    this.queriesForVars[stringifiedVars].clear();
    delete this.queriesForVars[stringifiedVars];
  }
}
