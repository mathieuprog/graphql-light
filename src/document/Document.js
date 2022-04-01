import RootObject from './RootObject';
import OperationType from './constants/OperationType';
import stringify from './stringify';

export default class Document {
  constructor(operationType, operationName) {
    this.operationType = operationType;
    this.operationName = operationName;
    this.variableDefinitions = {};
    this.rootObject = new RootObject(this);
    this.queryString = null;
  }

  static query(operationName = null) {
    return (new Document(OperationType.QUERY, operationName)).rootObject;
  }

  static mutation(operationName) {
    return (new Document(OperationType.MUTATION, operationName)).rootObject;
  }

  static subscription(operationName) {
    return (new Document(OperationType.SUBSCRIPTION, operationName)).rootObject;
  }

  prepareQueryString() {
    this.queryString = stringify(this);
    return this;
  }
}
