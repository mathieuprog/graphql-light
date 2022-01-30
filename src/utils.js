import {
  areArraysEqual,
  areObjectsEqual,
  deepFreeze,
  hasObjectProp,
  isArray,
  isArrayOfObjects,
  isArrayOfObjectLiterals,
  isArraySubset,
  isNullOrUndefined,
  isObject,
  isObjectInstance,
  isObjectLiteral,
  isObjectSubset
} from 'object-array-utils';

function isEntity(o) {
  if (isObjectLiteral(o)) {
    if (!!o.id !== !!o.__typename) {
      throw new Error(`id or __typename not set: ${JSON.stringify(o)}`);
    }

    return !!(o.id && o.__typename);
  }

  return false;
}

function isEntityProxy(o) {
  if (isEntity(o)) {
    return !!o.__target__;
  }

  return false;
}

function isArrayOfEntities(a) {
  if (!isArray(a) || a.length === 0) {
    return false;
  }

  return a.every(o => {
    if (isObjectLiteral(o)) {
      if (!!o.id !== !!o.__typename) {
        throw new Error(`id or __typename not set: ${JSON.stringify(o)}`);
      }

      return o.id && o.__typename;
    }

    return false;
  });
}

export {
  areArraysEqual,
  areObjectsEqual,
  deepFreeze,
  hasObjectProp,
  isArray,
  isArrayOfEntities,
  isArrayOfObjects,
  isArrayOfObjectLiterals,
  isArraySubset,
  isEntity,
  isEntityProxy,
  isNullOrUndefined,
  isObject,
  isObjectInstance,
  isObjectLiteral,
  isObjectSubset
}
