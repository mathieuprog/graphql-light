import UpdateType from './UpdateType';
import {
  isArray,
  isArrayOfEntities,
  isEntity,
  isNullOrUndefined,
  isObjectLiteral,
  unique
} from './utils';

export default function updateLinks(entities, links, updates) {
  entities = { ...entities };
  links = { ...links };
  updates = [...updates];

  const deletedEntities = updates.filter(({ type }) => type === UpdateType.DELETE_ENTITY);
  const updatedEntities = updates.filter(({ type }) => type !== UpdateType.DELETE_ENTITY);

  const deletedEntityIds = [...new Set(deletedEntities.map(({ entity: { id } }) => id))];
  const updatedEntityIds = [...new Set(updatedEntities.map(({ entity: { id } }) => id))];

  updatedEntityIds.forEach(updatedEntityId => {
    let nestedEntityIds = [];

    for (let [_propName, propValue] of Object.entries(entities[updatedEntityId])) {
      nestedEntityIds = [...nestedEntityIds, ...doUpdateLinks(propValue)];
    }

    nestedEntityIds.forEach(nestedEntityId => {
      if (!links[nestedEntityId] || !links[nestedEntityId].includes(updatedEntityId)) {
        links[nestedEntityId] ??= [];
        links[nestedEntityId] = [...links[nestedEntityId], updatedEntityId];
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
        entities[nestedInEntityId] = removeDeletedEntity(entities[nestedInEntityId], deletedEntityId, updates);
      }
    });

    delete links[deletedEntityId];
  });

  updates = unique(updates);

  return { links, entities, updates };
}

function removeDeletedEntity(entity, deletedEntityId, updates) {
  entity = { ...entity };

  for (let [propName, propValue] of Object.entries(entity)) {
    entity[propName] = doRemoveDeletedEntity(propValue, propName, entity, deletedEntityId, updates);
  }

  return entity;
}

function doRemoveDeletedEntity(data, propName, entity, deletedEntityId, updates) {
  if (isNullOrUndefined(data)) {
    return data;
  }

  if (isObjectLiteral(data)) {
    if (isEntity(data)) {
      if (data.id === deletedEntityId) {
        updates.push({ type: UpdateType.UPDATE_PROP, entity, propName });
        return null;
      }

      return data;
    }

    data = { ...data };

    for (let [propName, propValue] of Object.entries(data)) {
      data[propName] = doRemoveDeletedEntity(propValue, propName, entity, deletedEntityId, updates);
    }

    return data;
  }

  if (isArray(data)) {
    if (isArrayOfEntities(data)) {
      if (data.some(entity => entity.id === deletedEntityId)) {
        updates.push({ type: UpdateType.UPDATE_PROP, entity, propName });
        return data.filter(entity => entity.id !== deletedEntityId);
      }
    }

    return data.map(element => doRemoveDeletedEntity(element, propName, entity, deletedEntityId, updates));
  }

  return data;
}

function doUpdateLinks(data, nestedEntities = []) {
  if (isNullOrUndefined(data)) {
    return nestedEntities;
  }

  if (isObjectLiteral(data)) {
    if (isEntity(data)) {
      return [...nestedEntities, data.id];
    }

    for (let [_propName, propValue] of Object.entries(data)) {
      nestedEntities = nestedEntities.concat(doUpdateLinks(propValue, nestedEntities));
    }

    return nestedEntities;
  }

  if (isArray(data)) {
    if (isArrayOfEntities(data)) {
      return nestedEntities.concat(data.map(entity => entity.id));
    }

    return nestedEntities.concat(data.flatMap(element => doUpdateLinks(element, nestedEntities)));
  }

  return nestedEntities;
}
