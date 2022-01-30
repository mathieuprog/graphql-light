import store from './store';
import Query from './Query';
import FetchStrategy from './FetchStrategy';
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
  articles: [[ // just testing nested arrays
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
  ]],
  __onReplace: { articles: 'append' },
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

test('Query', async () => {
  store.store(denormalizedData);

  const globalSubscriber = jest.fn();
  store.subscribe(globalSubscriber);

  const resolver1 = jest.fn();
  const unsubscriber1 = jest.fn();
  const updater1 = jest.fn();
  const onStoreUpdate1 = jest.fn();

  const client1 = {
    request(_queryDocument, _variables) {
      return { id: 'person2', __typename: 'Person', name: 'John' };
    }
  }

  const query1 = new Query(client1, null);
  query1.setResolver(() => (resolver1(), 1));
  query1.setOnStoreUpdate(() => (onStoreUpdate1(), null));

  let data = query1.watch({}, updater1, unsubscriber1, {}); // first watcher

  await data;

  expect(globalSubscriber).toHaveBeenCalledTimes(1);

  expect(resolver1).toHaveBeenCalledTimes(1);
  expect(unsubscriber1).toHaveBeenCalledTimes(1);
  expect(updater1).toHaveBeenCalledTimes(0);
  expect(onStoreUpdate1).toHaveBeenCalledTimes(0);

  const updater2 = jest.fn();
  const unsubscriber2 = jest.fn();

  data = query1.watch({}, updater2, unsubscriber2, {}); // second watcher

  await data;

  expect(resolver1).toHaveBeenCalledTimes(1);
  expect(unsubscriber1).toHaveBeenCalledTimes(1);
  expect(updater1).toHaveBeenCalledTimes(0);
  expect(onStoreUpdate1).toHaveBeenCalledTimes(0);

  expect(updater2).toHaveBeenCalledTimes(0);
  expect(unsubscriber2).toHaveBeenCalledTimes(1);

  const updater3 = jest.fn();
  const unsubscriber3 = jest.fn();

  data = query1.watch({ foo: 1 }, updater3, unsubscriber3, {}); // third watcher

  await data;

  expect(resolver1).toHaveBeenCalledTimes(2);
  expect(onStoreUpdate1).toHaveBeenCalledTimes(0);

  expect(updater1).toHaveBeenCalledTimes(0);
  expect(updater2).toHaveBeenCalledTimes(0);
  expect(updater3).toHaveBeenCalledTimes(0);

  const updater4 = jest.fn();
  const unsubscriber4 = jest.fn();

  // data has not changed
  data = query1.watch({}, updater4, unsubscriber4, { fetchStrategy: FetchStrategy.NETWORK_ONLY });  // fourth watcher

  await data;

  expect(resolver1).toHaveBeenCalledTimes(2);
  expect(onStoreUpdate1).toHaveBeenCalledTimes(0);

  expect(updater1).toHaveBeenCalledTimes(0);
  expect(updater2).toHaveBeenCalledTimes(0);
  expect(updater3).toHaveBeenCalledTimes(0);
  expect(updater4).toHaveBeenCalledTimes(0);

  const updater5 = jest.fn();
  const unsubscriber5 = jest.fn();

  client1.request = (_queryDocument, _variables) => {
    return { id: 'person2', __typename: 'Person', name: 'James' };
  };

  // data has changed
  data = query1.watch({}, updater5, unsubscriber5, { fetchStrategy: FetchStrategy.NETWORK_ONLY }); // fifth watcher

  await data;

  expect(resolver1).toHaveBeenCalledTimes(4); // 2 previous calls + 1 update for watcher with empty params + 1 with param `foo`
  expect(onStoreUpdate1).toHaveBeenCalledTimes(2); // once for queries with empty params {} and once for query with params

  expect(updater1).toHaveBeenCalledTimes(1);
  expect(updater2).toHaveBeenCalledTimes(1);
  expect(updater3).toHaveBeenCalledTimes(1);
  expect(updater4).toHaveBeenCalledTimes(1);
  expect(updater5).toHaveBeenCalledTimes(0);

  const client6 = {
    request(_queryDocument, _variables) {
      return { id: 'person2', __typename: 'Person', __delete: true };
    }
  }

  const resolver6 = jest.fn();
  const unsubscriber6 = jest.fn();
  const updater6 = jest.fn();
  const onStoreUpdate6 = jest.fn();

  const query6 = new Query(client6, null);
  query6.setResolver(() => (resolver6(), 1));
  query6.setOnStoreUpdate(() => (onStoreUpdate6(), null));

  data = query6.watch({}, updater6, unsubscriber6); // sixth watcher but on different query

  await data;

  expect(resolver1).toHaveBeenCalledTimes(6); // 4 previous calls + 1 update for watcher with empty params + 1 with params
  expect(onStoreUpdate1).toHaveBeenCalledTimes(4);
  expect(unsubscriber6).toHaveBeenCalledTimes(1);

  expect(resolver6).toHaveBeenCalledTimes(1);
  expect(onStoreUpdate6).toHaveBeenCalledTimes(0);

  expect(updater1).toHaveBeenCalledTimes(2);
  expect(updater2).toHaveBeenCalledTimes(2);
  expect(updater3).toHaveBeenCalledTimes(2);
  expect(updater4).toHaveBeenCalledTimes(2);
  expect(updater5).toHaveBeenCalledTimes(1);
  expect(updater6).toHaveBeenCalledTimes(0);

  const resolver7 = jest.fn();
  const unsubscriber7 = jest.fn();
  const updater7 = jest.fn();
  const onStoreUpdate7 = jest.fn();

  const query7 = new Query(client6, null);
  query7.setResolver(() => (resolver7(), 1));
  query7.setOnStoreUpdate(() => (onStoreUpdate7(), null));

  data = query7.watch({}, updater7, unsubscriber7); // seventh watcher but on different query

  expect(onStoreUpdate6).toHaveBeenCalledTimes(0);
  expect(onStoreUpdate7).toHaveBeenCalledTimes(0);

  expect(updater1).toHaveBeenCalledTimes(2);
  expect(updater2).toHaveBeenCalledTimes(2);
  expect(updater3).toHaveBeenCalledTimes(2);
  expect(updater4).toHaveBeenCalledTimes(2);
  expect(updater5).toHaveBeenCalledTimes(1);
  expect(updater6).toHaveBeenCalledTimes(0);
});

test('unsubscribe then resubscribe', async () => {
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

  const query1 = new Query(client1, null);

  let unsubscriber1;
  let data1 = await query1.watch({}, () => 1, unsubscriber => unsubscriber1 = unsubscriber, {});

  unsubscriber1();

  expect(data1).toEqual({ __typename: "Person", id: "person2", name: "John" });

  const query2 = new Query(client2, null);

  const data2 = await query2.query({ foo: 1 });

  expect(data2).toEqual({ __typename: "Person", id: "person2", name: "James" });

  data1 = await query1.watch({}, () => 1, unsubscriber => unsubscriber1 = unsubscriber, {});

  expect(data1).toEqual({ __typename: "Person", id: "person2", name: "James" });
});

test('unsubscribe', () => {
  store.store(denormalizedData);

  const unsubscriber = jest.fn();

  const client = {
    request(_queryDocument, _variables) {
      return {};
    }
  }

  const query = new Query(client, null);

  const watcher = query.watcher(unsubscriber);

  for (let i = 0; i < 5; ++i) {
    watcher.watch({}, () => null, unsubscriber, {});
  }

  expect(unsubscriber).toHaveBeenCalledTimes(4);
});
