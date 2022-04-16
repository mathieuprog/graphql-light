import ObjectType from '../../document/constants/ObjectType';
import Store from '../../store/Store';
import Document from '../../document/Document';
import buildNodeGraph from './buildNodeGraph';
import createProxy from '../createProxy';

test('buildNodeGraph', async () => {
  const store = new Store();

  const fetchMissingAccount = (accountId, _user) => {
    store.entities = {
      ...store.entities,
      [accountId]: {
        id: accountId,
        __typename: 'Account',
        loggedInAt: '2022-04-16'
      }
    };
  };

  const document =
    Document.query()
      .scalar('foo', Number)
      .entity('user')
        .scalar('name')
        .object('address')
          .scalar('street')._
        .entity('account')
          .deriveFromForeignKey('accountId', fetchMissingAccount)
          .scalar('loggedInAt')._
        .entityList('appointments', 'append')
          .scalar('date')
          .scalar('time')._._
      .scalar('bar', Number)._;

  const data = {
    foo: '1',
    bar: '2',
    user: {
      id: 'user1',
      __typename: 'User',
      name: 'Mathieu',
      address: {
        street: 'street'
      },
      accountId: 'account1',
      appointments: [
        { id: 'appointment1', __typename: 'Appointment', date: '2022-04-01', time: '10:00:00' },
        { id: 'appointment2', __typename: 'Appointment', date: '2022-04-02', time: '11:00:00' }
      ]
    }
  };

  store.entities = {
    'user1': {
      name: 'Mathieu',
      address: {
        street: 'street'
      },
      appointments: [
        createProxy({ id: 'appointment2', __typename: 'Appointment' })
      ]
    },
    'appointment2': {
      id: 'appointment2',
      __typename: 'Appointment',
      date: '2022-04-02',
      time: '11:30:00'
    }
  };

  const response = await buildNodeGraph(document, data, store);

  const rootNode = response.rootNode;

  expect(Object.keys(rootNode.fields)).toEqual(['foo', 'bar', 'user']);
  expect(rootNode.fields.foo).toBe(1);
  expect(rootNode.fields.bar).toBe(2);
  expect(rootNode.meta.scalars.foo).toBeTruthy();
  expect(rootNode.meta.scalars.bar).toBeTruthy();
  expect(rootNode.meta.objects.user).toBeTruthy();
  expect(rootNode.fetchCached).toBeNull();
  expect(rootNode.meta.type).toBe(ObjectType.OBJECT_LITERAL);
  expect(rootNode.meta.name).toBeNull();
  expect(Object.keys(rootNode.meta.objects).length).toBe(1);

  const userNode = rootNode.fields.user;

  expect(Object.keys(userNode.fields)).toEqual(['id', '__typename', 'name', 'address', 'account', 'appointments']);
  expect(userNode.meta.scalars.id).toBeTruthy();
  expect(userNode.meta.scalars.__typename).toBeTruthy();
  expect(userNode.meta.scalars.name).toBeTruthy();
  expect(userNode.meta.objects.address).toBeTruthy();
  expect(userNode.meta.objects.appointments).toBeTruthy();
  expect(userNode.fetchCached().name).toBe('Mathieu');
  expect(userNode.meta.type).toBe(ObjectType.ENTITY);
  expect(userNode.meta.name).toBe('user');
  expect(Object.keys(userNode.meta.objects).length).toBe(3);

  const accountNode = userNode.fields.account;

  expect(Object.keys(accountNode.fields)).toEqual(['id', '__typename', 'loggedInAt']);
  expect(accountNode.fetchCached().loggedInAt).toBe('2022-04-16');
  expect(accountNode.meta.type).toBe(ObjectType.ENTITY);
  expect(accountNode.meta.name).toBe('account');
  expect(Object.keys(accountNode.meta.objects).length).toBe(0);

  const appointmentNodes = userNode.fields.appointments;

  expect(appointmentNodes.length).toBe(2);

  let appointmentNode = appointmentNodes.find((node) => node.fields.id === 'appointment1');

  expect(Object.keys(appointmentNode.fields)).toEqual(['id', '__typename', 'date', 'time']);
  expect(appointmentNode.fetchCached()).toBeUndefined();
  expect(appointmentNode.meta.type).toBe(ObjectType.ENTITY_LIST);
  expect(appointmentNode.meta.name).toBe('appointments');
  expect(Object.keys(appointmentNode.meta.objects).length).toBe(0);

  appointmentNode = appointmentNodes.find((node) => node.fields.id === 'appointment2');

  expect(Object.keys(appointmentNode.fields)).toEqual(['id', '__typename', 'date', 'time']);
  expect(appointmentNode.fetchCached().date).toBe('2022-04-02');
  expect(appointmentNode.meta.type).toBe(ObjectType.ENTITY_LIST);
  expect(appointmentNode.meta.name).toBe('appointments');
  expect(Object.keys(appointmentNode.meta.objects).length).toBe(0);
});
