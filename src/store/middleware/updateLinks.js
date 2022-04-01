import UpdateType from '../../constants/UpdateType';
import {
  isArray,
  isArrayOfEntities,
  isArrayOfEntityProxies,
  hasCorrespondingForeignKeyField,
  isEntity,
  isEntityProxy,
  isForeignKeyField,
  isNullOrUndefined,
  isObjectLiteral,
  unique
} from '../../utils';

export default function updateLinks(result, store) {
  let { updates } = result;

  const entities = { ...store.entities };
  const links = { ...store.links };
  updates = [...updates];

  const deletedEntities = updates.filter(({ type }) => type === UpdateType.DELETE_ENTITY);
  const createdEntities = updates.filter(({ type }) => type === UpdateType.CREATE_ENTITY);
  const updatedEntities = updates.filter(({ type }) => type === UpdateType.UPDATE_PROP);

  const deletedEntityIds = [...new Set(deletedEntities.map(({ entity: { id } }) => id))];
  const createdEntityIds = [...new Set(createdEntities.map(({ entity: { id } }) => id))];
  const updatedEntityIds = [...new Set(updatedEntities.map(({ entity: { id } }) => id))];

  createdEntityIds.concat(updatedEntityIds).forEach(entityId => {
    let nestedEntityIds = [];

    for (let [_propName, propValue] of Object.entries(entities[entityId])) {
      nestedEntityIds = [...nestedEntityIds, ...getNestedEntities(propValue)];
    }

    nestedEntityIds.forEach(nestedEntityId => {
      if (!links[nestedEntityId] || !links[nestedEntityId].includes(entityId)) {
        links[nestedEntityId] ??= [];
        links[nestedEntityId] = [...links[nestedEntityId], entityId];
      }
    });
  });

  deletedEntityIds.forEach(deletedEntityId => {
    const nestedInEntityIds = links[deletedEntityId];
    if (!nestedInEntityIds) {
      return;
    }

    nestedInEntityIds.forEach(nestedInEntityId => {
      if (entities[nestedInEntityId]) {
        entities[nestedInEntityId] = removeDeletedEntity(entities[nestedInEntityId], deletedEntityId, updates, store);
      }
    });

    delete links[deletedEntityId];
  });

  updates = unique(updates);

  store.entities = entities;
  store.links = links;

  return { ...result, updates };
}

function getNestedEntities(data, nestedEntities = []) {
  if (isNullOrUndefined(data)) {
    return nestedEntities;
  }

  if (isObjectLiteral(data)) {
    if (isEntity(data)) {
      return [...nestedEntities, data.id];
    }

    for (let [_propName, propValue] of Object.entries(data)) {
      nestedEntities = nestedEntities.concat(getNestedEntities(propValue, nestedEntities));
    }

    return nestedEntities;
  }

  if (isArray(data)) {
    if (isArrayOfEntities(data)) {
      return nestedEntities.concat(data.map(entity => entity.id));
    }

    return nestedEntities.concat(data.flatMap(element => getNestedEntities(element, nestedEntities)));
  }

  return nestedEntities;
}

function removeDeletedEntity(entity, deletedEntityId, updates, store) {
  return doRemoveDeletedEntity(entity, entity, deletedEntityId, updates, store);
}

function doRemoveDeletedEntity(data, entity, deletedEntityId, updates, store, rootPropName = null) {
  if (isNullOrUndefined(data)) {
    return data;
  }

  if (isObjectLiteral(data)) {
    const isRootEntity = (data === entity);
    data = { ...data };

    for (let [propName, propValue] of Object.entries(data)) {
      if (isRootEntity) {
        rootPropName = propName;
      }

      if (isEntityProxy(propValue)) {
        if (propValue.id === deletedEntityId) {
          updates.push({ type: UpdateType.UPDATE_PROP, entity, propName: rootPropName });

          if (hasCorrespondingForeignKeyField(store, entity, propName)) {
            const associations = store.config.associationsByTypename[entity.__typename];

            const { foreignKeyField } = associations.find(({ field }) => field === propName);
            if (foreignKeyField !== propName) {
              data[foreignKeyField] = null;

              if (propName === rootPropName) {
                updates.push({ type: UpdateType.UPDATE_PROP, entity, propName: foreignKeyField });
              }
            }
          }

          data[propName] = null;
        }

        continue;
      }

      if (isArrayOfEntityProxies(propValue)) {
        const newPropValue = propValue.filter(entity => entity.id !== deletedEntityId);

        if (propValue.length !== newPropValue.length) {
          if (hasCorrespondingForeignKeyField(store, entity, propName)) {
            const associations = store.config.associationsByTypename[entity.__typename];

            const { foreignKeyField } = associations.find(({ field }) => field === propName);
            if (foreignKeyField !== propName) {
              data[foreignKeyField] = newPropValue.map(({ id }) => id);

              if (propName === rootPropName) {
                updates.push({ type: UpdateType.UPDATE_PROP, entity, propName: foreignKeyField });
              }
            }
          }

          updates.push({ type: UpdateType.UPDATE_PROP, entity, propName: rootPropName });
        }

        data[propName] = newPropValue;

        continue;
      }

      if ((!isRootEntity && isEntity(propValue)) || isArrayOfEntities(propValue)) {
        throw new Error();
      }

      if (isForeignKeyField(store, entity, propName)) {
        continue;
      }

      if (isObjectLiteral(propValue) || isArray(propValue)) {
        data[propName] = doRemoveDeletedEntity(propValue, entity, deletedEntityId, updates, store, rootPropName);
      }
    }

    return data;
  }

  if (isArray(data)) {
    return data.map(element => doRemoveDeletedEntity(element, entity, deletedEntityId, updates, store, rootPropName));
  }

  return data;
}

function hookOnCompareObjects(a, b) {
  if (isEntity(a) !== isEntity(b)) return { ne: true };

  if (isEntity(a)) {
    return {
      eq: a.id === b.id,
      ne: a.id !== b.id
    };
  }
}

function hookOnCompareArrays(a, b) {
  if (isArrayOfEntities(a) || isArrayOfEntities(b)) {
    if (a.length !== b.length) return { ne: true };

    for (let entityA of a) {
      const index = b.findIndex(entityB => entityA.id === entityB.id);
      if (index === -1) return { ne: true };
      b.splice(index, 1);
    }

    return { eq: true };
  }
}
