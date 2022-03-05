export default function createProxy(object, getById) {
  const handler = {
    get: function(target, prop, _receiver) {
      if (prop === 'id') {
        return target.id;
      }

      if (prop === '__typename') {
        return target.__typename;
      }

      if (prop === '__isProxy__') {
        return true;
      }

      const entity = getById(target.id);

      if (!entity) {
        throw new Error(`no entity with ID ${target.id}`);
      }

      if (prop === '__target__') {
        return entity;
      }

      return entity[prop];
    }
  };

  return new Proxy({ id: object.id, __typename: object.__typename }, handler);
}
