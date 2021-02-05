import createProxy from './create_proxy';
import normalizeAndStore from './normalize_and_store';
import store from './store';

const address1 = {
  id: 'address1',
  __typename: 'Address',
  street: 'Foo street'
};

const address2 = {
  id: 'address2',
  __typename: 'Address',
  street: 'Bar street'
};

const phone1 = {
  id: 'phone1',
  __typename: 'Phone',
  number: '10'
};

const phone2 = {
  id: 'phone2',
  __typename: 'Phone',
  number: '20'
};

const phone3 = {
  id: 'phone3',
  __typename: 'Phone',
  number: '30'
};

const person1 = {
  id: 'person1',
  __typename: 'Person',
  name: 'Mathieu',
  age: 37
};

const article1 = {
  id: 'article1',
  __typename: 'Article',
  title: 'Hello!'
};

const article2 = {
  id: 'article2',
  __typename: 'Article',
  title: 'World!'
};

const article3 = {
  id: 'article3',
  __typename: 'Article',
  title: 'Foo'
};

const article4 = {
  id: 'article4',
  __typename: 'Article',
  title: 'Bar'
};

beforeEach(() => {
  store.initialize({
    [person1.id]: {
      ...person1,
      articles: [
        createProxy(article1),
        createProxy(article2),
        createProxy(article3)
      ],
      contacts: {
        dummy: {
          address: createProxy(address1),
          phones: [
            createProxy(phone1),
            createProxy(phone2)
          ]
        }
      },
      otherContacts: [[ // just testing nested arrays
        {
          address: createProxy(address1),
          phones: [
            createProxy(phone1),
            createProxy(phone2)
          ]
        },
        {
          address: createProxy(address1),
          phones: [
            createProxy(phone1),
            createProxy(phone2)
          ]
        }
      ]],
      objectLiteral: { foo: 'hello', bar: 'world' },
      arrayOfPrimitives: [4, 2]
    },
    [article1.id]: article1,
    [article2.id]: article2,
    [article3.id]: article3,
    [address1.id]: address1,
    [phone1.id]: phone1,
    [phone2.id]: phone2
  });
});

test('normalize and store', () => {
  const entity = {
    ...person1,
    name: 'John',
    articles: [
      {
        ...article1,
        title: 'My article',
        __delete: true
      },
      {
        ...article2,
        __unlink: true
      },
      {
        ...article4,
        title: 'Another article',
      }
    ],
    __onReplace: { articles: 'append' },
    contacts: {
      dummy: {
        address: address2,
        phones: [
          phone3
        ],
        __onReplace: { phones: 'append' }
      }
    },
    otherContacts: [[ // just testing nested arrays
      {
        address: address2,
        phones: [
          phone3
        ],
        __onReplace: { phones: 'override' }
      },
      {
        address: address1,
        phones: [
          phone3
        ],
        __onReplace: { phones: 'append' }
      }
    ]],
    objectLiteral: {
      bar: 'world!'
    },
    arrayOfPrimitives: [1, 2]
  };

  normalizeAndStore(entity);

  const store = getGraphQLCache();

  expect(Object.keys(store).length).toBe(9);
  expect(store['person1'].articles.length).toBe(2);
  expect(store['person1'].otherContacts[0][0].phones.length).toBe(1);
  expect(store['person1'].otherContacts[0][1].phones.length).toBe(3);
});
