import normalize from './middleware/normalize';
import updateLinks from './middleware/updateLinks';
import refreshDenormalizedData from './middleware/refreshDenormalizedData';
import notifySubscribers from './middleware/notifySubscribers';
import { isObjectSubset } from '../utils';
import { pipe, pipefy } from 'pipe-pipefy';

export default class Store {
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

  store(denormalizedData, callbacks = {}) {
    let updates, updatesToListenTo;
    ({
      denormalizedData,
      updates,
      updatesToListenTo
    } =
      pipe(
        pipefy(normalize, this, callbacks),
        pipefy(updateLinks, this),
        pipefy(refreshDenormalizedData, this),
        pipefy(notifySubscribers, this),
      )({ denormalizedData }));

    return {
      denormalizedData,
      updates,
      updatesToListenTo
    };
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
