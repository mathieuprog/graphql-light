import ky from 'ky';

class GraphQLError extends Error {
  constructor(errorArray) {
    super(JSON.stringify(errorArray));
    this.name = 'GraphQLError';
  }
}

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
