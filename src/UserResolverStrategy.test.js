import OnUnobservedStrategy from './OnUnobservedStrategy';
import Query from './Query';
import UpdateType from './UpdateType';
import { jest } from '@jest/globals';

function deepFreeze(obj) {
  Object.keys(obj).forEach(prop => {
    if (typeof obj[prop] === 'object' && !Object.isFrozen(obj[prop])) {
      deepFreeze(obj[prop]);
    }
  });

  return Object.freeze(obj);
}

const denormalizedData = deepFreeze({
  id: 'person1',
  __typename: 'Person',
  name: 'Mathieu',
  test: [[1, 2]],
  articles: [[{ foo: [[
    {
      __onReplace: { articles: 'append' },
      articles: [
        {
          id: 'article1',
          __typename: 'Article',
          title: 'Foo',
          tags: [
            {
              id: 'tag1',
              __typename: 'Tag',
              label: 'foo'
            },
            {
              id: 'tag3',
              __typename: 'Tag',
              label: 'foobar'
            },
          ],
          __onReplace: { tags: 'override' },
        },
        {
          id: 'article2',
          __typename: 'Article',
          title: 'Bar',
          tags: [
            {
              id: 'tag2',
              __typename: 'Tag',
              label: 'foo'
            },
            {
              id: 'tag3',
              __typename: 'Tag',
              label: 'foobar'
            },
          ],
          __onReplace: { tags: 'override' },
        }
      ]
    }
  ]]}]],
  contacts: {
    dummy: {
      address: {
        id: 'address1',
        __typename: 'Address',
        street: 'Foo street'
      },
      phones: [
        {
          id: 'phone1',
          __typename: 'Phone',
          number: '10'
        },
        {
          id: 'phone2',
          __typename: 'Phone',
          number: '20'
        }
      ],
      __onReplace: { phones: 'append' }
    }
  }
});

beforeEach(() => {
  store.subscribers = new Set();
  store.initialize({});
});

test('custom user resolver strategy', async () => {
  store.store(denormalizedData);

  const client = {
    request(_queryDocument, _variables) {
      return { id: 'person2', __typename: 'Person', name: 'John' };
    }
  };

  let data;

  const unsubscriber = jest.fn();
  const resolver = jest.fn();
  const subscriber = jest.fn();

  const query = new Query(client, null);

  query.setResolver((_variables, _entities) => {
    resolver();
    return 42;
  });

  data = await query.watch({}, subscriber, unsubscriber);

  expect(unsubscriber).toHaveBeenCalledTimes(1);
  expect(resolver).toHaveBeenCalledTimes(1);
  expect(subscriber).toHaveBeenCalledTimes(0);
  expect(data).toBe(42);

  data = await query.watch({}, subscriber, unsubscriber);

  expect(unsubscriber).toHaveBeenCalledTimes(2);
  expect(resolver).toHaveBeenCalledTimes(1);
  expect(subscriber).toHaveBeenCalledTimes(0);
  expect(data).toBe(42);

  data = await query.query({});

  expect(resolver).toHaveBeenCalledTimes(1);
  expect(data).toBe(42);

  data = await query.query({ foo: 1 });

  expect(resolver).toHaveBeenCalledTimes(2);
  expect(data).toBe(42);

  data = await query.query({ foo: 2 });

  expect(resolver).toHaveBeenCalledTimes(3);
  expect(data).toBe(42);
});

test('onUnobservedStrategy KEEP_UPDATING', async () => {
  store.store(denormalizedData);

  const client = {
    request(_queryDocument, _variables) {
      return { id: 'person2', __typename: 'Person', name: 'John' };
    }
  }

  let data;

  const resolver = jest.fn();

  const query = new Query(client, null);

  query.setOnUnobservedStrategy(_variables => OnUnobservedStrategy.KEEP_UPDATING);

  query.setResolver((_variables, _entities) => {
    resolver();
    return 42;
  });

  data = await query.query({ foo: 1 });

  expect(resolver).toHaveBeenCalledTimes(1);
  expect(data).toBe(42);

  data = await query.query({ foo: 1 });

  expect(resolver).toHaveBeenCalledTimes(1);
  expect(data).toBe(42);
});

test('onUnobservedStrategy PAUSE_UPDATING', async () => {
  store.store(denormalizedData);

  const client = {
    request(_queryDocument, _variables) {
      return { id: 'person2', __typename: 'Person', name: 'John' };
    }
  }

  let data;

  const resolver = jest.fn();

  const query = new Query(client, null);

  query.setResolver((_variables, _entities) => {
    resolver();
    return 42;
  });

  data = await query.query({ foo: 1 });

  expect(resolver).toHaveBeenCalledTimes(1);
  expect(data).toBe(42);

  data = await query.query({ foo: 1 });

  expect(resolver).toHaveBeenCalledTimes(2);
  expect(data).toBe(42);
});

test('store updates', async () => {
  store.store(denormalizedData);

  const client1 = {
    request(_queryDocument, _variables) {
      return { id: 'person2', __typename: 'Person', name: 'John' };
    }
  }

  const client2 = {
    request(_queryDocument, _variables) {
      return { id: 'person2', __typename: 'Person', name: 'James' };
    }
  }

  const resolver1 = jest.fn();
  const resolver2 = jest.fn();

  const query1 = new Query(client1, null);
  query1.setResolver((_variables, _entities) => {
    resolver1();
    return 42;
  });
  query1.setOnUnobservedStrategy(_variables => OnUnobservedStrategy.KEEP_UPDATING);

  const query2 = new Query(client2, null);
  query2.setResolver((_variables, _entities) => {
    resolver2();
    return 42;
  });

  const data1 = await query1.query({ foo: 1 });
  const data2 = await query2.query({ foo: 1 });

  expect(data1).toBe(42);
  expect(data2).toBe(42);

  expect(resolver1).toHaveBeenCalledTimes(2);
  expect(resolver2).toHaveBeenCalledTimes(1);
});

test('store updates unrelated', async () => {
  store.store(denormalizedData);

  const client1 = {
    request(_queryDocument, _variables) {
      return { id: 'person2', __typename: 'Person', name: 'John' };
    }
  }

  const client2 = {
    request(_queryDocument, _variables) {
      return { id: 'person3', __typename: 'Person', name: 'James' };
    }
  }

  const resolver1 = jest.fn();
  const resolver2 = jest.fn();

  const query1 = new Query(client1, null);
  query1.setResolver((_variables, _entities) => {
    resolver1();
    return 42;
  });
  query1.setOnUnobservedStrategy(_variables => OnUnobservedStrategy.KEEP_UPDATING);

  const query2 = new Query(client2, null);
  query2.setResolver((_variables, _entities) => {
    resolver2();
    return 42;
  });

  const data1 = await query1.query({ foo: 1 });
  const data2 = await query2.query({ foo: 1 });

  expect(data1).toBe(42);
  expect(data2).toBe(42);

  expect(resolver1).toHaveBeenCalledTimes(1);
  expect(resolver2).toHaveBeenCalledTimes(1);
});

test('custom onStoreUpdate: prevent update', async () => {
  store.store(denormalizedData);

  const client1 = {
    request(_queryDocument, _variables) {
      return { id: 'person2', __typename: 'Person', name: 'John' };
    }
  }

  const client2 = {
    request(_queryDocument, _variables) {
      return { id: 'person2', __typename: 'Person', name: 'James' };
    }
  }

  const resolver1 = jest.fn();
  const resolver2 = jest.fn();

  const query1 = new Query(client1, null);
  query1.setResolver((_variables, _entities) => {
    resolver1();
    return 42;
  });
  query1.setOnUnobservedStrategy(_variables => OnUnobservedStrategy.KEEP_UPDATING);
  query1.setOnStoreUpdate((update, _variables, match) => {
    if (match(update, { type: UpdateType.UPDATE_PROP, entity: { id: 'person2' } })) {
      return false;
    }
  });

  const query2 = new Query(client2, null);
  query2.setResolver((_variables, _entities) => {
    resolver2();
    return 42;
  });

  const data1 = await query1.query({ foo: 1 });
  const data2 = await query2.query({ foo: 1 });

  expect(data1).toBe(42);
  expect(data2).toBe(42);

  expect(resolver1).toHaveBeenCalledTimes(1);
  expect(resolver2).toHaveBeenCalledTimes(1);
});

test('custom onStoreUpdate: update', async () => {
  store.store(denormalizedData);

  const client1 = {
    request(_queryDocument, _variables) {
      return { id: 'person2', __typename: 'Person', name: 'John' };
    }
  }

  const client2 = {
    request(_queryDocument, _variables) {
      return { id: 'person2', __typename: 'Person', name: 'James' };
    }
  }

  const resolver1 = jest.fn();
  const resolver2 = jest.fn();

  const query1 = new Query(client1, null);
  query1.setResolver((_variables, _entities) => {
    resolver1();
    return 42;
  });
  query1.setOnUnobservedStrategy(_variables => OnUnobservedStrategy.KEEP_UPDATING);
  query1.setOnStoreUpdate((update, _variables, match) => {
    if (match(update, { type: UpdateType.UPDATE_PROP, entity: { id: 'person2' } })) {
      return true;
    }
  });

  const query2 = new Query(client2, null);
  query2.setResolver((_variables, _entities) => {
    resolver2();
    return 42;
  });

  const data1 = await query1.query({ foo: 1 });
  const data2 = await query2.query({ foo: 1 });

  expect(data1).toBe(42);
  expect(data2).toBe(42);

  expect(resolver1).toHaveBeenCalledTimes(2);
  expect(resolver2).toHaveBeenCalledTimes(1);
});

test('custom onStoreUpdate: update unrelated', async () => {
  store.store(denormalizedData);

  const client1 = {
    request(_queryDocument, _variables) {
      return { id: 'person2', __typename: 'Person', name: 'John' };
    }
  }

  const client2 = {
    request(_queryDocument, _variables) {
      return { id: 'person3', __typename: 'Person', name: 'James' };
    }
  }

  const resolver1 = jest.fn();
  const resolver2 = jest.fn();

  const query1 = new Query(client1, null);
  query1.setResolver((_variables, _entities) => {
    resolver1();
    return 42;
  });
  query1.setOnUnobservedStrategy(_variables => OnUnobservedStrategy.KEEP_UPDATING);
  query1.setOnStoreUpdate((update, _variables, match) => {
    if (match(update, { type: UpdateType.UPDATE_PROP, entity: { id: 'person2' } })) {
      return true;
    }
  });

  const query2 = new Query(client2, null);
  query2.setResolver((_variables, _entities) => {
    resolver2();
    return 42;
  });

  const data1 = await query1.query({ foo: 1 });
  const data2 = await query2.query({ foo: 1 });

  expect(data1).toBe(42);
  expect(data2).toBe(42);

  expect(resolver1).toHaveBeenCalledTimes(1);
  expect(resolver2).toHaveBeenCalledTimes(1);
});
