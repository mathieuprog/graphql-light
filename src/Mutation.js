import store from './store';

export default class Mutation {
  // transformer: function transforming data before storage
  constructor(client, queryDocument) {
    this.client = client;
    this.queryDocument = queryDocument;
    this.transformer = data => data;
  }

  setTransformer(transformer) {
    this.transformer = transformer;
  }

  async mutate(variables, callback = _ => true) {
    let data = await this.client.request(this.queryDocument, variables || {});

    callback(data);

    const transformedData = this.transformer(data, variables);

    if (transformedData) {
      store.store(transformedData);
    }

    return data;
  }
}
