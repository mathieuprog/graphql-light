import Query from './Query';

export default class NetworkRequest {
  constructor(client, queryDocument) {
    this.query = new Query(client, queryDocument, () => 1);
  }

  async execute(variables, options = {}) {
    if (!variables) {
      throw new Error('invalid argument: variables');
    }

    const data = await this.query.fetchData(variables);

    if (options.cache ?? true) {
      this.query.cacheData(data, variables);
    }

    return data;
  }

  getQuery() {
    return this.query;
  }
}
