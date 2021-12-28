const buildErrorMessage = errorArray =>
  errorArray.map(error => error.message).join("\n");

export default class GraphQLError extends Error {
  constructor(errorArray) {
    super(buildErrorMessage(errorArray));
    this.name = 'GraphQLError';
    this.graphQLErrors = errorArray;
  }
}
