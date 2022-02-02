import cleanDenormalized from './cleanDenormalized';

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
          label: 'foo',
          __delete: true
        },
        {
          id: 'tag3',
          __typename: 'Tag',
          label: 'foobar',
          __unlink: false
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
          label: 'foo',
          __delete: false
        },
        {
          id: 'tag3',
          __typename: 'Tag',
          label: 'foobar',
          __unlink: true
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
};

test('clean', () => {
  expect(denormalizedData.__onArray).toBeTruthy();
  expect(denormalizedData.articles[0][0].__onArray).toBeTruthy();
  expect(denormalizedData.articles[0][0].tags.length).toBe(2);
  expect(denormalizedData.articles[0][1].tags.length).toBe(2);

  cleanDenormalized(denormalizedData);

  expect(denormalizedData.__onArray).toBe(undefined);
  expect(denormalizedData.articles[0][0].__onArray).toBe(undefined);
  expect(denormalizedData.articles[0][0].tags.length).toBe(1);
  expect(denormalizedData.articles[0][1].tags.length).toBe(1);
});
