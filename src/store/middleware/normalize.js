import createProxy from '../createProxy';
import UpdateType from '../../constants/UpdateType';
import {
  areObjectsEqual,
  isArray,
  isArrayOfEntities,
  isArrayOfEntityProxies,
  hasCorrespondingForeignKeyField,
  isEmptyArray,
  isEntity,
  isEntityProxy,
  isForeignKeyField,
  isObjectLiteral,
  reconcileAssociations,
  unique
} from '../../utils';
import transform from '../../utils/transform';

export function removeEntity(entity) {
  return { type: 'remove', id: entity.id };
}

export function removeEntityById(id) {
  return { type: 'remove', id };
}

export function updateEntity(entity, propName, updater) {
  return { type: 'update', entity, propName, updater };
}

const hooks = {
  onCompareArrays: hookOnCompareArrays,
  onCompareObjects: hookOnCompareObjects
};

export default function normalize(result, store, callbacks = {}) {
  const { denormalizedData } = result;

  const r = {
    updates: [],
    entities: { ...store.entities }
  };

  [].concat(denormalizedData).forEach(object => {
    doNormalize(store, object, callbacks, r);
  });

  let updates = unique(r.updates);

  const deletedEntityIds = updates.filter(({ type }) => type === UpdateType.DELETE_ENTITY).map(({ entity }) => entity.id);
  updates = updates.filter(({ entity, type }) => !deletedEntityIds.includes(entity.id) || type === UpdateType.DELETE_ENTITY);

  store.entities = r.entities;

  return { ...result, updates };
}

// `getObjectFromStore` argument is used for appending to an array of entities from nested object literals/arrays.
function doNormalize(store, object, callbacks, result, getObjectFromStore = null, entity = null) {
  if (!isObjectLiteral(object)) {
    throw new Error(`unexpected condition, not an object literal: "${JSON.stringify(object)}"`);
  }

  object = { ...object };

  if (isEntity(object)) {
    const transformResolvers = store.config.transformers[object.__typename]?.data;
    if (transformResolvers) {
      object = transform(object, transformResolvers);
    }

    entity = object;
    getObjectFromStore = () => store.getEntityById(object.id);
  }

  let normalizedObject = object;

  for (let [propName, propValue] of Object.entries(object)) {
    if (['id', '__typename'].includes(propName)) {
      continue;
    }

    if (entity && isForeignKeyField(store, entity, propName) && !hasCorrespondingForeignKeyField(store, entity, propName)) {
      continue;
    }

    if (isEntity(propValue)) {
      const getObjectFromStore_ = () => store.getEntityById(propValue.id);
      doNormalize(store, propValue, callbacks, result, getObjectFromStore_, entity);

      propValue = createProxy(propValue, store.getEntityById.bind(store));

    } else if (isObjectLiteral(propValue)) {
      const getObjectFromStore_ = (getObjectFromStore) ? () => getObjectFromStore()?.[propName] : null;
      propValue = doNormalize(store, propValue, callbacks, result, getObjectFromStore_, entity);

    } else if (isArray(propValue)) {
      const array = propValue; // renaming for readability

      const cachedArray = getObjectFromStore?.()?.[propName];

      if (isArrayOfEntities(array) || (isEmptyArray(array) && isArrayOfEntities(cachedArray))) {
        let onFetchArray = callbacks.onFetchArrayOfEntities?.(propName, object);
        let foreignKeyField = null;

        if (hasCorrespondingForeignKeyField(store, entity, propName)) {
          const associations = store.config.associationsByTypename[entity.__typename];

          ({ foreignKeyField } = associations.find(({ field }) => field === propName));
          if (foreignKeyField === propName) {
            foreignKeyField = null;
          }
        }

        if (!onFetchArray && foreignKeyField) {
          onFetchArray = callbacks.onFetchArrayOfEntities?.(foreignKeyField, object)
        }

        if (!onFetchArray || !['append', 'override', 'remove'].includes(onFetchArray)) {
          throw new Error(`specify whether elements in \`${propName}\` must be appended, removed or must override the existing cached array`);
        }

        array.forEach(entity => {
          const getObjectFromStore_ = () => store.getEntityById(entity.id);
          doNormalize(store, entity, callbacks, result, getObjectFromStore_, entity);
        });

        propValue =
          (onFetchArray !== 'remove')
            ? array.map(entity => createProxy(entity, store.getEntityById.bind(store)))
            : array;

        if (cachedArray && cachedArray.length > 0) {
          switch (onFetchArray) {
            case 'append':
              propValue =
                cachedArray
                  .filter(({ id }) => !array.some(e => e.id === id))
                  .concat(propValue);
              break;

            case 'remove':
              propValue =
                cachedArray
                  .filter(({ id }) => !array.some(e => e.id === id));
              break;
          }
        }

        if (foreignKeyField) {
          normalizedObject[foreignKeyField] = propValue.map(({ id }) => id);
        }

      } else {
        const getObjectFromStore_ = (getObjectFromStore) ? () => getObjectFromStore()?.[propName] : null;
        propValue = processArrayRecursively(array, store, callbacks, result, getObjectFromStore_, entity);
      }
    }

    normalizedObject[propName] = propValue;
  }

  if (isEntity(normalizedObject)) {
    const normalizedEntity = normalizedObject;
    const isNewEntity = !result.entities[normalizedEntity.id];

    if (isNewEntity) {
      result.entities[normalizedEntity.id] = normalizedEntity;
      result.updates.push({ type: UpdateType.CREATE_ENTITY, entity: normalizedEntity });
    } else {
      for (let [propName, newValue] of Object.entries(normalizedEntity)) {
        if (['id', '__typename'].includes(propName)) {
          continue;
        }

        const oldValue = result.entities[normalizedEntity.id]?.[propName];

        result.entities[normalizedEntity.id] = {
          ...result.entities[normalizedEntity.id],
          [propName]: newValue
        };

        if (oldValue === undefined || !areObjectsEqual({ v: oldValue }, { v: newValue }, { hooks })) {
          result.updates.push({ type: UpdateType.UPDATE_PROP, entity: normalizedEntity, propName });
        }
      }
    }

    let onFetchEntity = callbacks.onFetchEntity?.(normalizedEntity);
    if (onFetchEntity) {
      onFetchEntity = [].concat(onFetchEntity);

      onFetchEntity.forEach(update => {
        switch (update.type) {
          case 'update':
            const { entity, propName, updater } = update;

            const oldValue = result.entities[entity.id]?.[propName];
            let nextValue = updater(result.entities[entity.id][propName]);

            let toMerge = { [propName]: nextValue };
            if (oldValue) {
              toMerge = reconcileAssociations(store, { [propName]: oldValue }, { [propName]: nextValue }, entity)
            }

            result.entities[entity.id] = {
              ...result.entities[entity.id],
              ...toMerge
            };

            if (oldValue === undefined || !areObjectsEqual({ v: oldValue }, { v: nextValue }, { hooks })) {
              result.updates.push({ type: UpdateType.UPDATE_PROP, entity: result.entities[entity.id], propName });

              if (isForeignKeyField(store, entity, propName)) {
                const associations = store.config.associationsByTypename[entity.__typename];

                const { field } = associations.find(({ foreignKeyField }) => foreignKeyField === propName);
                if (field !== propName) {
                  result.updates.push({ type: UpdateType.UPDATE_PROP, entity: result.entities[entity.id], propName: field });
                }

              } else if (hasCorrespondingForeignKeyField(store, entity, propName)) {
                const associations = store.config.associationsByTypename[entity.__typename];

                const { foreignKeyField } = associations.find(({ field }) => field === propName);
                if (foreignKeyField !== propName) {
                  result.updates.push({ type: UpdateType.UPDATE_PROP, entity: result.entities[entity.id], propName: foreignKeyField });
                }
              }
            }
            break;

          case 'remove':
            const { id } = update;

            const { [id]: deletedEntity, ...entities } = result.entities;
            result.entities = entities;

            result.updates.push({ type: UpdateType.DELETE_ENTITY, entity: deletedEntity });
            break;
        }
      });
    }
  }

  return normalizedObject;
}

function processArrayRecursively(array, store, callbacks, result, getObjectFromStore, entity) {
  return array.map((element, i) => {
    if (isObjectLiteral(element)) {
      const getObjectFromStore_ = (getObjectFromStore) ? () => getObjectFromStore()?.[i] : null;
      return doNormalize(store, element, callbacks, result, getObjectFromStore_, entity);
    }

    if (isArray(element)) {
      const getObjectFromStore_ = (getObjectFromStore) ? () => getObjectFromStore()?.[i] : null;
      return processArrayRecursively(element, store, callbacks, result, getObjectFromStore_, entity);
    }

    return element;
  });
}

function hookOnCompareObjects(a, b) {
  if (isEntity(a) !== isEntity(b)) return { ne: true };

  if (isEntity(a)) {
    return {
      eq: a.id === b.id,
      ne: a.id !== b.id
    };
  }
}

function hookOnCompareArrays(a, b) {
  if (isArrayOfEntities(a) || isArrayOfEntities(b)) {
    if (a.length !== b.length) return { ne: true };

    for (let entityA of a) {
      const index = b.findIndex(entityB => entityA.id === entityB.id);
      if (index === -1) return { ne: true };
      b.splice(index, 1);
    }

    return { eq: true };
  }
}
