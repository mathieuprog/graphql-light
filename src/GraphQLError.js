export default class GraphQLError extends Error {
  constructor(errorArray) {
    super(JSON.stringify(errorArray));
    this.name = 'GraphQLError';
  }
}
