import normalizeAndStore from './normalizeAndStore';
import refreshDenormalizedData from './refreshDenormalizedData';
import updateLinks from './updateLinks';
import { isObjectSubset } from './utils';

class Store {
  constructor() {
    this.initialize();
  }

  initialize() {
    this.entities = {};
    this.links = {};
    this.initializedAt = new Date();
    this.subscribers = new Set();
    this.config = { transformers: {} };
  }

  subscribe(subscriber) {
    const item = { subscriber };

    this.subscribers.add(item); // Subscribe to future values

    return () => { // Return an "unsubscribe" function
      this.subscribers.delete(item); // Remove the subscription
    };
  }

  notifySubscribers(updates) {
    for (const { subscriber } of this.subscribers) {
      subscriber(updates); // Call all subscriptions
    }
  }

  store(denormalizedData, callbacks = {}) {
    let { entities, updates } = normalizeAndStore(this, denormalizedData, callbacks);
    this.entities = entities;

    const { entities: entities_, links, updates: _updates } = updateLinks(entities, this.links, updates);
    entities = entities_;
    updates = _updates;
    this.entities = entities;
    this.links = links;

    const { denormalizedData: denormalizedData_, updatesToListenTo } = refreshDenormalizedData(this.entities, denormalizedData);
    denormalizedData = denormalizedData_;

    if (updates.length > 0) {
      this.notifySubscribers(updates);
    }

    return { updatesToListenTo, updates, denormalizedData };
  }

  setConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig() {
    return this.config;
  }

  getEntities() {
    return this.entities;
  }

  getEntityById(id, entities) {
    entities = entities || this.entities;

    return entities[id];
  }

  getEntitiesByType(type, entities) {
    entities = entities || this.entities;

    return this.filterEntities({ __typename: type }, entities);
  }

  filterEntities(filterObject, entities) {
    entities = entities || this.entities;

    return Object.keys(entities).reduce((filteredEntities, key) => {
      return isObjectSubset(entities[key], filterObject)
        ? filteredEntities = { ...filteredEntities, [key]: entities[key] }
        : filteredEntities;
    }, {});
  }

  countEntities(entities) {
    entities = entities || this.entities;

    return Object.keys(entities).length;
  }

  getSingleEntity(entities) {
    entities = entities || this.entities;

    const list = Object.values(entities);
    if (list.length !== 1) {
      throw new Error(`more than one entry: ${JSON.stringify(entities)}`);
    }

    return list[0];
  }
}

const store = new Store();

globalThis.store = store;

export default store;
