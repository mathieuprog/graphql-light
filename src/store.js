import normalizeAndStore from './normalize_and_store';

let entities;

globalThis.graphQLCache = {
  entities() { return entities }
};

const subscribers = new Set();

const store = {
  subscribe(subscriber) {
    if (entities) {
      subscriber(entities); // Call subscriber with current value
    }

    const item = { subscriber };

    subscribers.add(item); // Subscribe to future values

    return () => { // Return an "unsubscribe" function
      subscribers.delete(item); // Remove the subscription
    };
  },
  set(denormalizedData) {
    entities = normalizeAndStore(entities, denormalizedData);

    for (const { subscriber } of subscribers) {
      subscriber(entities); // Call all subscriptions
    }
  }
};

export function getEntityById(id) {
  return entities[id];
}

export default store;
