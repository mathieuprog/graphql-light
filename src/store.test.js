import store from './store';
import transform from './transform';

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
  ]],
  __onReplace: { articles: 'append' },
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
};

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

  expect(Object.keys(getGraphQLCache()).length).toBe(12);
  expect(Object.keys(getGraphQLCache({ id: 'tag1' })).length).toBe(1);
  expect(Object.keys(getGraphQLCache({ __typename: 'Tag' })).length).toBe(3);
  expect(Object.keys(getGraphQLCache({ __typename: 'Tag', label: 'foo' })).length).toBe(2);
  expect(Object.keys(getGraphQLCache({ contacts: { dummy: { address: { street: 'Foo street' } } } })).length).toBe(1);
  expect(Object.keys(getGraphQLCache({ contacts: { dummy: { address: { street: 'Bar street' } } } })).length).toBe(0);
  expect(Object.keys(getGraphQLCache({ contacts: { dummy: { address: { zip: 'Foo street' } } } })).length).toBe(0);
});
