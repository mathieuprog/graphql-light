import transform from './transform';

test('create proxy', () => {
  let entity = { name: 'mathieu', age: 37 };

  entity = transform(entity, {
    name: n => n.toUpperCase()
  })

  expect(entity.name).toBe('MATHIEU');
  expect(entity.age).toBe(37);

  entity = { age: 37 };

  entity = transform(entity, {
    name: e => e.toUpperCase()
  })

  expect(entity.name).toBe(undefined);
});
