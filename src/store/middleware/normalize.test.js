import normalize, { removeEntityById, updateEntity } from './normalize';
import store from '../index';
import { deepFreeze } from '../../utils';

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
});

test('normalize and store', () => {
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
            text: 'A comment',
            article: {
              id: 'article1',
              __typename: 'Article',
            }
          },
          {
            id: 'comment2',
            __typename: 'Comment',
            text: 'Another comment',
            article: {
              id: 'article1',
              __typename: 'Article',
            }
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
        articles => articles.filter(({ id }) => id !== 'article1' && id !== 'article2')
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

  const entities = { ...store.getEntities() };

  normalize({ denormalizedData: entity }, store, { onFetchEntity, onFetchArrayOfEntities });

  const newEntities = store.getEntities();

  expect(Object.keys(entities).length).toBe(9);
  expect(Object.keys(newEntities).length).toBe(11);

  expect(entities['person1'].articles.length).toBe(3);
  expect(newEntities['person1'].articles.length).toBe(2);

  expect(entities['person1'].contacts.dummy.phones.length).toBe(2);
  expect(newEntities['person1'].contacts.dummy.phones.length).toBe(1);

  expect(entities['person1'].otherContacts[0][0].phones.length).toBe(2);
  expect(newEntities['person1'].otherContacts[0][0].phones.length).toBe(1);

  expect(entities['person1'].otherContacts[0][1].phones.length).toBe(2);
  expect(newEntities['person1'].otherContacts[0][1].phones.length).toBe(3);
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
      ]
    }
  };

  const onFetchArrayOfEntities = propName => {
    switch (propName) {
      case 'comments':
        return 'append';
    }
  };

  const entities = { ...store.getEntities() };

  normalize({ denormalizedData: newComment }, store, { onFetchArrayOfEntities });

  const newEntities = store.getEntities();

  expect(Object.keys(entities).length).toBe(9);
  expect(Object.keys(newEntities).length).toBe(10);

  expect(entities['article1'].comments.length).toBe(2);
  expect(newEntities['article1'].comments.length).toBe(3);
});
