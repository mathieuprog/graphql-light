import proxifyReferences from './proxifyReferences';
import store from '../index';
import { deepFreeze, isEntityProxy } from '../../utils';
import Query from '../../query/Query';
import FetchStrategy from '../../constants/FetchStrategy';
import checkMissingLinks from './checkMissingLinks';
import checkInvalidReferences from './checkInvalidReferences';

const denormalizedData = deepFreeze({
  id: 'address1',
  __typename: 'Address',
  street: 'Foo'
});

beforeEach(() => {
  store.initialize();

  store.setConfig({ debug: true });

  return store.store(denormalizedData);
});

afterEach(() => {
  expect(checkMissingLinks({}, store)).toEqual({});
  expect(checkInvalidReferences({}, store)).toEqual({});
});

test('proxify references', async () => {
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
        countryId: {
          type: 'Country',
          field: 'country'
        },
        countryIds: {
          type: 'Country',
          field: 'countries'
        },
        friendIds: {
          type: 'Friend',
          field: 'friends'
        },
        typeId: {
          type: 'Type',
          field: 'type'
        },
        accountIds: {
          type: 'Account',
          field: 'accounts'
        },
        accounts: {
          type: 'Account',
          field: 'accounts'
        },
        calendarId: {
          type: 'Calendar',
          field: 'calendar'
        },
      }
    }
  } });

  await store.store({
    id: 'type1',
    __typename: 'Type'
  });

  await store.store({
    id: 'account1',
    __typename: 'Account'
  });

  await store.store({
    id: 'country2',
    __typename: 'Country'
  });

  const person = deepFreeze({
    id: 'person1',
    __typename: 'Person',
    name: 'Mathieu',
    country: {
      id: 'country1',
      __typename: 'Country',
      name: 'Belgium'
    },
    countries: [{
      id: 'country1',
      __typename: 'Country',
      name: 'Belgium'
    }],
    friends: [],
    typeId: 'type1',
    contacts: {
      dummy: {
        countryId: 'country2',
        phoneId: null,
        address: {
          id: 'address1',
          __typename: 'Address',
          street: 'Bar'
        },
        addressIds: ['address1']
      }
    },
    accounts: [{
      id: 'account1'
    }],
    calendar: null
  });

  const onFetchArrayOfEntities = (propName) => {
    switch (propName) {
      case 'countries':
        return 'append';

      case 'addressIds':
        return 'append';

      case 'accounts':
        return 'append';
    }
  };

  const { denormalizedData: transformedData } = await store.store(person, { onFetchArrayOfEntities });

  expect(transformedData.contacts.dummy.addressId).toBe('address1');
  expect(store.entities.person1.contacts.dummy.addressId).toBe('address1');
  expect(person.contacts.dummy.addressId).toBeUndefined();

  expect(transformedData.contacts.dummy.address).toBeTruthy();
  expect(store.entities.person1.contacts.dummy.address).toBeTruthy();
  expect(transformedData.contacts.dummy.address.id).toBe('address1');
  expect(store.entities.person1.contacts.dummy.address.id).toBe('address1');
  expect(transformedData.contacts.dummy.address.__typename).toBe('Address');
  expect(store.entities.person1.contacts.dummy.address.__typename).toBe('Address');
  expect(isEntityProxy(transformedData.contacts.dummy.country)).toBeTruthy();
  expect(isEntityProxy(store.entities.person1.contacts.dummy.country)).toBeTruthy();
  expect(person.contacts.dummy.address).toBeTruthy();

  expect(transformedData.contacts.dummy.addresses).toBeTruthy();
  expect(store.entities.person1.contacts.dummy.addresses).toBeTruthy();
  expect(transformedData.contacts.dummy.addresses.length).toBe(1);
  expect(store.entities.person1.contacts.dummy.addresses.length).toBe(1);
  expect(transformedData.contacts.dummy.addresses[0].id).toBe('address1');
  expect(store.entities.person1.contacts.dummy.addresses[0].id).toBe('address1');
  expect(person.contacts.dummy.addresses).toBeUndefined();

  expect(transformedData.contacts.dummy.addressId).toBe('address1');
  expect(store.entities.person1.contacts.dummy.addressId).toBe('address1');

  expect(transformedData.contacts.dummy.phone).toBeNull();
  expect(store.entities.person1.contacts.dummy.phone).toBeNull();
  expect(person.contacts.dummy.phone).toBeUndefined();

  expect(transformedData.type).toEqual({ id: 'type1', __typename: 'Type' });
  expect(person.type).toBeUndefined();
  expect(store.entities.person1.type.id).toBe('type1');
  expect(store.entities.person1.typeId).toBe('type1');

  expect(transformedData.countryId).toBe('country1');
  expect(person.countryId).toBeUndefined();
  expect(store.entities.person1.countryId).toBe('country1');
  expect(store.entities.person1.country.id).toBe('country1');

  expect(transformedData.countryIds).toEqual(['country1']);
  expect(person.countryIds).toBeUndefined();
  expect(store.entities.person1.countryIds).toEqual(['country1']);

  expect(store.entities.person1.countries[0].id).toBe('country1');
  expect(store.entities.person1.countries.length).toBe(1);

  expect(transformedData.friendIds).toEqual([]);
  expect(person.friendIds).toBeUndefined();
  expect(store.entities.person1.friendIds).toEqual([]);

  expect(transformedData.accountIds).toEqual(['account1']);
  expect(store.entities.person1.accountIds).toEqual(['account1']);

  expect(transformedData.accounts).toEqual([{ id: 'account1', __typename: 'Account' }]);
  expect(store.entities.person1.accounts).toEqual([{ id: 'account1', __typename: 'Account' }]);

  expect(transformedData.calendarId).toBeNull();
  expect(transformedData.calendar).toBeNull();
  expect(person.calendarId).toBeUndefined();
  expect(person.calendar).toBeNull();
  expect(store.entities.person1.calendarId).toBeNull();
  expect(store.entities.person1.calendar).toBeNull();
});

test('empty arrays', async () => {
  store.setConfig({ transformers: {
    Person: {
      references: {
        phones: {
          type: 'Phone',
          field: 'phones'
        },
        addressIds: {
          type: 'Address',
          field: 'addresses'
        }
      }
    }
  } });

  const person = deepFreeze({
    id: 'person1',
    __typename: 'Person',
    name: 'Mathieu',
    phones: [],
    addressIds: []
  });

  const { denormalizedData: transformedData } = await proxifyReferences({ denormalizedData: person }, store);

  expect(transformedData.addressIds).toEqual([]);
  expect(person.addressIds).toEqual([]);
  expect(transformedData.phones).toEqual([]);
  expect(person.phones).toEqual([]);
  expect(transformedData.addresses).toEqual([]);
  expect(person.addresses).toBeUndefined();

  expect(transformedData.undefined).toBeUndefined();
  expect(person.undefined).toBeUndefined();
});

test('missing reference', async () => {
  store.initialize();

  store.setConfig({ debug: true });

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

  store.setConfig({ debug: true });

  store.setConfig({ transformers: {
    Person: {
      references: {
        addressId: {
          type: 'Address',
          field: 'address',
          handleMissing() { return null }
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

test('field contains only ids', async () => {
  store.initialize();

  store.setConfig({ debug: true });

  await store.store([
    {
      id: 'address1',
      __typename: 'Address',
      street: 'Foo'
    }, {
      id: 'address2',
      __typename: 'Address',
      street: 'Bar'
    }
  ]);

  store.setConfig({ transformers: {
    Person: {
      references: {
        addressIds: {
          type: 'Address',
          field: 'addresses'
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

  const onFetchArrayOfEntities = (propName) => {
    switch (propName) {
      case 'addressIds':
        return 'append';
    }
  };

  const { denormalizedData: transformedData } = await store.store(person, { onFetchArrayOfEntities });

  expect(transformedData.contacts.dummy.addressIds).toEqual(['address1', 'address2']);
  expect(store.entities.person1.contacts.dummy.addressIds).toEqual(['address1', 'address2']);
  expect(transformedData.contacts.dummy.addresses[0].id).toBe('address1');
  expect(store.entities.person1.contacts.dummy.addresses[0].id).toBe('address1');
  expect(transformedData.contacts.dummy.addresses[0].__typename).toBe('Address');
  expect(store.entities.person1.contacts.dummy.addresses[0].__typename).toBe('Address');
  expect(isEntityProxy(transformedData.contacts.dummy.addresses[0])).toBeTruthy();
});

test('field contains only ids (2)', async () => {
  store.initialize();

  store.setConfig({ debug: true });

  store.setConfig({ transformers: {
    Person: {
      references: {
        addresses: {
          type: 'Address',
          field: 'addresses'
        }
      }
    }
  } });

  const onFetchArrayOfEntities = (propName) => {
    switch (propName) {
      case 'addresses':
        return 'append';
    }
  };

  await store.store([
    {
      id: 'address1',
      __typename: 'Address',
      street: 'Foo'
    }, {
      id: 'address2',
      __typename: 'Address',
      street: 'Bar'
    }, {
      id: 'address3',
      __typename: 'Address',
      street: 'Baz'
    }
  ]);

  await store.store([
    {
      id: 'person1',
      __typename: 'Person',
      name: 'Mathieu',
      contacts: {
        dummy: {
          addresses: [
            { id: 'address1' },
            { id: 'address3' }
          ]
        }
      }
    }
  ], { onFetchArrayOfEntities });

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

  const { denormalizedData: transformedData } = await store.store(person, { onFetchArrayOfEntities });

  expect(transformedData.contacts.dummy.addresses[0].id).toBe('address1');
  expect(store.entities.person1.contacts.dummy.addresses.length).toBe(3);
  expect(store.entities.person1.contacts.dummy.addresses.map(({ id }) => id)).toEqual(['address3', 'address1', 'address2']);
  expect(store.entities.person1.contacts.dummy.addresses.map(({ __typename }) => __typename)).toEqual(['Address', 'Address', 'Address']);
  expect(transformedData.contacts.dummy.addresses[0].__typename).toBe('Address');
  expect(store.entities.person1.contacts.dummy.addresses[0].__typename).toBe('Address');
  expect(isEntityProxy(transformedData.contacts.dummy.addresses[0])).toBeTruthy();
});

test('missing reference in array', async () => {
  store.initialize();

  store.setConfig({ debug: true });

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
          type: 'Address',
          field: 'addresses'
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

  store.setConfig({ debug: true });

  await store.store({
    id: 'address2',
    __typename: 'Address',
    street: 'Foo'
  });

  store.setConfig({ transformers: {
    Person: {
      references: {
        addresses: {
          type: 'Address',
          field: 'addresses',
          handleMissing() {}
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

  store.setConfig({ debug: true });

  await store.store({});

  const client = {
    request(_document, _variables) {
      return {
        id: 'address1',
        __typename: 'Address',
        street: 'Foo'
      };
    }
  };
  const query = new Query(client, null);
  const onMissingRelation = (_propName, _propValue, _object, _variables, _data) => {
    return query.query({}, { fetchStrategy: FetchStrategy.NETWORK_ONLY });
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

  store.setConfig({ debug: true });

  await store.store({
    id: 'address2',
    __typename: 'Address',
    street: 'Foo'
  });

  const client = {
    request(_document, _variables) {
      return {
        id: 'address1',
        __typename: 'Address',
        street: 'Foo'
      };
    }
  };
  const query = new Query(client, null);
  const onMissingRelation = (_propName, _propValue, _object, _variables, _data) => {
    return query.query({}, { fetchStrategy: FetchStrategy.NETWORK_ONLY });
  };

  store.setConfig({ transformers: {
    Person: {
      references: {
        addresses: {
          type: 'Address',
          field: 'addresses'
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

test('list of entities inside nested entity', async () => {
  store.setConfig({ transformers: {
    Person: {
      references: {
        friendIds: {
          type: 'Friend',
          field: 'friends'
        }
      }
    },
    Friend: {
      references: {
        recommendationIds: {
          type: 'Recommendation',
          field: 'recommendations'
        }
      }
    }
  } });

  const person = deepFreeze({
    id: 'person1',
    __typename: 'Person',
    friends: [
      {
        id: 'friend1',
        __typename: 'Friend',
        name: 'John',
        recommendations: [
          {
            id: 'recommendation1',
            __typename: 'Recommendation',
            text: 'A recommendation'
          }
        ]
      }
    ]
  });

  const { denormalizedData: transformedData } = await proxifyReferences({ denormalizedData: person }, store);

  expect(transformedData.friends[0].id).toEqual('friend1');
  expect(transformedData.friendIds).toEqual(['friend1']);

  expect(transformedData.friends[0].recommendations[0].id).toEqual('recommendation1');
  expect(transformedData.friends[0].recommendationIds).toEqual(['recommendation1']);
});
