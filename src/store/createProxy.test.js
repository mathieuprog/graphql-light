import createProxy from './createProxy';

const persons = [
  {
    id: 'person1',
    name: 'Mathieu'
  },
  {
    id: 'person2',
    name: 'Jérôme'
  }
];

function getById(id) {
  return persons.find(person => person.id === id);
}

test('create proxy', () => {
  const personProxy = createProxy(persons[0], getById);

  expect(personProxy.id).toBe('person1');
  expect(personProxy.name).toBe('Mathieu');

  expect(personProxy.__target__).toBe(persons[0]);
});
