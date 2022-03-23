import ky from 'ky';
import GraphQLError from '../errors/GraphQLError';

export default class HttpClient {
  constructor(params = {}) {
    this.url = params.url;
    delete params.url;
    this.params = params;
  }

  async request(query, variables = {}) {
    const json =
      (Object.keys(variables).length === 0)
      ? { query }
      : { query, variables };

    const { data, errors } = await ky.post(this.url, { json, ...this.params }).json();

    if (errors) {
      throw new GraphQLError(errors);
    }

    return data;
  }
}
