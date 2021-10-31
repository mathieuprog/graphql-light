import normalizeAndStore from './normalize_and_store';

let allEntities = {};
let config = {
  transformers: {}
};

const isObjectSubset = (superObject, subObject) => {
  return Object.keys(subObject).every(key => {
      if (typeof subObject[key] === 'object') {
          return typeof superObject[key] === 'object' 
            && isObjectSubset(superObject[key], subObject[key]);
      }
      return subObject[key] === superObject[key];
  });
};

globalThis.getGraphQLCache = filterObject => {
  if (!filterObject) {
    return allEntities;
  }

  return filterEntities(filterObject, allEntities);
};

const subscribers = new Set();

function subscribe(subscriber) {
  if (Object.keys(allEntities).length > 0) {
    subscriber(allEntities); // Call subscriber with current value
  }

  const item = { subscriber };

  subscribers.add(item); // Subscribe to future values

  return () => { // Return an "unsubscribe" function
    subscribers.delete(item); // Remove the subscription
  };
}

function notifySubscribers() {
  for (const { subscriber } of subscribers) {
    subscriber(allEntities); // Call all subscriptions
  }
}

function store(denormalizedData) {
  normalizeAndStore(denormalizedData);
  notifySubscribers();
}

function initialize(normalizedData) {
  allEntities = normalizedData
}

function setEntity(entity) {
  if (entity.__delete) {
    delete allEntities[entity.id];
    return entity;
  }

  delete entity.__unlink;
  delete entity.__onReplace;

  if (!allEntities[entity.id]) {
    allEntities[entity.id] = entity;
    return entity;
  }

  for (let [propName, propValue] of Object.entries(entity)) {
    allEntities[entity.id][propName] = propValue;
  }

  return entity;
}

function setConfig(newConfig) {
  config = { ...config, ...newConfig };
}

function getConfig() {
  return config;
}

function getEntities() {
  return allEntities;
}

function getEntityById(id, entities = allEntities) {
  return entities[id];
}

function getEntitiesByType(type, entities = allEntities) {
  return filterEntities({ __typename: type }, entities);
}

function filterEntities(filterObject, entities = allEntities) {
  return Object.keys(entities).reduce((filteredEntities, key) => {
    return isObjectSubset(entities[key], filterObject)
      ? filteredEntities = { ...filteredEntities, [key]: entities[key] }
      : filteredEntities;
  }, {});
}

function countEntities(entities = allEntities) {
  return Object.keys(entities).length;
}

function asList(entities = allEntities) {
  return Object.values(entities);
}

function one(entities) {
  const list = asList(entities);
  if (list.length !== 1) {
    throw new Error(`more than one entry: ${JSON.stringify(entities)}`);
  }

  return list[0];
}

export default {
  countEntities,
  filterEntities,
  getConfig,
  getEntitiesByType,
  getEntities,
  getEntityById,
  initialize,
  one,
  setConfig,
  setEntity,
  store,
  subscribe
}
