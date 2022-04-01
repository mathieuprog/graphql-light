import {
  areArraysEqual,
  areObjectsEqual,
  deepFreeze,
  hasObjectProperties,
  isArray,
  isArrayOfObjectLiterals,
  isArrayOfPrimitives,
  isArrayOfType,
  isEmptyArray,
  isNullOrUndefined,
  isObjectLiteral,
  isObjectSubset,
  takeProperties
} from 'object-array-utils';
import createProxy from '../store/createProxy';

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
  return isEntity(o) && !!o.__isProxy__;
}

function isArrayOfEntities(a) {
  return isArray(a) && a.length > 0 && a.every(isEntity);
}

function isArrayOfEntityProxies(a) {
  return isArray(a) && a.length > 0 && a.every(isEntityProxy);
}

function hasCorrespondingForeignKeyField({ config }, { __typename }, propName) {
  return (config.associationsByTypename[__typename] ?? [])
    .some(({ field }) => field === propName);
}

function isForeignKeyField({ config }, { __typename }, propName) {
  return (config.associationsByTypename[__typename] ?? [])
    .some(({ foreignKeyField }) => foreignKeyField === propName);
}

function reconcileAssociations(store, oldData, newData, entity) {
  if (isObjectLiteral(newData)) {
    newData = { ...newData };

    for (let [propName, propValue] of Object.entries(newData)) {
      const oldPropValue = oldData?.[propName];

      if (hasCorrespondingForeignKeyField(store, entity, propName)) {
        const isArray_ = isArray(propValue);
        if (
          (isArray_ && !isArrayOfEntityProxies(propValue))
          || (!isArray_ && !isEntityProxy(propValue))
        ) {
          throw new Error();
        }

        const changedValue = (isArray_)
          ? (!isArray(oldPropValue) || !areArraysEqual(propValue.map(({ id }) => id), oldPropValue.map(({ id }) => id)))
          : propValue.id !== oldPropValue?.id;

        if (changedValue) {
          const associations = store.config.associationsByTypename[entity.__typename];

          const { foreignKeyField } = associations.find(({ field }) => field === propName);
          if (foreignKeyField !== propName) {
            newData[foreignKeyField] = (isArray_)
              ? propValue.map(({ id }) => id)
              : propValue.id;
          }
        }

        continue;
      }

      if (isForeignKeyField(store, entity, propName)) {
        const isArray_ = isArray(propValue);
        if (
          (isArray_ && !isArrayOfType(propValue, 'string'))
          || (!isArray_ && typeof propValue !== 'string')
        ) {
          throw new Error();
        }

        const changedValue = (isArray_)
          ? (!isArray(oldPropValue) || !areArraysEqual(propValue, oldPropValue))
          : propValue !== oldPropValue;

        if (changedValue) {
          const associations = store.config.associationsByTypename[entity.__typename];

          const { field } = associations.find(({ foreignKeyField }) => foreignKeyField === propName);
          if (field !== propName) {
            if (isArray_) {
              newData[field] = propValue.map((id) => {
                const entity = store.getEntityById(id);
                if (!entity) {
                  throw new Error();
                }

                return createProxy(entity, store.getEntityById.bind(store));
              });
            } else {
              const entity = store.getEntityById(propValue);
              if (!entity) {
                throw new Error();
              }

              newData[field] = createProxy(entity, store.getEntityById.bind(store));
            }
          }
        }

        continue;
      }

      if (isEntityProxy(propValue) || isArrayOfEntityProxies(propValue)) {
        continue;
      }

      if (isObjectLiteral(propValue) || isArray(propValue)) {
        newData[propName] = reconcileAssociations(store, oldPropValue, propValue, entity);
      }
    }

    return newData;
  }

  if (isArray(newData)) {
    return newData.map((element, i) => reconcileAssociations(store, oldData?.[i], element, entity));
  }

  return newData;
}

export {
  areArraysEqual,
  areObjectsEqual,
  deepFreeze,
  hasObjectProperties,
  isArray,
  isArrayOfEntities,
  isArrayOfEntityProxies,
  isArrayOfObjectLiterals,
  isArrayOfPrimitives,
  isArrayOfType,
  hasCorrespondingForeignKeyField,
  isEmptyArray,
  isEntity,
  isEntityProxy,
  isForeignKeyField,
  isNullOrUndefined,
  isObjectLiteral,
  isObjectSubset,
  reconcileAssociations,
  takeProperties,
  unique
}
