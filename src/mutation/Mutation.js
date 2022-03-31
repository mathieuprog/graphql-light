import store from '../store';

export default class Mutation {
  // transformer: function transforming data before storage
  constructor(client, queryDocument) {
    this.client = client;
    this.queryDocument = queryDocument;
    this.transformer = data => data;
    this.onFetchEntity = () => undefined;
    this.onFetchArrayOfEntities = () => undefined;
    this.onMissingRelation = () => undefined;
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

  setOnMissingRelation(onMissingRelation) {
    this.onMissingRelation = onMissingRelation;
  }

  async mutate(variables) {
    if (!variables) {
      throw new Error('invalid argument: variables');
    }

    const client = await this.client;
    let data = await client.request(this.queryDocument, variables);

    data = this.transformer(data, variables);

    if (data) {
      const onFetchEntity =
        (entity) => this.onFetchEntity(entity, variables, data);

      const onFetchArrayOfEntities =
        (propName, object) => this.onFetchArrayOfEntities(propName, object, variables, data);

      const onMissingRelation =
        (propName, propValue, object) => this.onMissingRelation(propName, propValue, object, variables, data);

      ({ denormalizedData: data } = await store.store(data, { onFetchEntity, onFetchArrayOfEntities, onMissingRelation }));
    }

    return data;
  }
}
