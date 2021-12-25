import normalizeAndStore from './normalizeAndStore';

const isObjectSubset = (superObject, subObject) => {
  return Object.keys(subObject).every(key => {
      if (typeof subObject[key] === 'object') {
          return typeof superObject[key] === 'object' 
            && isObjectSubset(superObject[key], subObject[key]);
      }
      return subObject[key] === superObject[key];
  });
};

class Store {
  allEntities = {};
  subscribers = new Set();
  config = { transformers: {} };

  subscribe(subscriber) {
    if (Object.keys(this.allEntities).length > 0) {
      subscriber(this.allEntities); // Call subscriber with current value
    }

    const item = { subscriber };

    this.subscribers.add(item); // Subscribe to future values

    return () => { // Return an "unsubscribe" function
      this.subscribers.delete(item); // Remove the subscription
    };
  }

  notifySubscribers() {
    for (const { subscriber } of this.subscribers) {
      subscriber(this.allEntities); // Call all subscriptions
    }
  }

  store(denormalizedData) {
    normalizeAndStore(denormalizedData);
    this.notifySubscribers();
  }

  initialize(normalizedData) {
    this.allEntities = normalizedData
  }

  setEntity(entity) {
    if (entity.__delete) {
      delete this.allEntities[entity.id];
      return entity;
    }

    delete entity.__unlink;
    delete entity.__onReplace;

    if (!this.allEntities[entity.id]) {
      this.allEntities[entity.id] = entity;
      return entity;
    }

    for (let [propName, propValue] of Object.entries(entity)) {
      this.allEntities[entity.id][propName] = propValue;
    }

    return entity;
  }

  setConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig() {
    return this.config;
  }

  getEntities() {
    return this.allEntities;
  }

  getEntityById(id, entities) {
    entities = entities || this.allEntities;

    return entities[id];
  }

  getEntitiesByType(type, entities) {
    entities = entities || this.allEntities;

    return this.filterEntities({ __typename: type }, entities);
  }

  filterEntities(filterObject, entities) {
    entities = entities || this.allEntities;

    return Object.keys(entities).reduce((filteredEntities, key) => {
      return isObjectSubset(entities[key], filterObject)
        ? filteredEntities = { ...filteredEntities, [key]: entities[key] }
        : filteredEntities;
    }, {});
  }

  countEntities(entities) {
    entities = entities || this.allEntities;

    return Object.keys(entities).length;
  }

  asList(entities) {
    entities = entities || this.allEntities;

    return Object.values(entities);
  }

  one(entities) {
    const list = this.asList(entities);
    if (list.length !== 1) {
      throw new Error(`more than one entry: ${JSON.stringify(entities)}`);
    }

    return list[0];
  }

  getGraphQLCache(filterObject) {
    if (!filterObject) {
      return this.allEntities;
    }
  
    return this.filterEntities(filterObject, this.allEntities);
  }
}

const store = new Store();

globalThis.store = store;

export default store;
