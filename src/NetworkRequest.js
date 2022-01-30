export default class NetworkRequest {
  constructor(client, queryDocument) {
    this.client = client;
    this.queryDocument = queryDocument;
  }

  async execute(variables) {
    if (!variables) {
      throw new Error('invalid argument: variables');
    }

    return await this.client.request(this.queryDocument, this.variables);
  }
}
