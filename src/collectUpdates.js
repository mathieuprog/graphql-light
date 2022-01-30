import {
  areArraysEqual,
  areObjectsEqual,
  hasObjectProp,
  isArray,
  isArrayOfEntities,
  isEntity,
  isObjectInstance,
  isObjectLiteral
} from './utils';
import UpdateType from './UpdateType';

export default function collectUpdates(getCachedEntityById, elements) {
  const updates = [];
  const updatesToListenTo = [];

  doCollectUpdates(getCachedEntityById, elements, updates, updatesToListenTo);

  return {
    updates: unique(updates),
    updatesToListenTo: unique(updatesToListenTo)
  };
}

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

function hookOnCompareObjects(a, b) {
  if (isEntity(a) !== isEntity(b)) return { ne: true };

  if (isEntity(a)) {
    return {
      eq: a.id === b.id,
      ne: a.id !== b.id
    };
  }
}

function hookOnCompareObjectProps(object, propName, propValueA, propValueB) {
  if (isArrayOfEntities(propValueA) || isArrayOfEntities(propValueB) || object['__onReplace']?.[propName]) {
    const onReplace = object['__onReplace'];
    if (onReplace?.[propName] && !['override', 'append'].includes(onReplace[propName])) {
      throw new Error(`no or invalid \`__onReplace\` option for property \`${propName}\``);
    }
    const append = !!onReplace?.[propName] && onReplace[propName] === 'append';

    const hooks = {
      onCompareArrays: getHookOnCompareArrays(append)
    };
    if (!areArraysEqual(value, b[key], { hooks, ignoreProps: ['__unlink', '__delete', '__onReplace'] })) {
      return { ne: true };
    }

    return { eq: true };
  }
}

function getHookOnCompareArrays(appendOnArrayOfEntities) {
  const includesEntity = (array) => ({ id }) => array.some(e => e.id === id);

  return (a, b) => {
    if (isArrayOfEntities(a) || isArrayOfEntities(b)) {
      const cachedArray = a;
      if (cachedArray.some(e => e.__unlink || e.__delete)) {
        throw new Error('not expecting __unlink or __delete prop in cached entity');
      }
      const newArray = b.filter(e => !e.__unlink && !e.__delete);
      const unlinkArray = b.filter(e => e.__unlink || e.__delete);

      if (appendOnArrayOfEntities) {
        if (cachedArray.some(includesEntity(unlinkArray))) {
          return { ne: true };
        }

        if (!newArray.every(includesEntity(cachedArray))) {
          return { ne: true };
        }

        return { eq: true };
      } else {
        if (a.length !== b.length) return { ne: true };

        for (let entityA of a) {
          const index = b.findIndex(entityB => entityA.id === entityB.id);
          if (index === -1) return { ne: true };
          b.splice(index, 1);
        }

        return { eq: true };
      }
    }
  }
}

function doCollectUpdates(getCachedEntityById, elements, updates, updatesToListenTo, ancestorDeleted = false) {
  elements = [].concat(elements);

  elements.forEach(element => {
    if (isEntity(element)) {
      const entity = element;
      const cachedEntity = getCachedEntityById(entity.id);
      let isCreateUpdate = false;

      if (entity.__delete && cachedEntity) {
        updates.push({ type: UpdateType.DELETE_ENTITY, entity });
      }

      if (!entity.__delete && !cachedEntity) {
        isCreateUpdate = true;
        updates.push({ type: UpdateType.CREATE_ENTITY, entity });
      }

      const removed = ancestorDeleted || entity.__delete || entity.__unlink;

      if (!removed) {
        updatesToListenTo.push({ type: UpdateType.DELETE_ENTITY, entity: { id: entity.id } });
      }

      for (let [propName, propValue] of Object.entries(entity)) {
        if (['__unlink', '__delete', '__onReplace', 'id', '__typename'].includes(propName)) {
          continue;
        }

        if (!removed) {
          updatesToListenTo.push({ type: UpdateType.UPDATE_PROP, entity: { id: entity.id }, propName });
        }

        const isCachedProp = cachedEntity && hasObjectProp(cachedEntity, propName);

        if (!isCreateUpdate && !isCachedProp) {
          updates.push({ type: UpdateType.UPDATE_PROP, entity, propName });
        }

        if (isEntity(propValue)) {
          if (isCachedProp && cachedEntity[propName].id !== propValue.id) {
            updates.push({ type: UpdateType.UPDATE_PROP, entity, propName });
          }

          doCollectUpdates(getCachedEntityById, propValue, updates, updatesToListenTo, removed);
          continue;
        }

        if (isObjectLiteral(propValue)) {
          if (isCachedProp) {
            const hooks = {
              onCompareObjects: hookOnCompareObjects,
              onCompareObjectProps: hookOnCompareObjectProps
            };
            if (!areObjectsEqual(cachedEntity[propName], propValue, { hooks, ignoreProps: ['__unlink', '__delete', '__onReplace'] })) {
              updates.push({ type: UpdateType.UPDATE_PROP, entity, propName });
            }
          }

          doCollectUpdates(getCachedEntityById, propValue, updates, updatesToListenTo, removed);
          continue;
        }

        if (isArrayOfEntities(propValue) || (propValue.length === 0 && entity['__onReplace']?.[propName])) {
          if (isCachedProp) {
            const onReplace = entity['__onReplace'];
            if (onReplace?.[propName] && !['override', 'append'].includes(onReplace[propName])) {
              throw new Error(`no or invalid \`__onReplace\` option for property \`${propName}\``);
            }
            const append = !!onReplace?.[propName] && onReplace[propName] === 'append';

            const hookOnCompareArrays = getHookOnCompareArrays(append);

            const hooks = {
              onCompareArrays: hookOnCompareArrays,
              onCompareObjects: hookOnCompareObjects,
              onCompareObjectProps: hookOnCompareObjectProps
            };
            if (!areArraysEqual(cachedEntity[propName], propValue, { hooks, ignoreProps: ['__unlink', '__delete', '__onReplace'] })) {
              updates.push({ type: UpdateType.UPDATE_PROP, entity, propName });
            }
          }

          propValue.forEach(element => {
            doCollectUpdates(getCachedEntityById, element, updates, updatesToListenTo, removed);
          });
          continue;
        }

        if (isArray(propValue)) {
          if (isCachedProp) {
            const hooks = {
              onCompareObjects: hookOnCompareObjects,
              onCompareObjectProps: hookOnCompareObjectProps
            };
            if (!areArraysEqual(cachedEntity[propName], propValue, { hooks, ignoreProps: ['__unlink', '__delete', '__onReplace'] })) {
              updates.push({ type: UpdateType.UPDATE_PROP, entity, propName });
            }
          }

          doCollectUpdates(getCachedEntityById, propValue, updates, updatesToListenTo, removed);
          continue;
        }

        if (isObjectInstance(propValue)) {
          if (isCachedProp && cachedEntity[propName].toString() !== propValue.toString()) {
            updates.push({ type: UpdateType.UPDATE_PROP, entity, propName });
          }

          continue;
        }

        if (isCachedProp && cachedEntity[propName] !== propValue) {
          updates.push({ type: UpdateType.UPDATE_PROP, entity, propName });
        }
      }
    } else if (isObjectLiteral(element)) {
      element = { ...element };
      for (let [_propName, propValue] of Object.entries(element)) {
        doCollectUpdates(getCachedEntityById, propValue, updates, updatesToListenTo, ancestorDeleted);
      }
    } else if (isArray(element)) {
      element = [ ...element ];
      element.forEach((item, i) => {
        doCollectUpdates(getCachedEntityById, item, updates, updatesToListenTo, ancestorDeleted);
      });
    }
  });

  return { updates, updatesToListenTo };
}
