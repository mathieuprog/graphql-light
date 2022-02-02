import { isArray, isEntity, isObjectLiteral } from './utils';

export default function cleanDenormalized(data) {
  if (isObjectLiteral(data)) {
    if (data.__delete) {
      return null;
    }

    doCleanDenormalized(data);

    return data;
  }

  if (isArray(data)) {
    data = { array: data };
    doCleanDenormalized(data);

    return data.array;
  }
}

function doCleanDenormalized(object) {
  if (!isObjectLiteral(object)) {
    throw new Error(`unexpected condition, not an object literal: "${JSON.stringify(object)}"`);
  }

  if (!object.__delete) delete object.__delete;
  if (!object.__unlink) delete object.__unlink;

  for (let [propName, propValue] of Object.entries(object)) {
    if (isObjectLiteral(propValue)) {
      if (isEntity(propValue) && propValue.__delete) {
        delete object[propName];
      } else {
        doCleanDenormalized(propValue);
      }
    } else if (isArray(propValue)) {
      delete object.__onArray;
      object[propName] = propValue.filter(e => !e.__delete && !e.__unlink);
      processArrayRecursively(object[propName]);
    }
  }

  if (['__delete', '__unlink', '__onArray'].some(meta => object.hasOwnProperty(meta))) {
    throw new Error(`unexpected meta prop on object: ${JSON.stringify(object)}`);
  }
}

function processArrayRecursively(array) {
  array.forEach(element => {
    if (isObjectLiteral(element)) {
      doCleanDenormalized(element);
    } else if (isArray(element)) {
      processArrayRecursively(element);
    }
  });
}
