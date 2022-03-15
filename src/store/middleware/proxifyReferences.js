import {
  hasObjectProps,
  isArray,
  isArrayOfObjectLiterals,
  isEmptyArray,
  isEntity,
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

    const getConfigForReference = (propName) => {
      return entity && store.config.transformers[entity.__typename]?.references?.[propName];
    };

    const getConfigForField = (propName) => {
      const references = entity && store.config.transformers[entity.__typename]?.references;
      if (references) {
        for (const reference in references) {
          if (references[reference].field === propName) {
            return { ...references[reference], reference };
          }
        }
      }
    };

    for (let [propName, propValue] of Object.entries(object)) {
      if (['id', '__typename'].includes(propName)) {
        continue;
      }

      // do not use isEntity() as we might have only a __typename
      if (propValue.id && propValue.__typename) {
        const config = getConfigForField(propName);
        if (config && !object[config.reference]) {
          object[config.reference] = propValue.id;
        }
      } else if (isEmptyArray(propValue)) {
        const config = getConfigForField(propName);
        if (config && !object[config.reference]) {
          object[config.reference] = [];
        }
      } else if (isArray(propValue)) {
        const config = getConfigForField(propName);
        if (config && !object[config.reference]) {
          object[config.reference] = propValue.map(({ id }) => id);
        }
      }

      const config = getConfigForReference(propName);
      if (config) {
        if (isEmptyArray(propValue)) {
          const { field } = config;
          if (field && !object[field]) {
            object[field] = [];
          }
        } else if (isArray(propValue) && propValue.length > 0 && propValue[0].__typename) {
          object[propName] = await doProxifyReferences(propValue, entity, store, callbacks);
        } else if (isArrayOfObjectLiterals(propValue)) {
          if (propValue.length > 0) {
            const { type, ensureHasFields } = config;

            const incompleteEntities =
              propValue
                .filter(({ id }) => {
                  const referencedEntity = store.getEntityById(id);
                  return !referencedEntity || (ensureHasFields && !hasObjectProps(referencedEntity, ensureHasFields));
                })
                .map(({ id }) => id);

            if (incompleteEntities.length > 0) {
              let handleMissing = config.handleMissing;
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
          const { type, field, ensureHasFields } = config;

          if (!object[field]) {
            const incompleteEntities =
              propValue
                .filter(id => {
                  const referencedEntity = store.getEntityById(id);
                  return !referencedEntity || (ensureHasFields && !hasObjectProps(referencedEntity, ensureHasFields));
                });

            if (incompleteEntities.length > 0) {
              let handleMissing = config.handleMissing;
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
          const { type, field, ensureHasFields } = config;

          // we have only the reference (e.g. we have `userId` field and no `user` field)
          if (!object[field]) {
            if (!propValue) {
              object[field] = null;
            }
            else {
              let referencedEntity = store.getEntityById(propValue);

              if (!referencedEntity || ensureHasFields && !hasObjectProps(referencedEntity, ensureHasFields)) {
                let handleMissing = config.handleMissing;
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
