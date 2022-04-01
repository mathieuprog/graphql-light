import { isObjectLiteral } from 'object-array-utils';
import ObjectType from './constants/ObjectType';
import Object from './Object';

export default class RootObject extends Object {
  constructor(document) {
    super(document, ObjectType.OBJECT_LITERAL, null);
    this.document = document;
  }

  variableDefinitions(variableDefinitions) {
    if (!isObjectLiteral(variableDefinitions)) {
      throw new Error();
    }

    this.document.variableDefinitions = variableDefinitions;
    return this;
  }
}
