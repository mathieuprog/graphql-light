import store from '../store';

export default class Mutation {
  // transformer: function transforming data before storage
  constructor(client, queryDocument) {
    this.client = client;
    this.queryDocument = queryDocument;
    this.transformer = data => data;
    this.onFetchEntity = () => undefined;
    this.onFetchArrayOfEntities = () => undefined;
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

  async mutate(variables, callback = _ => true) {
    let data = await this.client.request(this.queryDocument, variables || {});

    callback(data);

    const transformedData = this.transformer(data, variables);

    if (transformedData) {
      const onFetchEntity =
        (entity) => this.onFetchEntity(entity, variables, data);
      const onFetchArrayOfEntities =
        (propName, object) => this.setOnFetchArrayOfEntities(propName, object, variables, data);

      await store.store(transformedData, { onFetchEntity, onFetchArrayOfEntities });
    }

    return data;
  }
}
