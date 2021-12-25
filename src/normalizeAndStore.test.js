import createProxy from './createProxy';
import normalizeAndStore from './normalizeAndStore';
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

const comment1 = {
  id: 'comment1',
  __typename: 'Comment',
  text: 'A comment'
};

const comment2 = {
  id: 'comment2',
  __typename: 'Comment',
  text: 'Another comment'
};

const article1 = {
  id: 'article1',
  __typename: 'Article',
  title: 'Hello!',
  comments: [
    createProxy(comment1, store.getEntityById.bind(store)),
    createProxy(comment2, store.getEntityById.bind(store))
  ]
};

comment1.article = createProxy(article1, store.getEntityById.bind(store));
comment2.article = createProxy(article1, store.getEntityById.bind(store));

const article2 = {
  id: 'article2',
  __typename: 'Article',
  title: 'World!',
  comments: []
};

const article3 = {
  id: 'article3',
  __typename: 'Article',
  title: 'Foo',
  comments: []
};

const article4 = {
  id: 'article4',
  __typename: 'Article',
  title: 'Bar',
  comments: []
};

beforeEach(() => {
  store.initialize({
    [person1.id]: {
      ...person1,
      articles: [
        createProxy(article1, store.getEntityById.bind(store)),
        createProxy(article2, store.getEntityById.bind(store)),
        createProxy(article3, store.getEntityById.bind(store))
      ],
      contacts: {
        dummy: {
          address: createProxy(address1, store.getEntityById.bind(store)),
          phones: [
            createProxy(phone1, store.getEntityById.bind(store)),
            createProxy(phone2, store.getEntityById.bind(store))
          ]
        }
      },
      otherContacts: [[ // just testing nested arrays
        {
          address: createProxy(address1, store.getEntityById.bind(store)),
          phones: [
            createProxy(phone1, store.getEntityById.bind(store)),
            createProxy(phone2, store.getEntityById.bind(store))
          ]
        },
        {
          address: createProxy(address1, store.getEntityById.bind(store)),
          phones: [
            createProxy(phone1, store.getEntityById.bind(store)),
            createProxy(phone2, store.getEntityById.bind(store))
          ]
        }
      ]],
      objectLiteral: { foo: 'hello', bar: 'world' },
      arrayOfPrimitives: [4, 2]
    },
    [article1.id]: { ...article1 },
    [article2.id]: { ...article2 },
    [article3.id]: { ...article3 },
    [address1.id]: { ...address1 },
    [phone1.id]: { ...phone1 },
    [phone2.id]: { ...phone2 },
    [comment1.id]: { ...comment1 },
    [comment2.id]: { ...comment2 }
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

  normalizeAndStore(store, entity);

  const entities = store.getGraphQLCache();

  expect(Object.keys(entities).length).toBe(11);
  expect(entities['person1'].articles.length).toBe(2);
  expect(entities['person1'].contacts.dummy.phones.length).toBe(3);
  expect(entities['person1'].otherContacts[0][0].phones.length).toBe(1);
  expect(entities['person1'].otherContacts[0][1].phones.length).toBe(3);
});

test('nested entities', () => {
  const newComment = {
    id: 'comment3',
    __typename: 'Comment',
    text: 'New comment',
    article: {
      id: 'article1',
      __typename: 'Article',
      comments: [
        {
          id: 'comment3',
          __typename: 'Comment'
        }
      ],
      __onReplace: { comments: 'append' }
    }
  };

  normalizeAndStore(store, newComment);

  const entities = store.getGraphQLCache();

  expect(Object.keys(entities).length).toBe(10);
  expect(entities['article1'].comments.length).toBe(3);
});
