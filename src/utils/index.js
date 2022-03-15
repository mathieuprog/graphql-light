import {
  areArraysEqual,
  areObjectsEqual,
  deepFreeze,
  hasObjectProp,
  hasObjectProps,
  isArray,
  isArrayOfObjects,
  isArrayOfObjectLiterals,
  isArraySubset,
  isEmptyArray,
  isNullOrUndefined,
  isObject,
  isObjectInstance,
  isObjectLiteral,
  isObjectSubset
} from 'object-array-utils';

function unique(array) {
  const newArray = [];
  array.forEach(item => {
    const index = newArray.findIndex(x => {
      return x.entity.id === item.entity.id
        && x.type === item.type
        && x.propName === item.propName
    });
    if (index === -1) {
      newArray.push(item);
    }
  });
  return newArray;
}

function isEntity(o) {
  return !!(isObjectLiteral(o) && o.id && o.__typename);
}

function isEntityProxy(o) {
  return isEntity(o) && o.__isProxy__;
}

function isArrayOfEntities(a) {
  return isArray(a) && a.length > 0 && a.every(isEntity);
}

function isArrayOfEntityProxies(a) {
  return isArray(a) && a.length > 0 && a.every(isEntityProxy);
}

export {
  areArraysEqual,
  areObjectsEqual,
  deepFreeze,
  hasObjectProp,
  hasObjectProps,
  isArray,
  isArrayOfEntities,
  isArrayOfEntityProxies,
  isArrayOfObjects,
  isArrayOfObjectLiterals,
  isArraySubset,
  isEmptyArray,
  isEntity,
  isEntityProxy,
  isNullOrUndefined,
  isObject,
  isObjectInstance,
  isObjectLiteral,
  isObjectSubset,
  unique
}
