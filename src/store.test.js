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
      }
    }
  }
};

store.set(denormalizedData);

test('store', () => {
  const subscriber = jest.fn();

  const unsubscribe = store.subscribe(subscriber);

  expect(subscriber).toHaveBeenCalledTimes(1);

  store.set({ id: 1, __typename: 'Person', name: 'Jérôme' });

  expect(subscriber).toHaveBeenCalledTimes(2);

  store.set({ id: 1, __typename: 'Person', name: 'John' });

  expect(subscriber).toHaveBeenCalledTimes(3);

  unsubscribe();

  store.set({ id: 1, __typename: 'Person', name: 'James' });

  expect(subscriber).toHaveBeenCalledTimes(3);
});
