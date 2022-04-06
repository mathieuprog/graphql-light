import Document from './Document';

const fetchMissingAccount = (accountId, _user) => {
  return query.query({ accountId }, { fetchStrategy: FetchStrategy.NETWORK_ONLY });
};

test('stringify', () => {
  const document =
    Document.query('operationName')
      .variableDefinitions({ calendarId: 'ID!', dateRange: 'DateRange!' })
      .scalar('foo', Number)
      .entity('user')
        .delete(false)
        .scalar('name')
        .foreignKey('accountId', 'Account', fetchMissingAccount)
        .entityList('appointments', 'append')
          .delete(false)
          .useVariables('calendarId', 'dateRange')
          .filterUpdates({
            objectTypes: ['Appointment'],
            updateTypes: ['create', 'delete'],
            entity: (appointment, { calendarId }) => appointment.calendarId === calendarId
          })
          .onEntityCreated((appointment) => (user) => ({
            ...user,
            appointments: [...user.appointments, appointment]
          }))
          .onEntityDeleted((appointment) => (user) => ({
            ...user,
            appointments: user.appointments.filter(({ id }) => appointment.id !== id)
          }))
          .scalar('date')
          .scalar('time')
          .object('bar')
            .scalar('name')._._
        .entityList('availabilities', 'append')
          .useVariables('calendarId', 'dateRange')
          .scalar('date')
          .scalar('time')._._
      .entity('organization')
        .scalar('name')._._
      .prepareQueryString();

  let expectedDocumentString = 'query operationName($calendarId:ID!,$dateRange:DateRange!)';
  expectedDocumentString += '{foo user{';
  expectedDocumentString += 'id __typename name accountId appointments(calendarId:$calendarId,dateRange:$dateRange){';
  expectedDocumentString += 'id __typename date time bar{'
  expectedDocumentString += 'name';
  expectedDocumentString += '}}'; // end bar and appointments
  expectedDocumentString += 'availabilities(calendarId:$calendarId,dateRange:$dateRange){';
  expectedDocumentString += 'id __typename date time';
  expectedDocumentString += '}}'; // end availabilities and user
  expectedDocumentString += 'organization{';
  expectedDocumentString += 'id __typename name';
  expectedDocumentString += '}}'; // end organization and root object

  expect(document.queryString).toBe(expectedDocumentString);
});
