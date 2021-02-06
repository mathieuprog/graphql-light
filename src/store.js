import normalizeAndStore from './normalize_and_store';

let entities = {};
let config = {
  transform: entity => entity
};

globalThis.getGraphQLCache = () => entities;

const subscribers = new Set();

function subscribe(subscriber) {
  if (Object.keys(entities).length > 0) {
    subscriber(entities); // Call subscriber with current value
  }

  const item = { subscriber };

  subscribers.add(item); // Subscribe to future values

  return () => { // Return an "unsubscribe" function
    subscribers.delete(item); // Remove the subscription
  };
}

function notifySubscribers() {
  for (const { subscriber } of subscribers) {
    subscriber(entities); // Call all subscriptions
  }
}

function store(denormalizedData) {
  normalizeAndStore(denormalizedData);
  notifySubscribers();
}

function initialize(normalizedData) {
  entities = normalizedData
}

function setEntity(entity) {
  if (entity.__delete) {
    delete entities[entity.id];
    return entity;
  }

  delete entity.__unlink;
  delete entity.__onReplace;

  if (!entities[entity.id]) {
    entities[entity.id] = entity;
    return entity;
  }

  for (let [propName, propValue] of Object.entries(entity)) {
    entities[entity.id][propName] = propValue;
  }

  return entity;
}

function setConfig(newConfig) {
  config = { ...config, ...newConfig };
}

function getConfig() {
  return config;
}

function getEntityById(id) {
  return entities[id];
}

function getEntities() {
  return entities;
}

export default {
  subscribe,
  store,
  initialize,
  getEntityById,
  getEntities,
  setEntity,
  getConfig,
  setConfig
}
