import transform from './transform';

test('transform prop', () => {
  let entity = { name: 'mathieu', age: 37 };

  entity = transform(entity, {
    name: n => n.toUpperCase()
  })

  expect(entity.name).toBe('MATHIEU');
  expect(entity.age).toBe(37);
});

test('transform but prop no present', () => {
  let entity = { age: 37 };

  entity = transform(entity, {
    name: n => n.toUpperCase()
  })

  expect(entity.name).toBe(undefined);
});

test('transform null', () => {
  let entity = { name: null };

  entity = transform(entity, {
    name: _ => 'name'
  }, { skipNullish: false })

  expect(entity.name).toBe('name');
});

test('do not transform nullish values', () => {
  let entity = { name: null };

  entity = transform(entity, {
    name: n => n.toUpperCase()
  })

  expect(entity.name).toBe(null);

  entity = { name: undefined };

  entity = transform(entity, {
    name: n => n.toUpperCase()
  })

  expect(entity.name).toBe(undefined);
});
