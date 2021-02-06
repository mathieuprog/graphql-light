import store from './store';

const denormalizedData = {
  id: 'person1',
  __typename: 'Person',
  name: 'Mathieu',
  articles: [[ // just testing nested arrays
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
          label: 'bar'
        },
        {
          id: 'tag3',
          __typename: 'Tag',
          label: 'foobar'
        },
      ],
      __onReplace: { tags: 'override' },
    }
  ]],
  __onReplace: { articles: 'append' },
  contacts: {
    dummy: {
      address: {
        id: 'address1',
        __typename: 'Address',
        title: 'Foo street'
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
};

test('transform before storing', () => {
  store.store(denormalizedData);

  const entities = store.getEntities();

  expect(entities['person1'].contacts.dummy.phones.length).toBe(2);
  expect(typeof entities['person1'].contacts.dummy.phones[0].number).toBe('string');

  store.setConfig({
    transform: entity => {
      switch (entity.__typename) {
        case 'Phone':
          return {
            ...entity,
            number: Number(entity.number)
          };

        default:
          return entity;
      }
    }});

  store.store(denormalizedData);

  expect(typeof entities['person1'].contacts.dummy.phones[0].number).toBe('number');
});

test('store', () => {
  store.store(denormalizedData);

  const subscriber = jest.fn();

  const unsubscribe = store.subscribe(subscriber);

  expect(subscriber).toHaveBeenCalledTimes(1);

  store.store({ id: 'person2', __typename: 'Person', name: 'Jérôme' });

  expect(subscriber).toHaveBeenCalledTimes(2);

  store.store({ id: 'person3', __typename: 'Person', name: 'John' });

  expect(subscriber).toHaveBeenCalledTimes(3);

  unsubscribe();

  store.store({ id: 'person4', __typename: 'Person', name: 'James' });

  expect(subscriber).toHaveBeenCalledTimes(3);
});
