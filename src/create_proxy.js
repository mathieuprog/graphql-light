export default function createProxy(object, getById) {
  const handler = {
    get: function(target, prop, _receiver) {
      if (prop === 'id') {
        return target.id;
      }

      if (prop === '__typename') {
        return target.__typename;
      }

      const entity = getById(target.id);

      if (prop === '__target__') {
        return entity;
      }

      if (!entity) {
        throw new Error(`no entity with ID ${target.id}`);
      }

      return entity[prop];
    }
  };

  return new Proxy({ id: object.id, __typename: object.__typename }, handler);
}
