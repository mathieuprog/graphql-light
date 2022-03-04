import store from './index';
import { deepFreeze, isArray } from '../utils';
import { jest } from '@jest/globals';

const denormalizedData = deepFreeze({ foo: { // test immutability
  id: 'person1',
  __typename: 'Person',
  name: 'Mathieu',
  test: [[1, 2]],
  list: [
    {
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
          ]
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
          ]
        }
      ]
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
}});

beforeEach(() => {
  store.initialize();
});


const onFetchEntity = _normalizedEntity => {
};

const onFetchArrayOfEntities = (propName, _object) => {
  switch (propName) {
    case 'articles':
      return 'append';

    case 'comments':
      return 'append';

    case 'phones':
      return 'append';

    case 'tags':
      return 'override';
  }
};

test('transform before storing', async () => {
  store.setConfig({
    transformers: {
      Phone: {
        data: {
          number: Number
        }
      }
    }
  });

  await store.store(denormalizedData, { onFetchEntity, onFetchArrayOfEntities });

  const entities = store.getEntities();

  expect(typeof entities['person1'].contacts.dummy.phones[0].number).toBe('number');
  expect(entities['person1'].contacts.dummy.phones[0].number).toBe(10);
});

test('store', async () => {
  await store.store(denormalizedData, { onFetchEntity, onFetchArrayOfEntities });

  expect(isArray(store.filterEntities({ id: 'person1' }).person1.test[0])).toBeTruthy();

  const subscriber = jest.fn();

  const unsubscribe = store.subscribe(subscriber);

  expect(subscriber).toHaveBeenCalledTimes(0);

  await store.store({ id: 'person2', __typename: 'Person', name: 'Jérôme' }, { onFetchEntity, onFetchArrayOfEntities });

  expect(subscriber).toHaveBeenCalledTimes(1);

  await store.store({ id: 'person3', __typename: 'Person', name: 'John' }, { onFetchEntity, onFetchArrayOfEntities });

  expect(subscriber).toHaveBeenCalledTimes(2);

  unsubscribe();

  await store.store({ id: 'person4', __typename: 'Person', name: 'James' }, { onFetchEntity, onFetchArrayOfEntities });

  expect(subscriber).toHaveBeenCalledTimes(2);

  expect(store.countEntities(store.getEntities())).toBe(12);
  expect(store.countEntities(store.filterEntities({ id: 'tag1' }))).toBe(1);
  expect(store.countEntities(store.filterEntities({ __typename: 'Tag' }))).toBe(3);
  expect(store.countEntities(store.filterEntities({ __typename: 'Tag', label: 'foo' }))).toBe(2);

  const entities = store.getEntitiesByType('Tag');
  expect(store.countEntities(entities)).toBe(3);

  expect(store.countEntities(store.filterEntities({ label: 'foo' }, entities))).toBe(2);

  const t = () => store.getSingleEntity(store.filterEntities({ label: 'foo' }, entities));
  expect(t).toThrow(Error);

  expect(store.getSingleEntity(store.filterEntities({ label: 'foobar' }, entities)).label).toBe('foobar');
});
