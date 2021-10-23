function isArray(a) {
  if (a === null || a === undefined) {
    return false;
  }

  return Array.isArray(a);
}

function isObjectLiteral(o) {
  if (o === null || o === undefined) {
    return false;
  }

  return Object.getPrototypeOf(o) === Object.prototype;
}

function isEntity(o) {
  if (isObjectLiteral(o)) {
    if (!!o.id !== !!o.__typename) {
      throw new Error(`id or __typename not set: ${JSON.stringify(o)}`);
    }

    return o.id && o.__typename;
  }

  return false;
}

function isArrayOfEntities(a) {
  if (a.length === 0) {
    return false;
  }

  return a.every(o => {
    if (isObjectLiteral(o)) {
      if (!!o.id !== !!o.__typename) {
        throw new Error(`id or __typename not set: ${JSON.stringify(o)}`);
      }

      return o.id && o.__typename;
    }

    return false;
  });
}

const areObjectsEqual = (a, b) => {
  if (a === b) return true;

  if (Object.keys(a).length !== Object.keys(b).length) return false;

  for (let [key, value] of Object.entries(a)) {
    if (!hasProp(b, key)) return false;

    if (value === b[key]) continue;

    if (value === null && b[key] !== null) return false;

    if (value === undefined && b[key] !== undefined) return false;

    if (!isArray(value) && !isObjectLiteral(value)) return false;

    if (isArray(value) !== isArray(b[key])) return false;

    if (isObjectLiteral(value) !== isObjectLiteral(b[key])) return false;

    if (isObjectLiteral(value) && !areObjectsEqual(value, b[key])) return false;

    if (isArray(value) && !areArraysEqual(value, b[key])) return false;
  }

  return true;
};

const areArraysEqual = (a, b) => {
  if (a === b) return true;

  if (a.length !== b.length) return false;

  for (let value of a) {
    if (isArray(value)) {
      if (!b.filter(e => isArray(e)).some(e => areArraysEqual(e, value))) return false;
      continue;
    }

    if (isObjectLiteral(value)) {
      if (!b.filter(e => isObjectLiteral(e)).some(e => areObjectsEqual(e, value))) return false;
      continue;
    }

    if (!b.includes(value)) return false;
  }

  return true;
};

function hasProp(o, prop) {
  return Object.prototype.hasOwnProperty.call(o, prop);
}

export {
  areArraysEqual,
  areObjectsEqual,
  isArray,
  isArrayOfEntities,
  isEntity,
  isObjectLiteral
}
