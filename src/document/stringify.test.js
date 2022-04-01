import Document from './Document';

test('stringify', () => {
  const document =
    Document.query('operationName')
      .variableDefinitions({ calendarId: 'ID!', dateRange: 'DateRange!' })
      .scalar('foo')
      .entity('user')
        .scalar('name')
        .entityList('appointments', 'append')
          .useVariables('calendarId', 'dateRange')
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
  expectedDocumentString += 'id __typename name appointments(calendarId:$calendarId,dateRange:$dateRange){';
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
