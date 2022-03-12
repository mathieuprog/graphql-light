import store from '../store';
import Query from './Query';
import FetchStrategy from '../constants/FetchStrategy';
import { deepFreeze } from '../utils';
import { jest } from '@jest/globals';
import { Temporal } from '@js-temporal/polyfill';
import { removeEntityById } from '../store/middleware/normalize';
import checkMissingLinks from '../store/middleware/checkMissingLinks';
import checkInvalidReferences from '../store/middleware/checkInvalidReferences';

const denormalizedData = deepFreeze({
  id: 'person1',
  __typename: 'Person',
  name: 'Mathieu',
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
    }
  ],
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
      ]
    }
  }
});

beforeEach(() => {
  store.initialize();

  store.setConfig({ debug: true });

  const onFetchArrayOfEntities = (propName, object) => {
    switch (propName) {
      case 'articles':
        return 'append';

      case 'tags':
        return 'override';

      case 'phones':
        return (object.address.id === 'address2') ? 'override' : 'append';
    }
  };

  return store.store(denormalizedData, { onFetchArrayOfEntities });
});

afterEach(() => {
  expect(checkMissingLinks({}, store)).toEqual({});
  expect(checkInvalidReferences({}, store)).toEqual({});
});

test('Query', async () => {
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
      return { id: 'person2', __typename: 'Person' };
    }
  }

  const resolver6 = jest.fn();
  const unsubscriber6 = jest.fn();
  const updater6 = jest.fn();
  const onStoreUpdate6 = jest.fn();

  const query6 = new Query(client6, null);
  query6.setResolver(() => (resolver6(), 1));
  query6.setOnStoreUpdate(() => (onStoreUpdate6(), null));
  query6.setOnFetchEntity(normalizedEntity => {
    if (normalizedEntity.id === 'person2') {
      return removeEntityById(normalizedEntity.id);
    }
  });

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

test('unsubscribe', async () => {
  const unsubscriber = jest.fn();
  const getUnsubscriber = jest.fn();

  const client = {
    request(_queryDocument, _variables) {
      return {};
    }
  }

  const query = new Query(client, null);

  const watcher = query.watcher(unsubscriber);

  for (let i = 0; i < 5; ++i) {
    await watcher.watch({}, () => null, getUnsubscriber, {});
  }

  expect(unsubscriber).toHaveBeenCalledTimes(4);
  expect(getUnsubscriber).toHaveBeenCalledTimes(5);
});

test('clearWhenInactiveForDuration', async () => {
  const client = {
    request(_queryDocument, _variables) {
      return {};
    }
  }

  const query = new Query(client, null);
  query.setOptions(_variables => ({
    clearWhenInactiveForDuration: Temporal.Duration.from({ seconds: 1 })
  }));

  await query.watch({}, () => 1, () => null);

  const sleep = (ms) => new Promise((resolve => setTimeout(resolve, ms)));

  await sleep(100);

  expect(Object.keys(query.queriesForVars).length).toBe(1);

  await sleep(1000);

  expect(query.queriesForVars).toEqual({});

  await query.watch({}, () => 1, () => null);

  expect(Object.keys(query.queriesForVars).length).toBe(1);
});

test('refreshAfterDuration', async () => {
  const executeRequest = jest.fn();

  const client = {
    request(_queryDocument, _variables) {
      executeRequest();
      return {};
    }
  }

  const sleep = (ms) => new Promise((resolve => setTimeout(resolve, ms)));

  const query1 = new Query(client, null);
  await query1.watch({}, () => 1, () => null);
  await sleep(200);
  await query1.watch({}, () => 1, () => null);

  expect(executeRequest).toHaveBeenCalledTimes(1);

  const query2 = new Query(client, null);
  await query2.watch({}, () => 1, () => null);
  await sleep(200);
  await query2.watch({}, () => 1, () => null);

  expect(executeRequest).toHaveBeenCalledTimes(2);

  const query3 = new Query(client, null);
  query3.setOptions(_variables => ({
    refreshAfterDuration: Temporal.Duration.from({ milliseconds: 100 })
  }));
  await query3.watch({}, () => 1, () => null);
  await sleep(200);
  await query3.watch({}, () => 1, () => null);

  expect(executeRequest).toHaveBeenCalledTimes(4);

  query3.removeQueryForVars({});
});

test('setDependentQueries', async () => {
  const request1 = jest.fn();
  const request2 = jest.fn();
  const resolver1 = jest.fn();
  const resolver2 = jest.fn();

  const client1 = {
    request(_queryDocument, _variables) {
      request1();
      return { id: 'person2', __typename: 'Person', name: 'John' };
    }
  }

  const client2 = {
    request(_queryDocument, _variables) {
      request2();
      return { id: 'person2', __typename: 'Person', name: 'James' };
    }
  }

  const query1 = new Query(client1, null);
  query1.setResolver(() => (resolver1(), 1));

  expect(request1).toHaveBeenCalledTimes(0);
  expect(request2).toHaveBeenCalledTimes(0);
  expect(resolver1).toHaveBeenCalledTimes(0);
  expect(resolver2).toHaveBeenCalledTimes(0);

  const query2 = new Query(client2, null);
  query2.setResolver(() => (resolver2(), 1));
  query2.setDependentQueries([
    (_variables) => query1.query({})
  ]);

  await query2.query({ foo: 1 });

  expect(request1).toHaveBeenCalledTimes(1);
  expect(request2).toHaveBeenCalledTimes(1);
  expect(resolver1).toHaveBeenCalledTimes(1);
  expect(resolver2).toHaveBeenCalledTimes(1);
});
