import UpdateType from './UpdateType';
import {
  isArray,
  isArrayOfEntities,
  isEntity,
  isNullOrUndefined,
  isObjectLiteral,
  unique
} from './utils';

export default function refreshDenormalizedData(entities, denormalizedData) {
  let updatesToListenTo = [];

  denormalizedData = doRefresh(entities, denormalizedData, updatesToListenTo);

  updatesToListenTo = unique(updatesToListenTo);

  return { denormalizedData, updatesToListenTo };
}

function doRefresh(entities, data, updatesToListenTo, getDataFromStore = null) {
  if (isNullOrUndefined(data)) {
    return null;
  }

  if (isObjectLiteral(data)) {
    let object = { ...data };

    const isEntity_ = isEntity(object);

    if (isEntity_) {
      const cachedEntity =
        (getDataFromStore !== null)
          ? getDataFromStore() // nested entity
          : entities[object.id];

      if (!cachedEntity) {
        return null;
      }

      getDataFromStore = () => cachedEntity;
    }

    for (let [propName, propValue] of Object.entries(object)) {
      object[propName] = doRefresh(entities, propValue, updatesToListenTo, () => getDataFromStore()?.[propName]);
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

    if (getDataFromStore === null) {
      if (isArrayOfEntities(array)) {
        return array.map(entity => doRefresh(entities, entity, updatesToListenTo, () => entities[entity.id]));
      }

      return array.map(element => doRefresh(entities, element, updatesToListenTo));
    }

    // nested array
    if (isArrayOfEntities(array)) {
      return array
        .filter(entity => getDataFromStore().some(cachedEntity => cachedEntity.id === entity.id))
        .map(entity => doRefresh(entities, entity, updatesToListenTo, () => getDataFromStore().find(cachedEntity => cachedEntity.id === entity.id)));
    } else {
      return array.map((element, i) => doRefresh(entities, element, updatesToListenTo, () => getDataFromStore()?.[i]));
    }
  }

  return getDataFromStore ? getDataFromStore() : data;
}
