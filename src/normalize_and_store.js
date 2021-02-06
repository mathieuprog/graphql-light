import createProxy from './create_proxy';
import store from './store';
import { isArray, isEntity, isObjectLiteral } from './utils';

export default function normalizeAndStore(entities) {
  [].concat(entities).forEach(entity => {
    doNormalizeAndStore(entity, () => store.getEntityById(entity.id));
  });
}

function doNormalizeAndStore(object, getObjectFromStore) {
  const objectIsEntity = isEntity(object);

  if (objectIsEntity) {
    object = store.getConfig().transform(object);
  }

  for (let [propName, propValue] of Object.entries(object)) {
    if (['__unlink', '__delete', '__onReplace', 'id', '__typename'].includes(propName)) {
      continue;
    }

    let newPropValue = propValue;

    if (isEntity(propValue)) {
      let entity = propValue; // renaming for readability

      doNormalizeAndStore(entity, () => getObjectFromStore?.()?.[propName]);

      newPropValue = createProxy(entity, store.getEntityById);

    } else if (isObjectLiteral(propValue)) {
      newPropValue = doNormalizeAndStore(propValue, () => getObjectFromStore?.()?.[propName]);

    } else if (isArray(propValue)) {
      const array = propValue; // renaming for readability

      const isArrayOfEntities = isEntity(array[0]) || (array.length === 0 && object['__onReplace']);

      if (isArrayOfEntities) {
        const onReplace = object['__onReplace'];
        if (!onReplace?.[propName] || !['override', 'append'].includes(onReplace[propName])) {
          throw new Error(`no or invalid \`__onReplace\` option for property \`${propName}\``);
        }

        const toRemove = array.filter(entity => entity.__unlink || entity.__delete).map(({ id }) => id);
        const toAdd = array.filter(({ id }) => !toRemove.includes(id)).map(({ id }) => id);

        newPropValue =
          array
            .map(entity => doNormalizeAndStore(entity, () => getObjectFromStore?.()?.[propName]))
            .filter(entity => !toRemove.includes(entity.id))
            .map(entity => createProxy(entity, store.getEntityById));

        if (onReplace[propName] !== 'override' && getObjectFromStore?.()?.[propName]) {
          newPropValue =
            getObjectFromStore()[propName]
              .filter(({ id }) => !toAdd.includes(id) && !toRemove.includes(id))
              .concat(newPropValue);
        }
      } else {
        const isArrayOfObjectLiterals = array.length > 0 && isObjectLiteral(array[0]);
        const isArrayOfArrays = array.length > 0 && isArray(array[0]);

        if (isArrayOfObjectLiterals || isArrayOfArrays) {
          newPropValue =
            array.map((element, i) =>
              doNormalizeAndStore(element, () => getObjectFromStore()?.[propName]?.[i]));
        }
      }
    }

    object[propName] = newPropValue;
  }

  if (objectIsEntity) {
    object = store.setEntity(object);
  }

  return object;
}
