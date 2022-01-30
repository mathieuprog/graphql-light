import createProxy from './createProxy';
import collectUpdates from './collectUpdates';
import store from './store';
import { areArraysEqual } from './utils';

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
  store.subscribers = new Set();
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

test('collect updates', () => {
  const entity = {
    ...person1,
    name: 'John',
    articles: [
      {
        ...article1,
        title: 'My article',
        comments: [
          { ...comment1, article: article1 },
          { ...comment2, article: article1 }
        ],
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

  const { updates, updatesToListenTo } = replaceEntityByItsId(collectUpdates(store.getEntityById.bind(store), entity));

  const expectedUpdates = [
    { type: 'UPDATE_PROP', entity: 'person1', propName: 'name' },
    { type: 'UPDATE_PROP', entity: 'person1', propName: 'articles' },
    { type: 'DELETE_ENTITY', entity: 'article1' },
    { type: 'UPDATE_PROP', entity: 'article1', propName: 'title' },
    { type: 'CREATE_ENTITY', entity: 'article4' },
    { type: 'UPDATE_PROP', entity: 'person1', propName: 'contacts' },
    { type: 'CREATE_ENTITY', entity: 'address2' },
    { type: 'CREATE_ENTITY', entity: 'phone3' },
    {
      type: 'UPDATE_PROP',
      entity: 'person1',
      propName: 'otherContacts'
    },
    {
      type: 'UPDATE_PROP',
      entity: 'person1',
      propName: 'objectLiteral'
    },
    {
      type: 'UPDATE_PROP',
      entity: 'person1',
      propName: 'arrayOfPrimitives'
    }
  ];

  expect(
    areArraysEqual(
      expectedUpdates,
      updates
    )
  ).toBeTruthy();

  const expectedUpdatesToListenTo = [
    { type: 'DELETE_ENTITY', entity: 'person1' },
    { type: 'UPDATE_PROP', entity: 'person1', propName: 'name' },
    { type: 'UPDATE_PROP', entity: 'person1', propName: 'age' },
    { type: 'UPDATE_PROP', entity: 'person1', propName: 'articles' },
    { type: 'DELETE_ENTITY', entity: 'article4' },
    { type: 'UPDATE_PROP', entity: 'article4', propName: 'title' },
    { type: 'UPDATE_PROP', entity: 'article4', propName: 'comments' },
    { type: 'UPDATE_PROP', entity: 'person1', propName: 'contacts' },
    { type: 'DELETE_ENTITY', entity: 'address2' },
    { type: 'UPDATE_PROP', entity: 'address2', propName: 'street' },
    { type: 'DELETE_ENTITY', entity: 'phone3' },
    { type: 'UPDATE_PROP', entity: 'phone3', propName: 'number' },
    { type: 'UPDATE_PROP', entity: 'person1', propName: 'otherContacts' },
    { type: 'DELETE_ENTITY', entity: 'address1' },
    { type: 'UPDATE_PROP', entity: 'address1', propName: 'street' },
    { type: 'UPDATE_PROP', entity: 'person1', propName: 'objectLiteral' },
    {
      type: 'UPDATE_PROP',
      entity: 'person1',
      propName: 'arrayOfPrimitives'
    }
  ];

  expect(
    areArraysEqual(
      expectedUpdatesToListenTo,
      updatesToListenTo
    )
  ).toBeTruthy();
});

function replaceEntityByItsId({ updates, updatesToListenTo }) {
  updates = updates.map(e => ({ ...e, entity: e.entity.id }));
  updatesToListenTo = updatesToListenTo.map(e => ({ ...e, entity: e.entity.id }));

  return { updates, updatesToListenTo };
}
