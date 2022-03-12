import checkMissingLinks from './checkMissingLinks';
import store from '../index';
import { deepFreeze } from '../../utils';
import createProxy from '../createProxy';
import checkInvalidReferences from './checkInvalidReferences';

const denormalizedData = deepFreeze({
  id: 'person1',
  __typename: 'Person',
  address: {
    id: 'address1',
    __typename: 'Address',
    street: 'Foo'
  }
});

beforeEach(() => {
  store.initialize();

  store.setConfig({ debug: true });

  return store.store(denormalizedData);
});

afterEach(() => {
  expect(checkInvalidReferences({}, store)).toEqual({});
});

test('no missing entity', () => {
  expect(checkMissingLinks({}, store)).toEqual({});
});

test('missing entity', () => {
  store.entities.person1.address =
    createProxy(
      { id: 'address2', __typename: 'Address' },
      store.getEntityById.bind(store)
    );

  expect(() => checkMissingLinks({}, store)).toThrow(/missing/);
});
