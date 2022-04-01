import UpdateType from '../../constants/UpdateType';
import {
  isArray,
  isArrayOfEntities,
  isArrayOfPrimitives,
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

function doRefresh(entities, data, updatesToListenTo, parentEntity = null, getDataFromStore = null) {
  if (isNullOrUndefined(data)) {
    return null;
  }

  if (isEntityProxy(data)) {
    if (!parentEntity) {
      throw new Error();
    }

    const cachedProxy = getDataFromStore();

    if (cachedProxy === null) {
      return null;
    }

    if (!isEntityProxy(cachedProxy)) {
      throw new Error();
    }

    return cachedProxy;
  }

  if (isObjectLiteral(data)) {
    let object = { ...data };

    const isEntity_ = isEntity(object);

    if (isEntity_) {
      let cachedEntity;
      if (parentEntity) {
        const cachedProxy = getDataFromStore();

        if (cachedProxy === null) {
          return null;
        }

        if (!isEntityProxy(cachedProxy)) {
          throw new Error();
        }

        cachedEntity = entities[cachedProxy.id];
      } else {
        cachedEntity = entities[object.id];

        if (!cachedEntity) {
          return null;
        }
      }

      getDataFromStore = () => cachedEntity;
      parentEntity = cachedEntity;
    }

    for (let [propName, propValue] of Object.entries(object)) {
      object[propName] =
        doRefresh(entities, propValue, updatesToListenTo, parentEntity, (parentEntity) ? (() => getDataFromStore()[propName]) : null);
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

    if (!parentEntity) {
      if (isArrayOfEntities(array)) {
        return array.map(entity => doRefresh(entities, entity, updatesToListenTo));
      }

      return array.map(element => doRefresh(entities, element, updatesToListenTo));
    }

    if (isArrayOfEntities(array)) {
      return array
        .filter(entity => getDataFromStore().some(cachedEntity => cachedEntity.id === entity.id))
        .map(entity => doRefresh(entities, entity, updatesToListenTo, parentEntity, () => getDataFromStore().find(cachedEntity => cachedEntity.id === entity.id)));
    } else {
      const cachedArray = getDataFromStore();
      if (!isArray(cachedArray)) {
        throw new Error();
      }

      if (isArrayOfPrimitives(array)) { // it can be a list of IDs that must be updated as an entity may have been deleted
        return array.filter(element => cachedArray.includes(element));
      }

      return array.map((element, i) => doRefresh(entities, element, updatesToListenTo, parentEntity, () => getDataFromStore()[i]));
    }
  }

  if (!getDataFromStore) {
    return data;
  }

  const dataFromStore = getDataFromStore();

  if (dataFromStore === undefined) {
    throw new Error();
  }

  return dataFromStore;
}
