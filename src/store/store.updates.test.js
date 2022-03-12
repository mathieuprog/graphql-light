import { removeEntityById, updateEntity } from './middleware/normalize';
import store from './index';
import { areArraysEqual, deepFreeze } from '../utils';
import checkMissingLinks from './middleware/checkMissingLinks';
import checkInvalidReferences from './middleware/checkInvalidReferences';

const denormalizedData = deepFreeze({
  id: 'person1',
  __typename: 'Person',
  name: 'Mathieu',
  age: 37,
  articles: [
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
      comments: []
    },
    {
      id: 'article3',
      __typename: 'Article',
      title: 'Foo',
      comments: []
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

  const onFetchArrayOfEntities = (propName, object) => {
    switch (propName) {
      case 'articles':
        return 'append';

      case 'comments':
        return 'append';

      case 'phones':
        return (object.address.id === 'address2') ? 'override' : 'append';
    }
  };

  await store.store(denormalizedData, { onFetchArrayOfEntities });

  store.store({
    id: 'person2',
    __typename: 'Person',
    name: 'David',
    age: 32,
    articles: [
      {
        id: 'article1',
        __typename: 'Article'
      }
    ]
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
    name: 'John', // update
    articles: [
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
      return updateEntity(
        normalizedEntity,
        'articles',
        articles => articles.filter(({ id }) => id !== 'article2')
      );
    }
  };

  const onFetchArrayOfEntities = (propName, object) => {
    switch (propName) {
      case 'articles':
        return 'append';

      case 'comments':
        return 'append';

      case 'phones':
        return (object.address.id === 'address2') ? 'override' : 'append';
    }
  };

  expect(store.entities['article1']).toBeTruthy();
  expect(store.entities['person1'].articles.length).toBe(3);
  expect(store.entities['person2'].articles.length).toBe(1);

  const { updates, updatesToListenTo } = await store.store(entity, { onFetchEntity, onFetchArrayOfEntities });

  expect(store.entities['article1']).toBeUndefined();
  expect(store.entities['person1'].articles.length).toBe(2);
  expect(store.entities['person2'].articles.length).toBe(0);

  const { updates: updates_, updatesToListenTo: updatesToListenTo_ } = replaceEntityByItsId({ updates, updatesToListenTo });

  const expectedUpdates = [
    { type: 'UPDATE_PROP', entity: 'person1', propName: 'name' },
    { type: 'UPDATE_PROP', entity: 'person1', propName: 'articles' },
    { type: 'DELETE_ENTITY', entity: 'article1' },
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
    },
    { type: 'UPDATE_PROP', entity: 'person2', propName: 'articles' }
  ];

  expect(
    areArraysEqual(
      expectedUpdates,
      updates_
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
      updatesToListenTo_
    )
  ).toBeTruthy();
});

function replaceEntityByItsId({ updates, updatesToListenTo }) {
  updates = updates.map(e => ({ ...e, entity: e.entity.id }));
  updatesToListenTo = updatesToListenTo.map(e => ({ ...e, entity: e.entity.id }));

  return { updates, updatesToListenTo };
}
