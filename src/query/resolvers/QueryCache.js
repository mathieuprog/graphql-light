import {
  isArray,
  isArrayOfEntities,
  isArrayOfEntityProxies,
  isEntity,
  isEntityProxy,
  isNullOrUndefined,
  isObjectLiteral
} from '../../utils';
import store from '../../store';

export default class QueryCache {
  constructor(data) {
    this.data = data;
  }

  get() {
    return this.data;
  }

  set(data) {
    this.data = data;
  }

  applyUpdate(update) {
    if (isEntity(this.data) && this.data.id === update.entity.id && update.type === 'DELETE_ENTITY') {
      this.data = null;
    } else {
      this.data = this.doApplyUpdate(this.data, update);
    }
  }

  doApplyUpdate(data, update) {
    if (isObjectLiteral(data)) {
      if (isEntityProxy(data)) {
        throw new Error();
      }

      data = { ...data };

      if (isEntity(data) && data.id === update.entity.id && update.type === 'UPDATE_PROP') {
        data[update.propName] = update.entity[update.propName];
      }

      for (let [propName, propValue] of Object.entries(data)) {
        if (isEntity(propValue) && propValue.id === update.entity.id && update.type === 'DELETE_ENTITY') {
          delete data[propName];
        } else {
          data[propName] = this.doApplyUpdate(propValue, update);
        }
      }
    } else if (isArray(data)) {
      if (isArrayOfEntityProxies(data)) {
        throw new Error();
      }

      data = [...data];

      this.cleanArray(data, update);

      data = data.map(element => this.doApplyUpdate(element, update));
    }

    return data;
  }

  cleanArray(array, update) {
    const index = array.findIndex(element =>
      isEntity(element) && element.id === update.entity.id && update.type === 'DELETE_ENTITY');

    if (index === -1) {
      return;
    }

    array.splice(index, 1);

    this.cleanArray(array, update);
  }

  refresh() {
    this.data = this.doRefresh(this.data);
    return this.data;
  }

  doRefresh(data, getDataFromStore = null) {
    if (isNullOrUndefined(data)) {
      return null;
    }

    if (isObjectLiteral(data)) {
      let object = { ...data };

      if (isEntity(object)) {
        const cachedEntity =
          (getDataFromStore !== null)
            ? getDataFromStore() // nested entity
            : store.getEntityById(object.id);

        if (!cachedEntity) {
          return null;
        }

        getDataFromStore = () => cachedEntity;
      }

      for (let [propName, propValue] of Object.entries(object)) {
        object[propName] = this.doRefresh(propValue, () => getDataFromStore()?.[propName]);
      }

      return object;
    }

    if (isArray(data)) {
      let array = data;

      if (getDataFromStore === null) {
        if (isArrayOfEntities(array)) {
          return array.map(entity => this.doRefresh(entity, () => store.getEntityById(entity.id)));
        }

        return array.map(element => this.doRefresh(element));
      }

      // nested array
      if (isArrayOfEntities(array)) {
        return array
          .filter(entity => getDataFromStore().some(cachedEntity => cachedEntity.id === entity.id))
          .map(entity => this.doRefresh(entity, () => getDataFromStore().find(cachedEntity => cachedEntity.id === entity.id)));
      } else {
        return getDataFromStore();
      }
    }

    return getDataFromStore ? getDataFromStore() : data;
  }
}
