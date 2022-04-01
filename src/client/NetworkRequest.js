export default class NetworkRequest {
  constructor(client, document) {
    this.client = client;
    this.document = document;
  }

  async execute(variables) {
    if (!variables) {
      throw new Error('invalid argument: variables');
    }

    const client = await this.client;
    return await client.request(this.document?.queryString, variables);
  }
}
