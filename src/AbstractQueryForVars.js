export default class AbstractQueryForVars {
  constructor(variables) {
    this.variables = variables;
  }

  async fetchByStrategy() {
    throw new Error("method `fetchByStrategy(variables, options)` must be implemented");
  }

  subscribe() {
    throw new Error("method `subscribe(variables, subscriber, getUnsubscribeFn)` must be implemented");
  }

  resolve() {
    throw new Error("method `resolve(variables)` must be implemented");
  }
}
