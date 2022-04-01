import { removeEntityById, updateEntity } from './normalize';
import store from '../index';
import { deepFreeze } from '../../utils';
import checkMissingLinks from './checkMissingLinks';
import checkInvalidReferences from './checkInvalidReferences';

const denormalizedData = deepFreeze({
  id: 'person1',
  __typename: 'Person',
  name: 'Mathieu',
  age: 37,
  test: {
    article: {
      id: 'article10',
      __typename: 'Article',
      title: 'Article 10',
      authors: [{
        id: 'author1',
        __typename: 'Author',
        name: 'Patrick'
      }]
    },
    authors: [{
      id: 'author1',
      __typename: 'Author',
      name: 'Patrick'
    }]
  },
  foo: { articles: [
    {
      id: 'article1',
      __typename: 'Article',
      title: 'Hello!',
      comments: [
        {
          id: 'comment1',
          __typename: 'Comment',
          text: 'A comment'
        },
        {
          id: 'comment2',
          __typename: 'Comment',
          text: 'Another comment'
        },
      ]
    },
    {
      id: 'article2',
      __typename: 'Article',
      title: 'World!',
      comments: [],
      authors: [{
        id: 'author1',
        __typename: 'Author',
        name: 'Patrick'
      }]
    },
    {
      id: 'article3',
      __typename: 'Article',
      title: 'Foo',
      comments: []
    }
  ] },
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
        },
        {
          id: 'recommendation2',
          __typename: 'Recommendation',
          text: 'Another recommendation'
        },
      ]
    },
    {
      id: 'friend2',
      __typename: 'Friend',
      name: 'James',
      recommendations: []
    }
  ],
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
      ]
    }
  },
  otherContacts: [[
    {
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
      ]
    },
    {
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
      ]
    }
  ]],
  objectLiteral: { foo: 'hello', bar: 'world' },
  arrayOfPrimitives: [4, 2]
});

beforeEach(async () => {
  store.initialize();

  store.setConfig({ debug: true });

  store.setConfig({ transformers: {
    Person: {
      references: {
        articleId: {
          type: 'Article',
          field: 'article'
        },
        articleIds: {
          type: 'Article',
          field: 'articles'
        },
        friendIds: {
          type: 'Friend',
          field: 'friends'
        },
        phoneIds: {
          type: 'Phone',
          field: 'phones'
        },
        addressId: {
          type: 'Address',
          field: 'address'
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
    },
    Article: {
      references: {
        commentIds: {
          type: 'Comment',
          field: 'comments'
        }
      }
    }
  } });

  const onFetchArrayOfEntities = (propName, object) => {
    switch (propName) {
      case 'articles':
        return 'append';

      case 'authors':
        return 'append';

      case 'addresses':
        return 'append';

      case 'friends':
        return 'append';

      case 'recommendations':
        return 'append';

      case 'comments':
        return 'append';

      case 'phones':
        return (object.address.id === 'address2') ? 'override' : 'append';
    }
  };

  await store.store(denormalizedData, { onFetchArrayOfEntities });

  await store.store({
    id: 'person2',
    __typename: 'Person',
    name: 'David',
    age: 32,
    articles: [
      {
        id: 'article1',
        __typename: 'Article'
      }
    ],
    articleId: 'article1'
  }, { onFetchArrayOfEntities });

  await store.store({
    id: 'person3',
    __typename: 'Person',
    name: 'Eric',
    age: 30,
    article: {
      id: 'article5',
      __typename: 'Article'
    }
  }, { onFetchArrayOfEntities });
});

afterEach(() => {
  expect(checkMissingLinks({}, store)).toEqual({});
  expect(checkInvalidReferences({}, store)).toEqual({});
});

test('collect updates', async () => {
  const entity = {
    id: 'person1',
    __typename: 'Person',
    age: 37,
    test: {
      article: {
        id: 'article10',
        __typename: 'Article',
        title: 'Article 10'
      }
    },
    name: 'John', // update
    foo: { articles: [
      {
        id: 'article1',
        __typename: 'Article',
        title: 'My article', // update
        comments: [
          {
            id: 'comment1',
            __typename: 'Comment',
            text: 'A comment'
          },
          {
            id: 'comment2',
            __typename: 'Comment',
            text: 'Another comment'
          },
        ]
      },
      {
        id: 'article2',
        __typename: 'Article',
        title: 'World!',
        comments: []
      },
      {
        id: 'article4',
        __typename: 'Article',
        comments: [],
        title: 'Another article' // update
      }
    ] },
    friends: [
      {
        id: 'friend1',
        __typename: 'Friend',
        recommendations: [
          {
            id: 'recommendation3', // update
            __typename: 'Recommendation',
            text: 'Recommendation'
          },
        ]
      }
    ],
    contacts: {
      dummy: {
        address: {
          id: 'address2',
          __typename: 'Address',
          street: 'Bar street'
        },
        phones: [
          {
            id: 'phone3',
            __typename: 'Phone',
            number: '30'
          }
        ]
      }
    },
    otherContacts: [[ // just testing nested arrays
      {
        address: {
          id: 'address2',
          __typename: 'Address',
          street: 'Bar street'
        },
        phones: [
          {
            id: 'phone3',
            __typename: 'Phone',
            number: '30'
          }
        ]
      },
      {
        address: {
          id: 'address1',
          __typename: 'Address',
          street: 'Foo street'
        },
        phones: [
          {
            id: 'phone3',
            __typename: 'Phone',
            number: '30'
          }
        ]
      }
    ]],
    objectLiteral: {
      bar: 'world!'
    },
    arrayOfPrimitives: [1, 2]
  };

  const onFetchEntity = normalizedEntity => {
    if (normalizedEntity.id === 'article1') {
      return removeEntityById(normalizedEntity.id);
    }

    if (normalizedEntity.id === 'person1') {
      return [
        updateEntity(
          normalizedEntity,
          'foo',
          (foo) => ({
            ...foo,
            articles: foo.articles.filter(({ id }) => id !== 'article2')
          })
        ),
        updateEntity(
          store.entities.person3, 'articleId', (_articleId) => 'article3'
        )
      ]
    }
  };

  const onFetchArrayOfEntities = (propName, object) => {
    switch (propName) {
      case 'articles':
        return 'append';

      case 'authors':
        return 'append';

      case 'friends':
        return 'append';

      case 'recommendations':
        return 'append';

      case 'comments':
        return 'append';

      case 'phones':
        return (object.address.id === 'address2') ? 'override' : 'append';
    }
  };

  expect(store.entities['article1']).toBeTruthy();
  expect(store.entities['person1'].foo.articles.length).toBe(3);
  expect(store.entities['person2'].articles.length).toBe(1);

  const { updates, updatesToListenTo } = await store.store(entity, { onFetchEntity, onFetchArrayOfEntities });

  expect(store.entities['article1']).toBeUndefined();
  expect(store.entities['person1'].foo.articles.length).toBe(2);
  expect(store.entities['person2'].articles.length).toBe(0);

  const { updates: updates_, updatesToListenTo: updatesToListenTo_ } = replaceEntityByItsId({ updates, updatesToListenTo });

  const expectedUpdates = [
    { type: 'DELETE_ENTITY', entity: 'article1' },
    { type: 'CREATE_ENTITY', entity: 'article4' },
    { type: 'CREATE_ENTITY', entity: 'recommendation3' },
    { type: 'UPDATE_PROP', entity: 'friend1', propName: 'recommendations' },
    { type: 'UPDATE_PROP', entity: 'friend1', propName: 'recommendationIds' },
    { type: 'CREATE_ENTITY', entity: 'address2' },
    { type: 'CREATE_ENTITY', entity: 'phone3' },
    { type: 'UPDATE_PROP', entity: 'person1', propName: 'test' },
    { type: 'UPDATE_PROP', entity: 'person1', propName: 'name' },
    { type: 'UPDATE_PROP', entity: 'person1', propName: 'foo' },
    { type: 'UPDATE_PROP', entity: 'person1', propName: 'contacts' },
    { type: 'UPDATE_PROP', entity: 'person1', propName: 'otherContacts' },
    { type: 'UPDATE_PROP', entity: 'person1', propName: 'objectLiteral' },
    { type: 'UPDATE_PROP', entity: 'person1', propName: 'arrayOfPrimitives' },
    { type: 'UPDATE_PROP', entity: 'person3', propName: 'articleId' },
    { type: 'UPDATE_PROP', entity: 'person3', propName: 'article' },
    { type: 'UPDATE_PROP', entity: 'person2', propName: 'articleIds' },
    { type: 'UPDATE_PROP', entity: 'person2', propName: 'articles' },
    { type: 'UPDATE_PROP', entity: 'person2', propName: 'article' },
    { type: 'UPDATE_PROP', entity: 'person2', propName: 'articleId' }
  ];

  expect(expectedUpdates).toEqual(updates_);

  const expectedUpdatesToListenTo = [
    { type: 'UPDATE_PROP', entity: 'article10', propName: 'title' },
    { type: 'DELETE_ENTITY', entity: 'article10' },
    { type: 'UPDATE_PROP', entity: 'article4', propName: 'comments' },
    { type: 'UPDATE_PROP', entity: 'article4', propName: 'title' },
    { type: 'UPDATE_PROP', entity: 'article4', propName: 'commentIds' },
    { type: 'DELETE_ENTITY', entity: 'article4' },
    { type: 'UPDATE_PROP', entity: 'recommendation3', propName: 'text' },
    { type: 'DELETE_ENTITY', entity: 'recommendation3' },
    { type: 'UPDATE_PROP', entity: 'friend1', propName: 'recommendations' },
    { type: 'UPDATE_PROP', entity: 'friend1', propName: 'recommendationIds' },
    { type: 'DELETE_ENTITY', entity: 'friend1' },
    { type: 'UPDATE_PROP', entity: 'address2', propName: 'street' },
    { type: 'DELETE_ENTITY', entity: 'address2' },
    { type: 'UPDATE_PROP', entity: 'phone3', propName: 'number' },
    { type: 'DELETE_ENTITY', entity: 'phone3' },
    { type: 'UPDATE_PROP', entity: 'address1', propName: 'street' },
    { type: 'DELETE_ENTITY', entity: 'address1' },
    { type: 'UPDATE_PROP', entity: 'person1', propName: 'age' },
    { type: 'UPDATE_PROP', entity: 'person1', propName: 'test' },
    { type: 'UPDATE_PROP', entity: 'person1', propName: 'name' },
    { type: 'UPDATE_PROP', entity: 'person1', propName: 'foo' },
    { type: 'UPDATE_PROP', entity: 'person1', propName: 'friends' },
    { type: 'UPDATE_PROP', entity: 'person1', propName: 'contacts' },
    { type: 'UPDATE_PROP', entity: 'person1', propName: 'otherContacts' },
    { type: 'UPDATE_PROP', entity: 'person1', propName: 'objectLiteral' },
    { type: 'UPDATE_PROP', entity: 'person1', propName: 'arrayOfPrimitives' },
    { type: 'UPDATE_PROP', entity: 'person1', propName: 'friendIds' },
    { type: 'DELETE_ENTITY', entity: 'person1' }
  ];

  expect(expectedUpdatesToListenTo).toEqual(updatesToListenTo_);
});

function replaceEntityByItsId({ updates, updatesToListenTo }) {
  updates = updates.map(e => ({ ...e, entity: e.entity.id }));
  updatesToListenTo = updatesToListenTo.map(e => ({ ...e, entity: e.entity.id }));

  return { updates, updatesToListenTo };
}
