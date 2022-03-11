import checkInvalidReferences from './checkInvalidReferences';
import store from '../index';

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
    id: 'person1',
    __typename: 'Person',
    addressId: 'address1',
    addressIds: ['address1']
  });
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
  delete store.entities.person1.addresses;

  expect(() => checkInvalidReferences({}, store)).toThrow(/no field/);
});

test('array of ids doesn\'t match', () => {
  store.entities.person1.addresses[0] = 'whatever';

  expect(() => checkInvalidReferences({}, store)).toThrow(/don't match/);
});
