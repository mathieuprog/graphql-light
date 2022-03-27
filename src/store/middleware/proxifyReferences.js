import { isNullOrUndefined } from 'object-array-utils';
import {
  areObjectsEqual,
  hasObjectProperties,
  isArray,
  isArrayOfObjectLiterals,
  isArrayOfType,
  isAssociationField,
  isEmptyArray,
  isEntity,
  isForeignKeyField,
  isObjectLiteral
} from '../../utils';
import createProxy from '../createProxy';

export default async function proxifyReferences(result, store, callbacks = {}) {
  if (!store.config.transformers) {
    return result;
  }

  let { denormalizedData } = result;

  denormalizedData = addForeignKeyFields(store, denormalizedData);
  denormalizedData = await addAssociationFields(store, denormalizedData, callbacks);

  return { ...result, denormalizedData };
}

function addForeignKeyFields(store, data, entity = null) {
  if (isObjectLiteral(data)) {
    const object = { ...data };

    if (isEntity(object)) {
      entity = object;
    }

    for (const [propName, propValue] of Object.entries(object)) {
      if (['id', '__typename'].includes(propName)) {
        continue;
      }

      if (entity && isAssociationField(store, entity, propName)) {
        if (
          !isNullOrUndefined(propValue)
          && !isEntity(propValue)
          && !isArray(propValue)
        ) {
          throw new Error('association is neither an entity or array of entities');
        }

        const associations = store.config.associationsByTypename[entity.__typename];

        const { foreignKeyField } = associations.find(({ field }) => field === propName);
        if (!foreignKeyField) {
          throw new Error();
        }

        if (foreignKeyField === propName) {
          continue;
        }

        const value = isArray(propValue) ? propValue.map(({ id }) => id) : (propValue?.id ?? null);

        if (object[foreignKeyField]) {
          if (!areObjectsEqual({ v: object[foreignKeyField] }, { v: value })) {
            throw new Error(`association(s) don't correspond to foreign key(s)`);
          }
          continue;
        }

        object[foreignKeyField] = value;
        continue;
      }

      if (isObjectLiteral(propValue) || isArray(propValue)) {
        object[propName] = addForeignKeyFields(store, propValue, entity);
      }
    }

    return object;
  }

  if (isArray(data)) {
    return data.map(element => addForeignKeyFields(store, element, entity));
  }

  return data;
}

function addAssociationFields(store, data, callbacks) {
  return doAddAssociationFields(store, data, null, callbacks)
}

async function doAddAssociationFields(store, data, entity, callbacks) {
  if (isObjectLiteral(data)) {
    const object = { ...data };

    if (isEntity(object)) {
      entity = object;
    }

    for (let [propName, propValue] of Object.entries(object)) {
      if (['id', '__typename'].includes(propName)) {
        continue;
      }

      if (entity && isForeignKeyField(store, entity, propName)) {
        const associations = store.config.associationsByTypename[entity.__typename];

        const { field } = associations.find(({ foreignKeyField }) => foreignKeyField === propName);
        if (!field) {
          throw new Error();
        }

        if (object[field] && field !== propName) {
          const value = isArray(object[field]) ? object[field].map(({ id }) => id) : (object[field]?.id || null);
          if (!areObjectsEqual({ v: propValue }, { v: value })) {
            throw new Error(`association(s) don't correspond to foreign key(s)`);
          }
          continue;
        }

        if (isNullOrUndefined(propValue) || isEmptyArray(propValue)) {
          object[field] = propValue ?? null;
          continue;
        }

        if (field === propName) {
          if (!isArrayOfObjectLiterals(propValue)) {
            throw new Error();
          }

          propValue = propValue.map(({ id }) => id);
        }

        if (isArrayOfType(propValue, 'string')) {
          object[field] = await fetchNestedEntitiesForFk(store, entity, propName, propValue, callbacks);
          if (field !== propName) {
            object[propName] = object[field].map(( { id }) => id);
          }
          continue;
        }

        if (typeof propValue === 'string') {
          object[field] = await fetchNestedEntityForFk(store, entity, propName, propValue, callbacks);
          object[propName] = object[field] ? object[field].id : null;
          continue;
        }

        throw new Error('foreign key is neither a string or array of strings');
      }

      if (isObjectLiteral(propValue) || isArray(propValue)) {
        object[propName] = await doAddAssociationFields(store, propValue, entity, callbacks);
      }
    }

    return object;
  }

  if (isArray(data)) {
    return await Promise.all(data.map(element => doAddAssociationFields(store, element, entity, callbacks)));
  }

  return data;
}

async function fetchNestedEntityForFk(store, parentEntity, foreignKeyField, foreignKey, callbacks) {
  const associations = store.config.associationsByTypename[parentEntity.__typename];

  const { ensureHasFields, handleMissing: _handleMissing } =
    associations.find((a) => a.foreignKeyField === foreignKeyField);

  let nestedEntity = store.getEntityById(foreignKey);

  const mustFetch = !nestedEntity || (ensureHasFields && !hasObjectProperties(nestedEntity, ensureHasFields));

  if (!mustFetch) {
    return createProxy(nestedEntity, store.getEntityById.bind(store));
  }

  const handleMissing = (callbacks.onMissingRelation)
    ? (foreignKey, entity) => callbacks.onMissingRelation(foreignKeyField, foreignKey, entity)
    : _handleMissing;

  if (!handleMissing) {
    throw Error(`entity is missing or incomplete (1)`);
  }

  await handleMissing(foreignKey, parentEntity);

  nestedEntity = store.getEntityById(foreignKey);

  if (!nestedEntity) {
    return null;
  }

  if (ensureHasFields && !hasObjectProperties(nestedEntity, ensureHasFields)) {
    throw Error(`entity is missing or incomplete (2)`);
  }

  return createProxy(nestedEntity, store.getEntityById.bind(store));
}

async function fetchNestedEntitiesForFk(store, parentEntity, foreignKeyField, foreignKeys, callbacks) {
  const associations = store.config.associationsByTypename[parentEntity.__typename];

  const { ensureHasFields, handleMissing: _handleMissing } =
    associations.find((a) => a.foreignKeyField === foreignKeyField);

  const missingOrIncompleteEntityIds =
    foreignKeys.filter((foreignKey) => {
      const nestedEntity = store.getEntityById(foreignKey);
      return !nestedEntity || (ensureHasFields && !hasObjectProperties(nestedEntity, ensureHasFields));
    });

  if (missingOrIncompleteEntityIds.length === 0) {
    return foreignKeys
      .map((foreignKey) => {
        const nestedEntity = store.getEntityById(foreignKey);
        return createProxy(nestedEntity, store.getEntityById.bind(store));
      });
  }

  const handleMissing = (callbacks.onMissingRelation)
    ? (missingOrIncompleteEntityIds, entity) => callbacks.onMissingRelation(foreignKeyField, missingOrIncompleteEntityIds, entity)
    : _handleMissing;

  if (!handleMissing) {
    throw Error(`entity is missing or incomplete (3)`);
  }

  await handleMissing(missingOrIncompleteEntityIds, parentEntity);

  const nestedEntities = foreignKeys.map((foreignKey) => store.getEntityById(foreignKey)).filter((e) => e);

  const incompleteEntities =
    nestedEntities.filter((nestedEntity) => {
      return ensureHasFields && !hasObjectProperties(nestedEntity, ensureHasFields);
    });

  if (incompleteEntities.length > 0) {
    throw Error(`entity is missing or incomplete (4)`);
  }

  return nestedEntities.map((nestedEntity) => createProxy(nestedEntity, store.getEntityById.bind(store)));
}
