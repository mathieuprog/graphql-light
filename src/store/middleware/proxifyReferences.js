import { hasObjectProps, isArray, isObjectLiteral } from '../../utils';
import createProxy from '../createProxy';

export default async function proxifyReferences(result, store) {
  if (!store.config.transformers) {
    return result;
  }

  let { denormalizedData } = result;

  denormalizedData = await doProxifyReferences(denormalizedData, null, store);

  return { ...result, denormalizedData };
}

async function doProxifyReferences(data, entity, store) {
  if (isObjectLiteral(data)) {
    let object = { ...data };

    // do not use isEntity() as we might have an array of ids
    if (object.id && object.__typename) {
      entity = object;
    }

    const getLinkData = (propName) => entity && store.config.transformers[entity.__typename]?.references?.[propName];

    for (let [propName, propValue] of Object.entries(object)) {
      if (['id', '__typename'].includes(propName)) {
        continue;
      }

      const linkData = getLinkData(propName);
      if (linkData && propValue) {
        if (isArray(propValue) && propValue.length > 0) {
          const { type, ensureHasFields, handleMissing } = linkData;

          const incompleteEntities =
            propValue
              .filter(({ id }) => {
                const referencedEntity = store.getEntityById(id);
                return !referencedEntity || (ensureHasFields && !hasObjectProps(referencedEntity, ensureHasFields));
              })
              .map(({ id }) => id);

          if (incompleteEntities.length > 0) {
            await handleMissing(incompleteEntities, entity);

            propValue = propValue.filter(({ id }) => store.getEntityById(id));
          }

          if (!propValue[0].__typename) {
            propValue = propValue.map(entity => ({ ...entity, __typename: type }));
          }

          object[propName] = propValue.map(entity => createProxy(entity, store.getEntityById.bind(store)));
        } else {
          const { type, field, ensureHasFields, handleMissing } = linkData;

          if (!object[field]) {
            let referencedEntity = store.getEntityById(propValue);

            if (!referencedEntity || (ensureHasFields && !hasObjectProps(referencedEntity, ensureHasFields))) {
              await handleMissing(propValue, entity);

              referencedEntity = store.getEntityById(propValue);

              if (!referencedEntity) {
                object[field] = null;
                object[propName] = null;
              } else {
                object[field] = createProxy({ id: propValue, __typename: type }, store.getEntityById.bind(store));
              }
            } else {
              object[field] = createProxy({ id: propValue, __typename: type }, store.getEntityById.bind(store));
            }
          }
        }
      } else {
        object[propName] = await doProxifyReferences(propValue, entity, store);
      }
    }

    return object;
  }

  if (isArray(data)) {
    let array = [...data];
    array =  await Promise.all(array.map(element => doProxifyReferences(element, entity, store)));

    return array;
  }

  return data;
}
