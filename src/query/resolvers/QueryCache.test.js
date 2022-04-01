import QueryCache from './QueryCache';
import { isArrayOfEntities, isArrayOfEntityProxies, isObjectSubset } from '../../utils';
import { deleteNestedProp, setNestedProp } from 'dynamic-props-immutable';
import checkMissingLinks from '../../store/middleware/checkMissingLinks';
import checkInvalidReferences from '../../store/middleware/checkInvalidReferences';
import Query from '../Query';
import FetchStrategy from '../../constants/FetchStrategy';
import OnUnobservedStrategy from '../../constants/OnUnobservedStrategy';

const denormalizedData = {
  id: 'person1',
  __typename: 'Person',
  name: 'Mathieu',
  test: [[1, 2]],
  list: [{ foo: [
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
  ]}],
  contacts: {
    dummy: {
      address: {
        id: 'address1',
        __typename: 'Address',
        street: 'Foo street',
        phones: [
          { id: 'phone1', __typename: 'Phone', number: '10' },
          { id: 'phone2', __typename: 'Phone', number: '20' }
        ]
      },
      phones: [
        { id: 'phone1', __typename: 'Phone', number: '10' },
        { id: 'phone2', __typename: 'Phone', number: '20' },
        { id: 'phone3', __typename: 'Phone', number: '30' }
      ]
    }
  }
};

const onFetchArrayOfEntities = (propName, object) => {
  switch (propName) {
    case 'articles':
      return 'append';

    case 'tags':
      return 'override';

    case 'phones':
      if (object?.__typename === 'Address') {
        return 'append';
      }
      return (object.address.id === 'address2') ? 'override' : 'append';
  }
};

beforeEach(() => {
  store.initialize();

  store.setConfig({ debug: true });

  return store.store(denormalizedData, { onFetchArrayOfEntities });
});

afterEach(() => {
  expect(checkMissingLinks({}, store)).toEqual({});
  expect(checkInvalidReferences({}, store)).toEqual({});
});

// test('applyUpdate', () => {
//   let queryCache = new QueryCache({
//     id: 'article1',
//     __typename: 'Article',
//     title: 'Foo'
//   });

//   let update = { type: 'UPDATE_PROP', entity: { id: 'article1', title: 'Foo' }, propName: 'title' };

//   queryCache.applyUpdate(update);

//   expect(queryCache.get()).toEqual({
//     id: 'article1',
//     __typename: 'Article',
//     title: 'Foo'
//   });

//   update = { type: 'UPDATE_PROP', entity: { id: 'article1', title: 'Bar' }, propName: 'title' };

//   queryCache.applyUpdate(update);

//   expect(queryCache.get()).toEqual({
//     id: 'article1',
//     __typename: 'Article',
//     title: 'Bar'
//   });

//   update = { type: 'DELETE_ENTITY', entity: { id: 'article1' } };

//   queryCache.applyUpdate(update);

//   expect(queryCache.get()).toBeNull();

//   queryCache = new QueryCache({
//     id: 'person1',
//     __typename: 'Person',
//     name: 'Mathieu',
//     contacts: {
//       dummy: {
//         address: {
//           id: 'address1',
//           __typename: 'Address',
//           street: 'Foo street'
//         },
//         phones: [
              // { id: 'phone1', __typename: 'Phone', number: '10' },
              // { id: 'phone2', __typename: 'Phone', number: '20' }
//         ]
//       }
//     }
//   });

//   update = { type: 'UPDATE_PROP', entity: { id: 'phone1', number: '11' }, propName: 'number' };

//   queryCache.applyUpdate(update);

//   expect(isObjectSubset(queryCache.get(), {
//     contacts: { dummy: { phones: [{ id: 'phone1', number: '11' }, { id: 'phone2' }] } }
//   })).toBeTruthy();

//   update = { type: 'DELETE_ENTITY', entity: { id: 'phone1' } };

//   queryCache.applyUpdate(update);

//   expect(isObjectSubset(queryCache.get(), {
//     contacts: { dummy: { phones: [{ id: 'phone2' }] } }
//   })).toBeTruthy();
// });

test('applyUpdate (2)', async () => {
  const client = {
    request(_document, _variables) {
      return {
        id: 'person1',
        __typename: 'Person',
        name: 'Mathieu',
        contacts: {
          dummy: {
            address: {
              id: 'address1',
              __typename: 'Address',
              street: 'Street',
              phones: [
                { id: 'phone1', __typename: 'Phone', number: '10' }
              ]
            }
          }
        }
      };
    }
  };

  const query = new Query(client, null);

  query.setOnUnobservedStrategy(_variables => OnUnobservedStrategy.KEEP_UPDATING);

  query.setOnFetchArrayOfEntities((propName, _object) => {
    switch (propName) {
      case 'phones':
        return 'append';
    }
  });

  await query.query({});

  let queryForVars = query.getQueryForVars({});
  let queryCache = queryForVars.strategy.getCachedData();

  client.request = (_document, _variables) => {
    return {
      id: 'person1',
      __typename: 'Person',
      name: 'John',
      contacts: {
        dummy: {
          address: {
            id: 'address1',
            __typename: 'Address',
            street: 'Updated street',
            phones: [
              { id: 'phone3', __typename: 'Phone', number: '30' }
            ]
          }
        }
      }
    }
  };

  const query2 = new Query(client, null);

  query2.setOnFetchArrayOfEntities((propName, _object) => {
    switch (propName) {
      case 'phones':
        return 'append';
    }
  });

  await query2.query({ foo: 1 });

  queryForVars = query.getQueryForVars({});
  queryCache = queryForVars.strategy.getCachedData();

  await query.query({});

  queryForVars = query.getQueryForVars({});
  queryCache = queryForVars.strategy.getCachedData();



  // let queryCache = new QueryCache({
  //   id: 'person1',
  //   __typename: 'Person',
  //   name: 'Mathieu',
  //   contacts: {
  //     dummy: {
  //       address: {
  //         id: 'address1',
  //         __typename: 'Address',
  //         street: 'Foo street',
  //         phones: [
  //           {
  //             id: 'phone1',
  //             __typename: 'Phone',
  //             number: '10'
  //           },
  //           {
  //             id: 'phone2',
  //             __typename: 'Phone',
  //             number: '20'
  //           }
  //         ]
  //       },
  //       phones: [
  //         {
  //           id: 'phone1',
  //           __typename: 'Phone',
  //           number: '10'
  //         },
  //         {
  //           id: 'phone2',
  //           __typename: 'Phone',
  //           number: '20'
  //         }
  //       ]
  //     }
  //   }
  // });

  // update = { type: 'UPDATE_PROP', entity: { id: 'address1', phones: 'Bar' }, propName: 'phones' };

  // queryCache.applyUpdate(update);

  // expect(isObjectSubset(queryCache.get(), {
  //   contacts: { dummy: { address: { id: 'address1', street: 'Bar' } } }
  // })).toBeTruthy();

  // expect(isArrayOfEntities(queryCache.get().contacts.dummy.address.phones)).toBeTruthy();
  // expect(isArrayOfEntityProxies(queryCache.get().contacts.dummy.address.phones)).toBeFalsy();
});

// test('refresh', async () => {
//   let queryCache = new QueryCache({
//     id: 'article1',
//     __typename: 'Article',
//     title: 'Foo'
//   });

//   expect(queryCache.get()).toEqual({
//     id: 'article1',
//     __typename: 'Article',
//     title: 'Foo'
//   });

//   queryCache.refresh();

//   expect(queryCache.get()).toEqual({
//     id: 'article1',
//     __typename: 'Article',
//     title: 'Foo'
//   });

//   let updatedDenormalizedData = setNestedProp`list[${0}].foo[${0}].articles[${0}].title`(denormalizedData, 'Foobar');

//   store.initialize();

//   store.setConfig({ debug: true });

//   await store.store(updatedDenormalizedData, { onFetchArrayOfEntities });

//   expect(queryCache.get()).toEqual({
//     id: 'article1',
//     __typename: 'Article',
//     title: 'Foo'
//   });

//   queryCache.refresh();

//   expect(queryCache.get()).toEqual({
//     id: 'article1',
//     __typename: 'Article',
//     title: 'Foobar'
//   });

//   updatedDenormalizedData = deleteNestedProp`list[${0}].foo[${0}].articles[${0}]`(denormalizedData, { resizeArray: true });

//   store.initialize();

//   store.setConfig({ debug: true });

//   await store.store(updatedDenormalizedData, { onFetchArrayOfEntities });

//   queryCache.refresh();

//   expect(queryCache.get()).toBeNull();

//   queryCache = new QueryCache({
//     id: 'person1',
//     __typename: 'Person',
//     name: 'Mathieu',
//     contacts: {
//       dummy: {
//         address: {
//           id: 'address1',
//           __typename: 'Address',
//           street: 'Foo street'
//         },
//         phones: [
//           {
//             id: 'phone1',
//             __typename: 'Phone',
//             number: '10'
//           },
//           {
//             id: 'phone2',
//             __typename: 'Phone',
//             number: '20'
//           }
//         ]
//       }
//     }
//   });

//   expect(isObjectSubset(queryCache.get(), {
//     contacts: { dummy: { address: { id: 'address1' } } }
//   })).toBeTruthy();

//   updatedDenormalizedData = setNestedProp`contacts.dummy.address.id`(denormalizedData, 'address10');
//   updatedDenormalizedData = setNestedProp`contacts.dummy.address.street`(updatedDenormalizedData, 'Some street');

//   store.initialize();

//   store.setConfig({ debug: true });

//   await store.store(updatedDenormalizedData, { onFetchArrayOfEntities });

//   queryCache.refresh();

//   expect(isObjectSubset(queryCache.get(), {
//     contacts: { dummy: { address: { id: 'address10', street: 'Some street' } } }
//   })).toBeTruthy();

//   expect(isObjectSubset(queryCache.get(), {
//     contacts: { dummy: { phones: [
//       { id: 'phone1' },
//       { id: 'phone2' }
//     ] } }
//   })).toBeTruthy();

//   updatedDenormalizedData = setNestedProp`contacts.dummy.phones[${0}].id`(denormalizedData, 'phone10');
//   updatedDenormalizedData = setNestedProp`contacts.dummy.phones[${0}].number`(updatedDenormalizedData, '42');

//   store.initialize();

//   store.setConfig({ debug: true });

//   await store.store(updatedDenormalizedData, { onFetchArrayOfEntities });

//   queryCache.refresh();

//   expect(isObjectSubset(queryCache.get(), {
//     contacts: { dummy: { phones: [
//       { id: 'phone2', number: '20' }
//     ] } }
//   })).toBeTruthy();

//   updatedDenormalizedData = deleteNestedProp`contacts.dummy.phones[${0}]`(denormalizedData, { resizeArray: true });

//   store.initialize();

//   store.setConfig({ debug: true });

//   await store.store(updatedDenormalizedData, { onFetchArrayOfEntities });

//   queryCache.refresh();

//   expect(isObjectSubset(queryCache.get(), {
//     contacts: { dummy: { phones: [
//       { id: 'phone2', number: '20' }
//     ] } }
//   })).toBeTruthy();
// });
