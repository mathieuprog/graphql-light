import { isEmptyArray } from 'object-array-utils';
import OperationType from './constants/OperationType';

export default function stringify(document) {
  let str = '';

  switch (document.operationType) {
    case OperationType.QUERY:
      if (document.variableDefinitions || document.operationName) {
        str += 'query';
      }
      break;

    case OperationType.MUTATION:
      str += 'mutation';
      break;

    case OperationType.SUBSCRIPTION:
      str += 'subscription';
      break;
  }

  if (document.operationName) {
    str += ' ' + document.operationName;
  }

  if (document.variableDefinitions) {
    str += `(${Object.entries(document.variableDefinitions).map(([name, type]) => `\$${name}:${type}`).join(',')})`;
  }

  return doStringify(str, [document.rootObject]);
}

function doStringify(str, objects) {
  for (let object of objects) {
    if (!object.isRoot()) {
      str += object.name;

      if (!isEmptyArray(object.variables)) {
        str += `(${object.variables.map((variable) => `${variable}:\$${variable}`).join(',')})`;
      }
    }

    str += `{${object.scalars.join(' ')}`;

    if (!isEmptyArray(object.objects)) {
      str = doStringify(str + ' ', object.objects);
    }

    str += '}';
  }

  return str;
}
