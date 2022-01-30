import store from './store';
import Query from './Query';
import DerivedQuery from './DerivedQuery';
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

test('DerivedQuery', async () => {
  store.store(denormalizedData);

  const globalSubscriber = jest.fn();
  store.subscribe(globalSubscriber);

  const resolver1 = jest.fn();
  const resolver2 = jest.fn();
  const unsubscriber2 = jest.fn();
  const updater2 = jest.fn();
  const onStoreUpdate1 = jest.fn();
  const onStoreUpdate2 = jest.fn();

  const client1 = {
    request(_queryDocument, _variables) {
      return { id: 'person2', __typename: 'Person', name: 'John' };
    }
  }

  const client2 = {
    request(_queryDocument, _variables) {
      return { id: 'address1', __typename: 'Address', name: 'New street' };
    }
  }

  const query1 = new Query(client1, null);
  query1.setResolver(() => (resolver1(), 1));
  query1.setOnStoreUpdate(() => (onStoreUpdate1(), null));

  const query2 = new Query(client2, null);
  query2.setResolver(() => (resolver2(), 1));
  query2.setOnStoreUpdate(() => (onStoreUpdate2(), null));

  let data = query2.watch({}, updater2, unsubscriber2, {});

  await data; // one query will be resolved, the other not

  expect(globalSubscriber).toHaveBeenCalledTimes(1);
  expect(unsubscriber2).toHaveBeenCalledTimes(1);
  expect(resolver1).toHaveBeenCalledTimes(0);
  expect(resolver2).toHaveBeenCalledTimes(1);
  expect(updater2).toHaveBeenCalledTimes(0);
  expect(onStoreUpdate1).toHaveBeenCalledTimes(0);
  expect(onStoreUpdate2).toHaveBeenCalledTimes(0);

  const resolver3 = jest.fn();
  const updater3 = jest.fn();
  const unsubscriber3 = jest.fn();

  const queries = [
    { query: query1, takeVariables: () => ({}) },
    { query: query2, takeVariables: () => ({}) }
  ];

  const derivedQuery3 = new DerivedQuery(queries, () => (resolver3(), 1));

  data = derivedQuery3.watch({}, updater3, unsubscriber3, {});

  await data;

  expect(globalSubscriber).toHaveBeenCalledTimes(2); // query1 just got executed
  expect(resolver1).toHaveBeenCalledTimes(1);
  expect(resolver2).toHaveBeenCalledTimes(1);
  expect(updater2).toHaveBeenCalledTimes(0);
  expect(onStoreUpdate1).toHaveBeenCalledTimes(0);
  expect(onStoreUpdate2).toHaveBeenCalledTimes(1);

  expect(resolver3).toHaveBeenCalledTimes(1);
  expect(unsubscriber3).toHaveBeenCalledTimes(1);
  expect(updater3).toHaveBeenCalledTimes(0);

  const updater1 = jest.fn();
  const unsubscriber1 = jest.fn();

  client1.request = (_queryDocument, _variables) => {
    return { id: 'person2', __typename: 'Person', name: 'James' };
  };

  // data has changed
  data = query1.watch({}, updater1, unsubscriber1, { fetchStrategy: FetchStrategy.NETWORK_ONLY });

  await data;

  expect(globalSubscriber).toHaveBeenCalledTimes(3);
  expect(unsubscriber1).toHaveBeenCalledTimes(1);
  expect(updater1).toHaveBeenCalledTimes(0);
  expect(resolver1).toHaveBeenCalledTimes(2);
  expect(resolver2).toHaveBeenCalledTimes(1);
  expect(updater2).toHaveBeenCalledTimes(0);
  expect(onStoreUpdate1).toHaveBeenCalledTimes(1);
  expect(onStoreUpdate2).toHaveBeenCalledTimes(2);

  expect(resolver3).toHaveBeenCalledTimes(2);
  expect(unsubscriber3).toHaveBeenCalledTimes(1);
  expect(updater3).toHaveBeenCalledTimes(1);
});

test('DerivedQuery with queries using query cache', async () => {
  store.store(denormalizedData);

  const globalSubscriber = jest.fn();
  store.subscribe(globalSubscriber);

  const unsubscriber2 = jest.fn();
  const updater2 = jest.fn();
  const onStoreUpdate1 = jest.fn();
  const onStoreUpdate2 = jest.fn();

  const client1 = {
    request(_queryDocument, _variables) {
      return { id: 'person2', __typename: 'Person', name: 'John' };
    }
  }

  const client2 = {
    request(_queryDocument, _variables) {
      return { id: 'address1', __typename: 'Address', name: 'New street' };
    }
  }

  const query1 = new Query(client1, null);
  query1.setOnStoreUpdate(() => (onStoreUpdate1(), null));

  const query2 = new Query(client2, null);
  query2.setOnStoreUpdate(() => (onStoreUpdate2(), null));

  let data = query2.watch({}, updater2, unsubscriber2, {});

  await data; // one query will be resolved, the other not

  expect(globalSubscriber).toHaveBeenCalledTimes(1);
  expect(unsubscriber2).toHaveBeenCalledTimes(1);
  expect(updater2).toHaveBeenCalledTimes(0);
  expect(onStoreUpdate1).toHaveBeenCalledTimes(0);
  expect(onStoreUpdate2).toHaveBeenCalledTimes(0);

  const resolver3 = jest.fn();
  const updater3 = jest.fn();
  const unsubscriber3 = jest.fn();

  const queries = [
    { query: query1, takeVariables: () => ({}) },
    { query: query2, takeVariables: () => ({}) }
  ];

  const derivedQuery3 = new DerivedQuery(queries, () => (resolver3(), 1));

  data = derivedQuery3.watch({}, updater3, unsubscriber3, {});

  await data;

  expect(globalSubscriber).toHaveBeenCalledTimes(2); // query1 just got executed
  expect(updater2).toHaveBeenCalledTimes(0);
  expect(onStoreUpdate1).toHaveBeenCalledTimes(0);
  expect(onStoreUpdate2).toHaveBeenCalledTimes(1);

  expect(resolver3).toHaveBeenCalledTimes(1);
  expect(unsubscriber3).toHaveBeenCalledTimes(1);
  expect(updater3).toHaveBeenCalledTimes(0);

  const updater1 = jest.fn();
  const unsubscriber1 = jest.fn();

  client1.request = (_queryDocument, _variables) => {
    return { id: 'person2', __typename: 'Person', name: 'James' };
  };

  // data has changed
  data = query1.watch({}, updater1, unsubscriber1, { fetchStrategy: FetchStrategy.NETWORK_ONLY });

  await data;

  expect(globalSubscriber).toHaveBeenCalledTimes(3);
  expect(unsubscriber1).toHaveBeenCalledTimes(1);
  expect(updater1).toHaveBeenCalledTimes(0);
  expect(updater2).toHaveBeenCalledTimes(0);
  expect(onStoreUpdate1).toHaveBeenCalledTimes(1);
  expect(onStoreUpdate2).toHaveBeenCalledTimes(2);

  expect(resolver3).toHaveBeenCalledTimes(2);
  expect(unsubscriber3).toHaveBeenCalledTimes(1);
  expect(updater3).toHaveBeenCalledTimes(1);
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

  const derivedQuery = new DerivedQuery([{ query, takeVariables: () => ({}) }], () => 1);

  const watcher = derivedQuery.watcher(unsubscriber);

  for (let i = 0; i < 5; ++i) {
    watcher.watch({}, () => null, unsubscriber, {});
  }

  expect(unsubscriber).toHaveBeenCalledTimes(4);
});
