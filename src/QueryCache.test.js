import QueryCache from './QueryCache';
import cleanDenormalized from './cleanDenormalized';
import { isObjectSubset } from './utils';
import { deleteNestedProp, setNestedProp } from 'dynamic-props-immutable';

const denormalizedData = {
  id: 'person1',
  __typename: 'Person',
  name: 'Mathieu',
  test: [[1, 2]],
  articles: [{ foo: [
    {
      __onArray: { articles: 'append' },
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
          __onArray: { tags: 'override' },
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
          __onArray: { tags: 'override' },
        }
      ]
    }
  ]}],
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
      __onArray: { phones: 'append' }
    }
  }
};

beforeEach(() => {
  store.subscribers = new Set();
  store.initialize({});
});

test('applyUpdate', () => {
  store.store(denormalizedData);

  let data =
    cleanDenormalized({
      id: 'article1',
      __typename: 'Article',
      title: 'Foo'
    });

  let queryCache = new QueryCache(data);

  let update = { type: 'UPDATE_PROP', entity: { id: 'article1', title: 'Foo' }, propName: 'title' };

  queryCache.applyUpdate(update);

  expect(queryCache.get()).toEqual({
    id: 'article1',
    __typename: 'Article',
    title: 'Foo'
  });

  update = { type: 'UPDATE_PROP', entity: { id: 'article1', title: 'Bar' }, propName: 'title' };

  queryCache.applyUpdate(update);

  expect(queryCache.get()).toEqual({
    id: 'article1',
    __typename: 'Article',
    title: 'Bar'
  });

  update = { type: 'DELETE_ENTITY', entity: { id: 'article1' } };

  queryCache.applyUpdate(update);

  expect(queryCache.get()).toBeNull();

  data =
    cleanDenormalized({
      id: 'person1',
      __typename: 'Person',
      name: 'Mathieu',
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
          __onArray: { phones: 'append' }
        }
      }
    });

  queryCache = new QueryCache(data);

  update = { type: 'UPDATE_PROP', entity: { id: 'phone1', number: '11' }, propName: 'number' };

  queryCache.applyUpdate(update);

  expect(isObjectSubset(queryCache.get(), {
    contacts: { dummy: { phones: [{ id: 'phone1', number: '11' }, { id: 'phone2' }] } }
  })).toBeTruthy();

  update = { type: 'DELETE_ENTITY', entity: { id: 'phone1' } };

  queryCache.applyUpdate(update);

  expect(isObjectSubset(queryCache.get(), {
    contacts: { dummy: { phones: [{ id: 'phone2' }] } }
  })).toBeTruthy();
});

test('refresh', () => {
  store.store(denormalizedData);

  let data =
    cleanDenormalized({
      id: 'article1',
      __typename: 'Article',
      title: 'Foo'
    });

  let queryCache = new QueryCache(data);

  expect(queryCache.get()).toEqual({
    id: 'article1',
    __typename: 'Article',
    title: 'Foo'
  });

  queryCache.refresh();

  expect(queryCache.get()).toEqual({
    id: 'article1',
    __typename: 'Article',
    title: 'Foo'
  });

  let updatedDenormalizedData = setNestedProp`articles[${0}].foo[${0}].articles[${0}].title`(denormalizedData, 'Foobar');

  store.initialize({});
  store.store(updatedDenormalizedData);

  expect(queryCache.get()).toEqual({
    id: 'article1',
    __typename: 'Article',
    title: 'Foo'
  });

  queryCache.refresh();

  expect(queryCache.get()).toEqual({
    id: 'article1',
    __typename: 'Article',
    title: 'Foobar'
  });

  updatedDenormalizedData = deleteNestedProp`articles[${0}].foo[${0}].articles[${0}]`(denormalizedData, { resizeArray: true });

  store.initialize({});
  store.store(updatedDenormalizedData);

  queryCache.refresh();

  expect(queryCache.get()).toBeNull();

  data =
    cleanDenormalized({
      id: 'person1',
      __typename: 'Person',
      name: 'Mathieu',
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
          __onArray: { phones: 'append' }
        }
      }
    });

  queryCache = new QueryCache(data);

  expect(isObjectSubset(queryCache.get(), {
    contacts: { dummy: { address: { id: 'address1' } } }
  })).toBeTruthy();

  updatedDenormalizedData = setNestedProp`contacts.dummy.address.id`(denormalizedData, 'address10');
  updatedDenormalizedData = setNestedProp`contacts.dummy.address.street`(updatedDenormalizedData, 'Some street');

  store.initialize({});
  store.store(updatedDenormalizedData);

  queryCache.refresh();

  expect(isObjectSubset(queryCache.get(), {
    contacts: { dummy: { address: { id: 'address10', street: 'Some street' } } }
  })).toBeTruthy();

  expect(isObjectSubset(queryCache.get(), {
    contacts: { dummy: { phones: [
      { id: 'phone1' },
      { id: 'phone2' }
    ] } }
  })).toBeTruthy();

  updatedDenormalizedData = setNestedProp`contacts.dummy.phones[${0}].id`(denormalizedData, 'phone10');
  updatedDenormalizedData = setNestedProp`contacts.dummy.phones[${0}].number`(updatedDenormalizedData, '42');

  store.initialize({});
  store.store(updatedDenormalizedData);

  queryCache.refresh();

  expect(isObjectSubset(queryCache.get(), {
    contacts: { dummy: { phones: [
      { id: 'phone2', number: '20' }
    ] } }
  })).toBeTruthy();

  updatedDenormalizedData = deleteNestedProp`contacts.dummy.phones[${0}]`(denormalizedData, { resizeArray: true });

  store.initialize({});
  store.store(updatedDenormalizedData);

  queryCache.refresh();

  expect(isObjectSubset(queryCache.get(), {
    contacts: { dummy: { phones: [
      { id: 'phone2', number: '20' }
    ] } }
  })).toBeTruthy();
});
