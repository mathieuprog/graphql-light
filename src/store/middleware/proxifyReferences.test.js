import proxifyReferences from './proxifyReferences';
import store from '../index';
import { deepFreeze, isEntityProxy } from '../../utils';
import Query from '../../query/Query';
import FetchStrategy from '../../constants/FetchStrategy';

const denormalizedData = deepFreeze({
  id: 'address1',
  __typename: 'Address',
  street: 'Foo'
});

beforeEach(async () => {
  store.initialize();
  await store.store(denormalizedData);
});

test('proxify references', async () => {
  store.setConfig({ transformers: {
    Person: {
      references: {
        addressId: {
          type: 'Address',
          field: 'address',
        }
      }
    }
  } });

  const person = deepFreeze({
    id: 'person1',
    __typename: 'Person',
    name: 'Mathieu',
    contacts: {
      dummy: {
        addressId: 'address1'
      }
    }
  });

  const { denormalizedData: transformedData } = await proxifyReferences({ denormalizedData: person }, store);

  expect(transformedData.contacts.dummy.addressId).toBe('address1');
  expect(person.contacts.dummy.addressId).toBe('address1');

  expect(transformedData.contacts.dummy.address).toBeTruthy();
  expect(transformedData.contacts.dummy.address.id).toBe('address1');
  expect(transformedData.contacts.dummy.address.__typename).toBe('Address');
  expect(isEntityProxy(transformedData.contacts.dummy.address)).toBeTruthy();
  expect(person.contacts.dummy.address).toBeUndefined();

  expect(transformedData.contacts.dummy.addressId).toBe('address1');
  expect(person.contacts.dummy.addressId).toBe('address1');
});

test('missing reference', async () => {
  store.initialize();

  const onMissingRelation = (_propName, _propValue, _object, _variables, _data) => {};

  store.setConfig({ transformers: {
    Person: {
      references: {
        addressId: {
          type: 'Address',
          field: 'address'
        }
      }
    }
  } });
  await store.store({});

  const person = deepFreeze({
    id: 'person1',
    __typename: 'Person',
    name: 'Mathieu',
    contacts: {
      dummy: {
        addressId: 'address1'
      }
    }
  });

  const { denormalizedData: transformedData } = await proxifyReferences({ denormalizedData: person }, store, { onMissingRelation });

  expect(transformedData.contacts.dummy.address).toBeNull();
  expect(transformedData.contacts.dummy.addressId).toBeNull();
  expect(person.contacts.dummy.addressId).toBe('address1');
});

test('missing reference and no handleMissing callback', async () => {
  store.initialize();
  store.setConfig({ transformers: {
    Person: {
      references: {
        addressId: {
          type: 'Address',
          field: 'address'
        }
      }
    }
  } });
  await store.store({});

  const person = deepFreeze({
    id: 'person1',
    __typename: 'Person',
    name: 'Mathieu',
    contacts: {
      dummy: {
        addressId: 'address1'
      }
    }
  });

  const { denormalizedData: transformedData } = await proxifyReferences({ denormalizedData: person }, store);

  expect(transformedData.contacts.dummy.address).toBeNull();
  expect(transformedData.contacts.dummy.addressId).toBeNull();
  expect(person.contacts.dummy.addressId).toBe('address1');
});

test('missing reference in array', async () => {
  store.initialize();

  await store.store({
    id: 'address2',
    __typename: 'Address',
    street: 'Foo'
  });

  const onMissingRelation = (_propName, _propValue, _object, _variables, _data) => {};

  store.setConfig({ transformers: {
    Person: {
      references: {
        addresses: {
          type: 'Address'
        }
      }
    }
  } });

  const person = deepFreeze({
    id: 'person1',
    __typename: 'Person',
    name: 'Mathieu',
    contacts: {
      dummy: {
        addresses: [{ id: 'address1' }, { id: 'address2' }]
      }
    }
  });

  const { denormalizedData: transformedData } = await proxifyReferences({ denormalizedData: person }, store, { onMissingRelation });

  expect(transformedData.contacts.dummy.addresses.length).toBe(1);
  expect(transformedData.contacts.dummy.addresses[0].id).toBe('address2');
  expect(transformedData.contacts.dummy.addresses[0].__typename).toBe('Address');
  expect(isEntityProxy(transformedData.contacts.dummy.addresses[0])).toBeTruthy();
});

test('missing reference in array no handleMissing callback', async () => {
  store.initialize();

  await store.store({
    id: 'address2',
    __typename: 'Address',
    street: 'Foo'
  });

  store.setConfig({ transformers: {
    Person: {
      references: {
        addresses: {
          type: 'Address'
        }
      }
    }
  } });

  const person = deepFreeze({
    id: 'person1',
    __typename: 'Person',
    name: 'Mathieu',
    contacts: {
      dummy: {
        addresses: [{ id: 'address1' }, { id: 'address2' }]
      }
    }
  });

  const { denormalizedData: transformedData } = await proxifyReferences({ denormalizedData: person }, store);

  expect(transformedData.contacts.dummy.addresses.length).toBe(1);
  expect(transformedData.contacts.dummy.addresses[0].id).toBe('address2');
  expect(transformedData.contacts.dummy.addresses[0].__typename).toBe('Address');
  expect(isEntityProxy(transformedData.contacts.dummy.addresses[0])).toBeTruthy();
});

test('fetch missing reference', async () => {
  store.initialize();

  await store.store({});

  const client = {
    request(_queryDocument, _variables) {
      return {
        id: 'address1',
        __typename: 'Address',
        street: 'Foo'
      };
    }
  };
  const query = new Query(client, null);
  const onMissingRelation = async (_propName, _propValue, _object, _variables, _data) => {
    await query.query({}, { fetchStrategy: FetchStrategy.NETWORK_ONLY });
  };

  store.setConfig({ transformers: {
    Person: {
      references: {
        addressId: {
          type: 'Address',
          field: 'address'
        }
      }
    }
  } });

  const person = deepFreeze({
    id: 'person1',
    __typename: 'Person',
    name: 'Mathieu',
    contacts: {
      dummy: {
        addressId: 'address1'
      }
    }
  });

  const { denormalizedData: transformedData } = await proxifyReferences({ denormalizedData: person }, store, { onMissingRelation });

  expect(transformedData.contacts.dummy.addressId).toBe('address1');
  expect(person.contacts.dummy.addressId).toBe('address1');

  expect(transformedData.contacts.dummy.address).toBeTruthy();
  expect(transformedData.contacts.dummy.address.id).toBe('address1');
  expect(transformedData.contacts.dummy.address.__typename).toBe('Address');
  expect(isEntityProxy(transformedData.contacts.dummy.address)).toBeTruthy();
  expect(person.contacts.dummy.address).toBeUndefined();

  expect(transformedData.contacts.dummy.addressId).toBe('address1');
  expect(person.contacts.dummy.addressId).toBe('address1');
});

test('fetch missing reference in array', async () => {
  store.initialize();

  await store.store({
    id: 'address2',
    __typename: 'Address',
    street: 'Foo'
  });

  const client = {
    request(_queryDocument, _variables) {
      return {
        id: 'address1',
        __typename: 'Address',
        street: 'Foo'
      };
    }
  };
  const query = new Query(client, null);
  const onMissingRelation = async (_propName, _propValue, _object, _variables, _data) => {
    await query.query({}, { fetchStrategy: FetchStrategy.NETWORK_ONLY });
  };

  store.setConfig({ transformers: {
    Person: {
      references: {
        addresses: {
          type: 'Address'
        }
      }
    }
  } });

  const person = deepFreeze({
    id: 'person1',
    __typename: 'Person',
    name: 'Mathieu',
    contacts: {
      dummy: {
        addresses: [{ id: 'address1' }, { id: 'address2' }]
      }
    }
  });

  const { denormalizedData: transformedData } = await proxifyReferences({ denormalizedData: person }, store, { onMissingRelation });

  expect(transformedData.contacts.dummy.addresses.length).toBe(2);
  expect(transformedData.contacts.dummy.addresses[0].id).toBe('address1');
  expect(transformedData.contacts.dummy.addresses[0].__typename).toBe('Address');
  expect(isEntityProxy(transformedData.contacts.dummy.addresses[0])).toBeTruthy();
  expect(transformedData.contacts.dummy.addresses.length).toBe(2);
  expect(transformedData.contacts.dummy.addresses[1].id).toBe('address2');
  expect(transformedData.contacts.dummy.addresses[1].__typename).toBe('Address');
  expect(isEntityProxy(transformedData.contacts.dummy.addresses[1])).toBeTruthy();
});
