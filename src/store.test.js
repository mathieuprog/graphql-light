import store from './store';
import transform from './transform';
import { isArray } from './utils';
import { jest } from '@jest/globals';

function deepFreeze(obj) {
  Object.keys(obj).forEach(prop => {
    if (typeof obj[prop] === 'object' && !Object.isFrozen(obj[prop])) {
      deepFreeze(obj[prop]);
    }
  });

  return Object.freeze(obj);
}

const denormalizedData = deepFreeze({ // test immutability
  id: 'person1',
  __typename: 'Person',
  name: 'Mathieu',
  test: [[1, 2]],
  articles: [[{ foo: [[ // just testing nested arrays
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

test('transform before storing', () => {
  store.setConfig({
    transformers: {
      transformPhone: entity =>
        transform(entity, {
          number: Number
        })}});

  store.store(denormalizedData);

  const entities = store.getEntities();

  expect(typeof entities['person1'].contacts.dummy.phones[0].number).toBe('number');
  expect(entities['person1'].contacts.dummy.phones[0].number).toBe(10);
});

test('store', () => {
  store.store(denormalizedData);

  expect(isArray(store.filterEntities({ id: 'person1' }).person1.test[0])).toBeTruthy();

  const subscriber = jest.fn();

  const unsubscribe = store.subscribe(subscriber);

  expect(subscriber).toHaveBeenCalledTimes(0);

  store.store({ id: 'person2', __typename: 'Person', name: 'Jérôme' });

  expect(subscriber).toHaveBeenCalledTimes(1);

  store.store({ id: 'person3', __typename: 'Person', name: 'John' });

  expect(subscriber).toHaveBeenCalledTimes(2);

  unsubscribe();

  store.store({ id: 'person4', __typename: 'Person', name: 'James' });

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
