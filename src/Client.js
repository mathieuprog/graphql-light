import ky from 'ky';
import GraphQLError from './GraphQLError';

export default class Client {
  constructor(url, options) {
    this.url = url;
    this.options = options;
  }

  async request(query, variables = {}) {
    const json =
      (Object.keys(variables).length === 0)
      ? { query }
      : { query, variables }

    const { data, errors } = await ky.post(this.url, { json, ...this.options }).json();

    if (errors) {
      throw new GraphQLError(errors);
    }

    return data;
  }
}
