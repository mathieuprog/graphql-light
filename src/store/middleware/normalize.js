import createProxy from '../createProxy';
import UpdateType from '../../constants/UpdateType';
import {
  areObjectsEqual,
  isArray,
  isArrayOfEntities,
  isEntity,
  isObjectLiteral,
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

  let updates = [];

  const newEntities = { byId: { ...store.entities } };

  [].concat(denormalizedData).forEach(entity => {
    doNormalize(store, entity, () => store.getEntityById(entity.id), callbacks, newEntities, updates);
  });

  updates = unique(updates);

  const deletedEntityIds = updates.filter(({ type }) => type === UpdateType.DELETE_ENTITY).map(({ entity }) => entity.id);
  updates = updates.filter(({ entity, type }) => !deletedEntityIds.includes(entity.id) || type === UpdateType.DELETE_ENTITY);

  store.entities = newEntities.byId;

  return { ...result, updates };
}

// `getObjectFromStore` argument is used for appending to an array of entities from nested object literals/arrays.
function doNormalize(store, object, getObjectFromStore, callbacks, newEntities, updates) {
  if (!isObjectLiteral(object)) {
    throw new Error(`unexpected condition, not an object literal: "${JSON.stringify(object)}"`);
  }

  object = { ...object };

  // do not use isEntity() as we might have only a __typename
  if (object.id && object.__typename) {
    const transformResolvers = store.config.transformers[object.__typename]?.data;
    if (transformResolvers) {
      object = transform(object, transformResolvers);
    }
  }

  let normalizedObject = object;

  for (let [propName, propValue] of Object.entries(object)) {
    if (['id', '__typename'].includes(propName)) {
      continue;
    }

    // do not use isEntity() as we might have only a __typename
    if (propValue && propValue.id && propValue.__typename) {
      let entity = propValue; // renaming for readability

      doNormalize(store, entity, () => store.getEntityById(entity.id), callbacks, newEntities, updates);

      propValue = createProxy(entity, store.getEntityById.bind(store));

    } else if (isObjectLiteral(propValue)) {
      propValue = doNormalize(store, propValue, () => getObjectFromStore()?.[propName], callbacks, newEntities, updates);

    } else if (isArray(propValue)) {
      const array = propValue; // renaming for readability

      const onFetchArray = callbacks?.onFetchArrayOfEntities?.(propName, object);

      if (isArrayOfEntities(array) || onFetchArray) {
        array.forEach(entity => {
          doNormalize(store, entity, () => store.getEntityById(entity.id), callbacks, newEntities, updates);
        });

        propValue =
          (onFetchArray !== 'remove')
            ? array.map(entity => createProxy(entity, store.getEntityById.bind(store)))
            : array;

        if (getObjectFromStore()?.[propName]) {
          if (!['append', 'override', 'remove'].includes(onFetchArray)) {
            throw new Error(`specify whether elements in \`${propName}\` must be appended, removed or must override the existing cached array`);
          }

          if (['append', 'remove'].includes(onFetchArray)) {
            switch (onFetchArray) {
              case 'append':
                propValue =
                  getObjectFromStore()[propName]
                    .filter(({ id }) => !array.some(e => e.id === id))
                    .concat(propValue);
                break;

              case 'remove':
                propValue =
                  getObjectFromStore()[propName]
                    .filter(({ id }) => !array.some(e => e.id === id));
                break;
            }
          }
        }
      } else {
        propValue = processArrayRecursively(array, store, () => getObjectFromStore()?.[propName], callbacks, newEntities, updates);
      }
    }

    normalizedObject[propName] = propValue;
  }

  if (isEntity(normalizedObject)) {
    const normalizedEntity = normalizedObject;
    const isNewEntity = !newEntities.byId[normalizedEntity.id];

    if (isNewEntity) {
      newEntities.byId[normalizedEntity.id] = normalizedEntity;
      updates.push({ type: UpdateType.CREATE_ENTITY, entity: normalizedEntity });
    } else {
      for (let [propName, newValue] of Object.entries(normalizedEntity)) {
        if (['id', '__typename'].includes(propName)) {
          continue;
        }

        const oldValue = newEntities.byId[normalizedEntity.id]?.[propName];

        newEntities.byId[normalizedEntity.id] = {
          ...newEntities.byId[normalizedEntity.id],
          [propName]: newValue
        };

        if (oldValue === undefined || !areObjectsEqual({ v: oldValue }, { v: newValue }, { hooks })) {
          updates.push({ type: UpdateType.UPDATE_PROP, entity: normalizedEntity, propName });
        }
      }
    }

    let onFetchEntity = callbacks?.onFetchEntity?.(normalizedEntity);
    if (onFetchEntity) {
      onFetchEntity = [].concat(onFetchEntity);

      onFetchEntity.forEach(update => {
        switch (update.type) {
          case 'update':
            const { entity, propName, updater } = update;

            const oldValue = newEntities.byId[entity.id]?.[propName];
            const nextValue = updater(newEntities.byId[entity.id][propName]);

            newEntities.byId[entity.id] = {
              ...newEntities.byId[entity.id],
              [propName]: nextValue
            };

            if (oldValue === undefined || !areObjectsEqual({ v: oldValue }, { v: nextValue }, { hooks })) {
              updates.push({ type: UpdateType.UPDATE_PROP, entity: newEntities.byId[entity.id], propName });
            }
            break;

          case 'remove':
            const { id } = update;

            const { [id]: deletedEntity, ...entities } = newEntities.byId;
            newEntities.byId = entities;

            updates.push({ type: UpdateType.DELETE_ENTITY, entity: deletedEntity });
            break;
        }
      });
    }
  }

  return normalizedObject;
}

function processArrayRecursively(array, store, getObjectFromStore, callbacks, newEntities, updates) {
  return array.map((element, i) => {
    if (isObjectLiteral(element)) {
      return doNormalize(store, element, () => getObjectFromStore()?.[i], callbacks, newEntities, updates);
    }

    if (isArray(element)) {
      return processArrayRecursively(element, store, () => getObjectFromStore()?.[i], callbacks, newEntities, updates);
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
