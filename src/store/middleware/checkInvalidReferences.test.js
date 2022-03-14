import checkInvalidReferences from './checkInvalidReferences';
import store from '../index';
import { removeEntityById } from './normalize';
import checkMissingLinks from './checkMissingLinks';
import { areArraysEqual } from '../../utils';

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
        },
        addresses: {
          type: 'Address'
        },
        typeId: {
          type: 'Type',
          field: 'type'
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
    id: 'address3',
    __typename: 'Address',
    street: 'Bar'
  });

  await store.store({
    id: 'phone1',
    __typename: 'Phone',
    number: '111'
  });

  await store.store({
    id: 'type1',
    __typename: 'Type'
  });

  await store.store({
    id: 'type2',
    __typename: 'Type'
  });

  await store.store({
    id: 'person1',
    __typename: 'Person',
    foo: [{ phoneId: 'phone1' }],
    bar: [[{ addressIds: ['address1'] }]],
    addressId: 'address1',
    typeId: 'type1'
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

  expect(areArraysEqual(entities.person1.bar[0][0].addresses, [{ id: 'address2' }]));
});

test('invalid reference after deleting entity (2)', async () => {
  const entity = {
    id: 'person1',
    __typename: 'Person',
    name: 'John',
    addressId: 'address1',
    bar: [[{ addresses: [{ id: 'address1' }, { id: 'address2' }] }]]
  };

  const onFetchEntity = normalizedEntity => {
    if (normalizedEntity.id === 'address1') {
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

  expect(areArraysEqual(entities.person1.bar[0][0].addresses, [{ id: 'address2' }]));
});

test('invalid reference after deleting entity (3)', async () => {
  const entity = {
    id: 'person1',
    __typename: 'Person',
    name: 'John',
    addressId: 'address1',
    bar: [[{ addresses: [{ id: 'address1', __typename: 'Address' }, { id: 'address2', __typename: 'Address' }] }]]
  };

  const onFetchEntity = normalizedEntity => {
    if (normalizedEntity.id === 'address1') {
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

  expect(areArraysEqual(entities.person1.bar[0][0].addresses, [{ id: 'address2' }]));
});

test('change referenced entity', async () => {
  const entity = {
    id: 'person1',
    __typename: 'Person',
    typeId: 'type2'
  };

  expect(store.entities.person1.typeId).toBe('type1');

  await store.store(entity);

  expect(store.entities.person1.typeId).toBe('type2');
});

test('change referenced entity (2)', async () => {
  expect(store.entities.person1.typeId).toBe('type1');

  const entity = {
    id: 'person1',
    __typename: 'Person',
    type: { id: 'type2', __typename: 'Type' }
  };

  await store.store(entity);

  expect(store.entities.person1.typeId).toBe('type2');
});

test('invalid reference after changing nested entity', async () => {
  expect(store.entities.person1.addressId).toBe('address1');
  expect(store.entities.person1.address.id).toBe('address1');

  const entity = {
    id: 'person1',
    __typename: 'Person',
    name: 'John',
    address: {
      __typename: 'Address',
      id: 'address3'
    }
  };

  await store.store(entity);

  expect(store.entities.person1.addressId).toBe('address3');
  expect(store.entities.person1.address.id).toBe('address3');
});

test('invalid reference after changing nested entity (2)', async () => {
  expect(store.entities.person1.addressId).toBe('address1');
  expect(store.entities.person1.address.id).toBe('address1');

  const entity = {
    id: 'person1',
    __typename: 'Person',
    name: 'John',
    addressId: 'address3'
  };

  await store.store(entity);

  expect(store.entities.person1.addressId).toBe('address3');
  expect(store.entities.person1.address.id).toBe('address3');
});

test('invalid reference after changing nested array of entities', async () => {
  expect(areArraysEqual(store.entities.person1.bar[0][0].addressIds, ['address1']));
  expect(areArraysEqual(store.entities.person1.bar[0][0].addresses, [{ id: 'address1' }]));

  const entity = {
    id: 'person1',
    __typename: 'Person',
    name: 'John',
    bar: [[{ addressIds: ['address3'] }]]
  };

  const onFetchArrayOfEntities = (propName, _object) => {
    switch (propName) {
      case 'addresses':
        return 'append';
    }
  };

  await store.store(entity, { onFetchArrayOfEntities });

  expect(areArraysEqual(store.entities.person1.bar[0][0].addressIds, ['address1', 'address3']));
  expect(areArraysEqual(store.entities.person1.bar[0][0].addresses, [{ id: 'address1' }, { id: 'address3' }]));
});

test('invalid reference after changing nested array of entities (2)', async () => {
  expect(areArraysEqual(store.entities.person1.bar[0][0].addressIds, ['address1']));
  expect(areArraysEqual(store.entities.person1.bar[0][0].addresses, [{ id: 'address1' }]));

  const entity = {
    id: 'person1',
    __typename: 'Person',
    name: 'John',
    bar: [[{ addresses: [{ id: 'address3' }] }]]
  };

  const onFetchArrayOfEntities = (propName, _object) => {
    switch (propName) {
      case 'addresses':
        return 'append';
    }
  };

  await store.store(entity, { onFetchArrayOfEntities });

  expect(areArraysEqual(store.entities.person1.bar[0][0].addressIds, ['address1', 'address3']));
  expect(areArraysEqual(store.entities.person1.bar[0][0].addresses, [{ id: 'address1' }, { id: 'address3' }]));
});

test('invalid reference after changing nested array of entities (3)', async () => {
  expect(areArraysEqual(store.entities.person1.bar[0][0].addressIds, ['address1']));
  expect(areArraysEqual(store.entities.person1.bar[0][0].addresses, [{ id: 'address1' }]));

  const entity = {
    id: 'person1',
    __typename: 'Person',
    name: 'John',
    bar: [[{ addresses: [{ id: 'address3', __typename: 'Address' }] }]]
  };

  const onFetchArrayOfEntities = (propName, _object) => {
    switch (propName) {
      case 'addresses':
        return 'append';
    }
  };

  await store.store(entity, { onFetchArrayOfEntities });

  expect(areArraysEqual(store.entities.person1.bar[0][0].addressIds, ['address1', 'address3']));
  expect(areArraysEqual(store.entities.person1.bar[0][0].addresses, [{ id: 'address1' }, { id: 'address3' }]));
});
