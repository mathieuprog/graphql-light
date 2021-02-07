export default function transform(entity, resolvers) {
  for (let [propName, propValue] of Object.entries(entity)) {
    if (resolvers[propName]) {
      entity[propName] = resolvers[propName](propValue);
    }
  }

  return entity;
}
