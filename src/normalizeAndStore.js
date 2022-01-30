import createProxy from './createProxy';
import { isArray, isArrayOfEntities, isEntity, isObjectLiteral } from './utils';

export default function normalizeAndStore(store, data) {
  [].concat(data).forEach(entity =>
    doNormalizeAndStore(store, entity, () => store.getEntityById(entity.id)));
}

// `getObjectFromStore` argument is used for appending to an array of entities from nested object literals/arrays.
function doNormalizeAndStore(store, object, getObjectFromStore) {
  if (!isObjectLiteral(object)) {
    throw new Error(`unexpected condition, not an object literal: "${JSON.stringify(object)}"`);
  }

  let normalizedObject = { ...object };

  for (let [propName, propValue] of Object.entries(object)) {
    if (['__unlink', '__delete', '__onReplace', 'id', '__typename'].includes(propName)) {
      continue;
    }

    let newPropValue = propValue;

    if (isEntity(propValue)) {
      let entity = propValue; // renaming for readability

      doNormalizeAndStore(store, entity, () => store.getEntityById(entity.id));

      newPropValue = createProxy(entity, store.getEntityById.bind(store));

    } else if (isObjectLiteral(propValue)) {
      newPropValue = doNormalizeAndStore(store, propValue, () => getObjectFromStore()?.[propName]);

    } else if (isArray(propValue)) {
      const array = propValue; // renaming for readability

      if (isArrayOfEntities(array) || (array.length === 0 && object['__onReplace']?.[propName])) {
        const onReplace = object['__onReplace'];
        if (onReplace?.[propName] && !['override', 'append'].includes(onReplace[propName])) {
          throw new Error(`no or invalid \`__onReplace\` option for property \`${propName}\``);
        }
        const append = !!onReplace?.[propName] && onReplace[propName] === 'append';

        const toRemove = array.filter(entity => entity.__unlink || entity.__delete).map(({ id }) => id);
        const toAdd = array.filter(({ id }) => !toRemove.includes(id)).map(({ id }) => id);

        newPropValue =
          array
            .map(entity => doNormalizeAndStore(store, entity, () => store.getEntityById(entity.id)))
            .filter(entity => !toRemove.includes(entity.id))
            .map(entity => createProxy(entity, store.getEntityById.bind(store)));

        if (append && getObjectFromStore()?.[propName]) {
          newPropValue =
            getObjectFromStore()[propName]
              .filter(({ id }) => !toAdd.includes(id) && !toRemove.includes(id))
              .concat(newPropValue);
        }
      } else {
        newPropValue = processArrayRecursively(array, store, () => getObjectFromStore()?.[propName]);
      }
    }

    normalizedObject[propName] = newPropValue;
  }

  if (isEntity(normalizedObject)) {
    const entity = normalizedObject;

    if (entity.__delete) {
      delete store.entities[entity.id];
      return entity;
    }

    delete entity.__unlink;
    delete entity.__onReplace;

    if (!store.entities[entity.id]) {
      store.entities[entity.id] = entity;
      return entity;
    }

    for (let [propName, propValue] of Object.entries(entity)) {
      store.entities[entity.id][propName] = propValue;
    }
  }

  return normalizedObject;
}

function processArrayRecursively(array, store, getObjectFromStore) {
  return array.map((element, i) => {
    return isObjectLiteral(element)
      ? doNormalizeAndStore(store, element, () => getObjectFromStore()?.[i])
      : (
        isArray(element)
        ? processArrayRecursively(element, store, () => getObjectFromStore()?.[i])
        : element
      );
  });
}
