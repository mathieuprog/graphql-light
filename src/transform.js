const defaultTransformOptions = { skipNullish: true };

function isNullish(value) {
  return value === null || value === undefined;
}

export default function transform(entity, resolvers, options) {
  options = Object.assign({}, defaultTransformOptions, options);

  for (let [propName, propValue] of Object.entries(entity)) {
    if (resolvers[propName] && (!options.skipNullish || !isNullish(propValue))) {
      entity[propName] = resolvers[propName](propValue);
    }
  }

  return entity;
}
