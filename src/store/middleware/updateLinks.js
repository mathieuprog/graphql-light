import UpdateType from '../../constants/UpdateType';
import {
  isArray,
  isArrayOfEntities,
  isEntity,
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

function getReferenceField(entity, propName, store) {
  const references = store.config.transformers[entity.__typename]?.references ?? {};
  return Object.keys(references).find(key => references[key].field === propName);
}

function getFunCleanReferenceField(entity, object, propName, value, store) {
  if (isEntity(value)) {
    return (newValue) => {
      if (newValue === null) {
        const referenceField = getReferenceField(entity, propName, store);
        if (referenceField) {
          object[referenceField] = null;
        }
      }
    }
  } else {
    return () => {};
  }
}

function getFunCleanArrayOfReferencesField(entity, object, propName, value, store) {
  if (isArrayOfEntities(value)) {
    return (newValue) => {
      const referenceField = getReferenceField(entity, propName, store);
      if (referenceField) {
        object[referenceField] = newValue;
      }
    }
  } else {
    return () => {};
  }
}

function removeDeletedEntity(entity, deletedEntityId, updates, store) {
  entity = { ...entity };

  for (let [propName, propValue] of Object.entries(entity)) {
    const fun = getFunCleanReferenceField(entity, entity, propName, propValue, store);

    entity[propName] = doRemoveDeletedEntity(propValue, propName, entity, entity, deletedEntityId, updates, store);

    fun(entity[propName]);
  }

  return entity;
}

function doRemoveDeletedEntity(data, propName, entity, object, deletedEntityId, updates, store) {
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
      const fun = getFunCleanReferenceField(entity, data, propName, propValue, store);

      data[propName] = doRemoveDeletedEntity(propValue, propName, entity, data, deletedEntityId, updates, store);

      fun(data[propName]);
    }

    return data;
  }

  if (isArray(data)) {
    if (isArrayOfEntities(data)) {
      if (data.some(entity => entity.id === deletedEntityId)) {
        const fun = getFunCleanArrayOfReferencesField(entity, object, propName, data, store);
        fun(data.filter(entity => entity.id !== deletedEntityId).map(({ id }) => id));

        updates.push({ type: UpdateType.UPDATE_PROP, entity, propName });
        return data.filter(entity => entity.id !== deletedEntityId);
      }
    }

    return data.map(element => doRemoveDeletedEntity(element, propName, entity, element, deletedEntityId, updates, store));
  }

  return data;
}
