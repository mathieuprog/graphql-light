import {
  hasObjectProps,
  isArray,
  isArrayOfObjectLiterals,
  isEmptyArray,
  isObjectLiteral
} from '../../utils';
import createProxy from '../createProxy';

export default async function proxifyReferences(result, store, callbacks = {}) {
  if (!store.config.transformers) {
    return result;
  }

  let { denormalizedData } = result;

  denormalizedData = await doProxifyReferences(denormalizedData, null, store, callbacks);

  return { ...result, denormalizedData };
}

async function doProxifyReferences(data, entity, store, callbacks) {
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
      if (linkData) {
        if (isEmptyArray(propValue)) {
          const { field } = linkData;
          if (field && !object[field]) {
            object[field] = [];
          }
        } else if (isArray(propValue) && propValue.length > 0 && propValue[0].__typename) {
          object[propName] = await doProxifyReferences(propValue, entity, store, callbacks);
        } else if (isArrayOfObjectLiterals(propValue)) {
          if (propValue.length > 0) {
            const { type, ensureHasFields } = linkData;

            const incompleteEntities =
              propValue
                .filter(({ id }) => {
                  const referencedEntity = store.getEntityById(id);
                  return !referencedEntity || (ensureHasFields && !hasObjectProps(referencedEntity, ensureHasFields));
                })
                .map(({ id }) => id);

            if (incompleteEntities.length > 0) {
              let handleMissing = linkData.handleMissing;
              if (callbacks?.onMissingRelation) {
                handleMissing = (value, object) => callbacks?.onMissingRelation?.(propName, value, object);
              }

              if (handleMissing) {
                await handleMissing(incompleteEntities, entity);

                if (ensureHasFields) {
                  propValue
                    .forEach(({ id }) => {
                      const referencedEntity = store.getEntityById(id);
                      if (referencedEntity && !hasObjectProps(referencedEntity, ensureHasFields)) {
                        throw Error(`entity ${JSON.stringify(referencedEntity)} is missing fields ${ensureHasFields}`);
                      }
                    });
                }
              } else if (ensureHasFields) {
                propValue
                  .forEach(({ id }) => {
                    const referencedEntity = store.getEntityById(id);
                    if (referencedEntity && !hasObjectProps(referencedEntity, ensureHasFields)) {
                      throw Error(`entity ${JSON.stringify(referencedEntity)} is missing fields ${ensureHasFields} (no \`handleMissing\` callback)`);
                    }
                  });
              }

              propValue = propValue.filter(({ id }) => store.getEntityById(id));
            }

            object[propName] = propValue.map(({ id }) => createProxy({ id, __typename: type }, store.getEntityById.bind(store)));
          }

        // if we do not specify the __typename (not an array of entities), we assume the entities have been previously stored
        } else if (isArray(propValue)) {
          const { type, field, ensureHasFields } = linkData;

          if (!object[field]) {
            const incompleteEntities =
              propValue
                .filter(id => {
                  const referencedEntity = store.getEntityById(id);
                  return !referencedEntity || (ensureHasFields && !hasObjectProps(referencedEntity, ensureHasFields));
                });

            if (incompleteEntities.length > 0) {
              let handleMissing = linkData.handleMissing;
              if (callbacks?.onMissingRelation) {
                handleMissing = (value, object) => callbacks?.onMissingRelation?.(propName, value, object);
              }

              if (handleMissing) {
                await handleMissing(incompleteEntities, entity);

                if (ensureHasFields) {
                  propValue
                    .forEach(id => {
                      const referencedEntity = store.getEntityById(id);
                      if (referencedEntity && !hasObjectProps(referencedEntity, ensureHasFields)) {
                        throw Error(`entity ${JSON.stringify(referencedEntity)} is missing fields ${ensureHasFields}`);
                      }
                    });
                }
              } else if (ensureHasFields) {
                propValue
                  .forEach(id => {
                    const referencedEntity = store.getEntityById(id);
                    if (referencedEntity && !hasObjectProps(referencedEntity, ensureHasFields)) {
                      throw Error(`entity ${JSON.stringify(referencedEntity)} is missing fields ${ensureHasFields} (no \`handleMissing\` callback)`);
                    }
                  });
              }

              propValue = propValue.filter(id => store.getEntityById(id));
            }

            object[field] = propValue.map(id => createProxy({ id, __typename: type }, store.getEntityById.bind(store)));
          }
        } else {
          const { type, field, ensureHasFields } = linkData;

          // we have only the reference (e.g. we have `userId` field and no `user` field)
          if (!object[field]) {
            if (!propValue) {
              object[field] = null;
            }
            else {
              let referencedEntity = store.getEntityById(propValue);

              if (!referencedEntity || ensureHasFields && !hasObjectProps(referencedEntity, ensureHasFields)) {
                let handleMissing = linkData.handleMissing;
                if (callbacks?.onMissingRelation) {
                  handleMissing = (value, object) => callbacks?.onMissingRelation?.(propName, value, object);
                }

                if (handleMissing) {
                  await handleMissing(propValue, entity);

                  referencedEntity = store.getEntityById(propValue);

                  if (!referencedEntity) {
                    object[field] = null;
                    object[propName] = null;
                  } else if (ensureHasFields && !hasObjectProps(referencedEntity, ensureHasFields)) {
                    throw Error(`entity ${JSON.stringify(referencedEntity)} is missing fields ${ensureHasFields}`);
                  } else {
                    object[field] = createProxy({ id: propValue, __typename: type }, store.getEntityById.bind(store));
                  }
                } else if (ensureHasFields && !hasObjectProps(referencedEntity, ensureHasFields)) {
                  throw Error(`entity ${JSON.stringify(referencedEntity)} is missing fields ${ensureHasFields} (no \`handleMissing\` callback)`);
                } else {
                  object[field] = null;
                  object[propName] = null;
                }
              } else {
                object[field] = createProxy({ id: propValue, __typename: type }, store.getEntityById.bind(store));
              }
            }
          }
        }
      } else {
        object[propName] = await doProxifyReferences(propValue, entity, store, callbacks);
      }
    }

    return object;
  }

  if (isArray(data)) {
    let array = [...data];
    array =  await Promise.all(array.map(element => doProxifyReferences(element, entity, store, callbacks)));

    return array;
  }

  return data;
}
