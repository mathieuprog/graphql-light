import UpdateType from '../../constants/UpdateType';
import {
  isArray,
  isArrayOfEntities,
  isEntity,
  isEntityProxy,
  isNullOrUndefined,
  isObjectLiteral,
  unique
} from '../../utils';

export default function refreshDenormalizedData(result, store) {
  let { denormalizedData } = result;

  let updatesToListenTo = [];

  denormalizedData = doRefresh(store.entities, denormalizedData, updatesToListenTo);

  updatesToListenTo = unique(updatesToListenTo);

  return { ...result, denormalizedData, updatesToListenTo };
}

function doRefresh(entities, data, updatesToListenTo, nestedEntity = false, getDataFromStore = null) {
  if (isNullOrUndefined(data)) {
    return null;
  }

  if (isEntityProxy(data)) {
    return data;
  }

  if (isObjectLiteral(data)) {
    let object = { ...data };

    const isEntity_ = isEntity(object);

    if (isEntity_) {
      // nested entity, it might have changed ID
      const cachedEntity = (nestedEntity) ? getDataFromStore() : entities[object.id];

      if (!cachedEntity) {
        return null;
      }

      getDataFromStore = () => cachedEntity;
      nestedEntity = true;
    }

    for (let [propName, propValue] of Object.entries(object)) {
      object[propName] = doRefresh(entities, propValue, updatesToListenTo, nestedEntity, () => getDataFromStore?.()?.[propName]);
    }

    if (isEntity_) {
      for (let [propName, _propValue] of Object.entries(object)) {
        if (['id', '__typename'].includes(propName)) {
          continue;
        }
        updatesToListenTo.push({ type: UpdateType.UPDATE_PROP, entity: { id: object.id }, propName });
      }

      updatesToListenTo.push({ type: UpdateType.DELETE_ENTITY, entity: { id: object.id } });
    }

    return object;
  }

  if (isArray(data)) {
    let array = data;

    if (!nestedEntity) {
      if (isArrayOfEntities(array)) {
        return array.map(entity => doRefresh(entities, entity, updatesToListenTo));
      }

      return array.map(element => doRefresh(entities, element, updatesToListenTo));
    }

    // nested array
    if (isArrayOfEntities(array)) {
      return array
        .filter(entity => getDataFromStore().some(cachedEntity => cachedEntity.id === entity.id))
        .map(entity => doRefresh(entities, entity, updatesToListenTo, true, () => getDataFromStore().find(cachedEntity => cachedEntity.id === entity.id)));
    } else {
      return array.map((element, i) => doRefresh(entities, element, updatesToListenTo, true, () => getDataFromStore()?.[i]));
    }
  }

  return getDataFromStore ? getDataFromStore() : data;
}
