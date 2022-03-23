import { createClient } from 'graphql-ws';

export default class WsClient {
  constructor(params = {}) {
    this.client = createClient(params);
  }

  subscribe(query, variables, sink, options = {}) {
    return this.client.subscribe({ query, variables, ...options }, sink);
  }
}
