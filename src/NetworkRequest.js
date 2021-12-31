import Query from './Query';

export default class NetworkRequest {
  constructor(client, queryDocument) {
    this.query = new Query(client, queryDocument, () => 1);
  }

  async execute(variables) {
    const data = await this.query.fetchData(variables);
    this.query.cacheData(data, variables);
    return data;
  }
}
