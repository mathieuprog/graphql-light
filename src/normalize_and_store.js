import { isArray, isEntity, isObjectLiteral } from './utils';
import createProxy from './create_proxy';

export default function normalizeAndStore(store, entities) {
  store = store || {};

  [].concat(entities).forEach(entity => {
    storeEntity(store, doNormalizeAndStore(store, entity, () => store[entity.id]));
  });

  return entities;
}

function storeEntity(store, entity) {
  if (entity.__delete) {
    delete store[entity.id];
    return;
  }

  if (!store[entity.id]) {
    store[entity.id] = entity;
    return;
  }

  for (let [propName, propValue] of Object.entries(entity)) {
    if (['__unlink', '__delete', '__onReplace'].includes(propName)) {
      continue;
    }

    store[entity.id][propName] = propValue;
  }
}

function doNormalizeAndStore(store, object, getObjectFromStore) {
  for (let [propName, propValue] of Object.entries(object)) {
    if (['__unlink', '__delete', '__onReplace', 'id', '__typename'].includes(propName)) {
      continue;
    }

    let newPropValue = propValue;

    if (isEntity(propValue)) {
      const entity = propValue; // renaming for readability

      storeEntity(store, doNormalizeAndStore(store, entity, () => getObjectFromStore()[propName]));

      newPropValue = createProxy(entity, id => store[id]);

    } else if (isObjectLiteral(propValue)) {
      newPropValue = doNormalizeAndStore(store, propValue, () => getObjectFromStore()[propName]);

    } else if (isArray(propValue)) {
      const array = propValue; // renaming for readability

      const isArrayOfEntities = (array.length === 0 && object['__onReplace']) || isEntity(array[0]);

      if (isArrayOfEntities) {
        const onReplace = object['__onReplace'];
        if (!onReplace?.[propName] || !['override', 'append'].includes(onReplace[propName])) {
          throw new Error(`no or invalid \`__onReplace\` option for property \`${propName}\``);
        }

        newPropValue =
          array
            .map(entity => {
              storeEntity(store, doNormalizeAndStore(store, entity, () => getObjectFromStore()[propName]));

              if (!entity.__unlink && !entity.__delete) {
                return createProxy(entity, id => store[id]);
              }
            })
            .filter(entity => entity);

        if (onReplace[propName] !== 'override' && getObjectFromStore()[propName]) {
          newPropValue =
            getObjectFromStore()[propName]
              .filter(storedEntity => {
                return !newPropValue.some(entity => entity.id === storedEntity.id)
                    && !array.some(entity => entity.id === storedEntity.id && (entity.__unlink || entity.__delete))
              })
              .concat(newPropValue);
        }
      } else {
        const isArrayOfObjectLiterals = array.length > 0 && isObjectLiteral(array[0]);
        const isArrayOfArrays = array.length > 0 && isArray(array[0]);

        if (isArrayOfObjectLiterals || isArrayOfArrays) {
          newPropValue =
            array.map((element, i) =>
              doNormalizeAndStore(store, element, () => getObjectFromStore()[propName][i]));
        }
      }
    }

    object[propName] = newPropValue;
  }

  return object;
}
