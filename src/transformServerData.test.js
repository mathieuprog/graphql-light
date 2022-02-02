import transformServerData from './transformServerData';
import transform from './transform';
import { deepFreeze } from './utils';

const denormalizedData = deepFreeze({
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
  ]],
  __onArray: { articles: 'append' },
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

test('transform', () => {
  const transformers = {
    transformPhone: entity =>
      transform(entity, {
        number: Number
      }),
    transformTag: entity =>
      transform(entity, {
        label: value => value.toUpperCase()
      })
  };

  const transformedData = transformServerData(transformers, denormalizedData);

  expect(transformedData.articles[0][0].tags[0].label).toBe('FOO');
  expect(denormalizedData.articles[0][0].tags[0].label).toBe('foo');

  expect(transformedData.contacts.dummy.phones[0].number).toBe(10);
  expect(denormalizedData.contacts.dummy.phones[0].number).toBe('10');
});
