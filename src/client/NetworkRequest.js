export default class NetworkRequest {
  constructor(client, queryDocument) {
    this.client = client;
    this.queryDocument = queryDocument;
  }

  async execute(variables) {
    if (!variables) {
      throw new Error('invalid argument: variables');
    }

    const client = await this.client;
    return await client.request(this.queryDocument, variables);
  }
}
