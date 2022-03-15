import AbstractQuery from './AbstractQuery';
import QueryForVars from './QueryForVars';
import OnUnobservedStrategy from '../constants/OnUnobservedStrategy';
import UpdateType from '../constants/UpdateType';

export default class Query extends AbstractQuery {
  // resolver: function retrieving the data from the cache and from the server's response data
  // transformer: function transforming data before storage
  constructor(client, queryDocument) {
    super();
    this.customResolver = null;
    this.client = client;
    this.queryDocument = queryDocument;
    this.transformer = data => data;
    this.onFetchEntity = () => undefined;
    this.onFetchArrayOfEntities = () => undefined;
    this.onMissingRelation = () => undefined;
    this.onStoreUpdate = () => undefined;
    this.queriesForVars = {};
    this.getOnUnobservedStrategy = _variables => OnUnobservedStrategy.PAUSE_UPDATING;
    this.getOptions = _variables => ({});
    this.dependentQueries = [];
  }

  setDependentQueries(queries) {
    this.dependentQueries = queries;
  }

  setOnFetchEntity(onFetchEntity) {
    this.onFetchEntity = onFetchEntity;
  }

  setOnFetchArrayOfEntities(onFetchArrayOfEntities) {
    this.onFetchArrayOfEntities = onFetchArrayOfEntities;
  }

  setOnMissingRelation(onMissingRelation) {
    this.onMissingRelation = onMissingRelation;
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

  setResolver(resolver) {
    this.customResolver = resolver;
  }

  setTransformer(transformer) {
    this.transformer = transformer;
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

export function handleStoreUpdate({ entity, type, propName }, config) {
  const { shouldUpdate, onCreate, onDelete, onUpdate } = config[entity.__typename] || {};

  switch (type) {
    case UpdateType.CREATE_ENTITY:
      return onCreate && shouldUpdate(entity) && onCreate(entity);

    case UpdateType.DELETE_ENTITY:
      return onDelete && shouldUpdate(entity) && onDelete(entity);

    case UpdateType.UPDATE_PROP:
      return onUpdate && shouldUpdate(entity) && onUpdate(entity, propName);
  }
};
