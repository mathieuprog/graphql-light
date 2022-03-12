import checkInvalidReferences from './checkInvalidReferences';
import store from '../index';
import { removeEntityById } from './normalize';
import checkMissingLinks from './checkMissingLinks';

beforeEach(async () => {
  store.initialize();

  store.setConfig({ debug: true });

  store.setConfig({ transformers: {
    Person: {
      references: {
        addressId: {
          type: 'Address',
          field: 'address'
        },
        phoneId: {
          type: 'Phone',
          field: 'phone'
        },
        addressIds: {
          type: 'Address',
          field: 'addresses'
        }
      }
    }
  } });

  await store.store({
    id: 'address1',
    __typename: 'Address',
    street: 'Foo'
  });

  await store.store({
    id: 'phone1',
    __typename: 'Phone',
    number: '111'
  });

  await store.store({
    id: 'person1',
    __typename: 'Person',
    foo: [{ phoneId: 'phone1' }],
    bar: [[{ addressIds: ['address1'] }]],
    addressId: 'address1'
  });
});

afterEach(() => {
  expect(checkMissingLinks({}, store)).toEqual({});
});

test('no invalid references', () => {
  expect(checkInvalidReferences({}, store)).toEqual({});
});

test('invalid reference', () => {
  delete store.entities.person1.address;

  expect(() => checkInvalidReferences({}, store)).toThrow(/no field/);
});

test('reference doesn\'t match', () => {
  store.entities.person1.addressId = 'whatever';

  expect(() => checkInvalidReferences({}, store)).toThrow(/doesn't match/);
});

test('invalid array of ids', () => {
  delete store.entities.person1.bar[0][0].addresses;

  expect(() => checkInvalidReferences({}, store)).toThrow(/no field/);
});

test('array of ids doesn\'t match', () => {
  store.entities.person1.bar[0][0].addresses[0] = {
    ...store.entities.person1.bar[0][0].addresses[0],
    id: 'whatever'
  };

  expect(() => checkInvalidReferences({}, store)).toThrow(/don't match/);
});

test('invalid reference after deleting entity', async () => {
  const entity = {
    id: 'person1',
    __typename: 'Person',
    name: 'John',
    addressId: 'address1',
    bar: [[{ addressIds: ['address1', 'address2'] }]],
    foo: [{
      phoneId: 'phone1'
    }]
  };

  const onFetchEntity = normalizedEntity => {
    if (normalizedEntity.id === 'address1' || normalizedEntity.id === 'phone1') {
      return removeEntityById(normalizedEntity.id);
    }
  };

  const onFetchArrayOfEntities = (propName, _object) => {
    switch (propName) {
      case 'addresses':
        return 'append';
    }
  };

  const onMissingRelation = (_propName, _propValue, _object, _variables, _data) => {
    return store.store({
      id: 'address2',
      __typename: 'Address',
      street: 'Bar'
    });
  };

  await store.store(entity, { onFetchEntity, onFetchArrayOfEntities, onMissingRelation });

  const entities = store.getEntities();

  expect(Object.keys(entities.person1.bar[0][0].addresses).length).toBe(1);
});
