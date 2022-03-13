import UpdateType from '../../constants/UpdateType';
import {
  isArray,
  isArrayOfEntities,
  isEntity,
  isEntityProxy,
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

    entities[entityId] = updateReferences(entities[entityId], store);
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

function updateReferences(entity, store) {
  return doUpdateReferences(entity, entity, store);
}

function doUpdateReferences(data, entity, store) {
  if (isNullOrUndefined(data)) {
    return data;
  }

  if (isObjectLiteral(data)) {
    data = { ...data };

    let updateReferences = [];

    for (let [propName, propValue] of Object.entries(data)) {
      if (isEntityProxy(propValue)) {
        const referenceField = getReferenceField(entity, propName, store);
        if (referenceField) {
          updateReferences = [
            ...updateReferences,
            () => data[referenceField] = propValue.id
          ];
        }

        continue;
      }

      if (isArrayOfEntities(propValue)) {
        const referenceField = getReferenceField(entity, propName, store);
        if (referenceField) {
          updateReferences = [
            ...updateReferences,
            () => data[referenceField] = propValue.map(({ id }) => id)
          ];
        }

        continue;
      }

      data[propName] = doUpdateReferences(propValue, entity, store);
    }

    updateReferences.forEach(fun => fun());

    return data;
  }

  if (isArray(data)) {
    return data.map(element => doUpdateReferences(element, entity, store));
  }

  return data;
}

function removeDeletedEntity(entity, deletedEntityId, updates, store) {
  return doRemoveDeletedEntity(entity, entity, deletedEntityId, updates, store);
}

function doRemoveDeletedEntity(data, entity, deletedEntityId, updates, store) {
  if (isNullOrUndefined(data)) {
    return data;
  }

  if (isObjectLiteral(data)) {
    data = { ...data };

    let updateReferences = [];

    for (let [propName, propValue] of Object.entries(data)) {
      if (isEntityProxy(propValue)) {
        if (propValue.id === deletedEntityId) {
          updates.push({ type: UpdateType.UPDATE_PROP, entity, propName });

          const referenceField = getReferenceField(entity, propName, store);
          if (referenceField) {
            updateReferences = [
              ...updateReferences,
              () => data[referenceField] = null
            ];
          }

          data[propName] = null;
        }

        continue;
      }

      if (isArrayOfEntities(propValue)) {
        const newPropValue = propValue.filter(entity => entity.id !== deletedEntityId);

        if (propValue.length !== newPropValue.length) {
          const referenceField = getReferenceField(entity, propName, store);
          if (referenceField) {
            updateReferences = [
              ...updateReferences,
              () => data[referenceField] = newPropValue.map(({ id }) => id)
            ];
          }

          updates.push({ type: UpdateType.UPDATE_PROP, entity, propName });
        }

        data[propName] = newPropValue;

        continue;
      }

      data[propName] = doRemoveDeletedEntity(propValue, entity, deletedEntityId, updates, store);
    }

    updateReferences.forEach(fun => fun());

    return data;
  }

  if (isArray(data)) {
    return data.map(element => doRemoveDeletedEntity(element, entity, deletedEntityId, updates, store));
  }

  return data;
}

function getReferenceField(entity, propName, store) {
  const references = store.config.transformers[entity.__typename]?.references ?? {};
  return Object.keys(references).find(key => references[key].field === propName);
}
