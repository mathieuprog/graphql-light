import ky from 'ky';
import GraphQLError from './GraphQLError';

export default class Client {
  constructor(url, options) {
    this.url = url;
    this.options = options;
  }

  async request(body, variables = {}) {
    const { data, errors } = await ky.post(this.url, { json: { query: body, variables }, ...this.options }).json();

    if (errors) {
      throw new GraphQLError(errors);
    }

    return data;
  }
}
