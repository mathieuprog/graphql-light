import {
  areArraysEqual,
  isArray,
  isEntity,
  isEntityProxy,
  isObjectLiteral
} from '../../utils';

export default function checkInvalidReferences(result, store) {
  doCheckInvalidReferences(store.getEntities(), store.getEntities());
  doCheckInvalidReferences(result.denormalizedData, store.getEntities());
  return result;
}

function doCheckInvalidReferences(data, entities, entity = null) {
  if (isEntity(data)) {
    entity = data;
  }

  if (isArray(data)) {
    data.forEach(element => doCheckInvalidReferences(element, entities, entity));

  } else if (isObjectLiteral(data) && !isEntityProxy(data)) {
    for (let [propName, propValue] of Object.entries(data)) {
      if (['id', '__typename'].includes(propName)) {
        continue;
      }

      let match = propName.match(/(.*?)Id$/);
      if (match) {
        let field = match[1];

        const getConfigForReference = (propName) => {
          return entity && store.config.transformers[entity.__typename]?.references?.[propName];
        };

        const config = getConfigForReference(propName);
        if (config) {
          field = config.field;
        }

        if (data[field] === undefined) {
          throw new Error(`found field \`${propName}\` but no field \`${field}\``);
        }

        if (data[field] === null && propValue === null) {
          continue;
        }

        if (data[field] === null || propValue === null) {
          throw new Error(`\`${propName}\` has id but field \`${field}\` is null`);
        }

        if (!data[field].id) {
          throw new Error(`no id found in \`${field}\``);
        }

        if (data[field].id !== propValue) {
          throw new Error(`id in \`${field}\` doesn't match id in \`${propName}\``);
        }

        continue;
      }

      match = propName.match(/(.*?)Ids$/);
      if (match) {
        const getConfigForReference = (propName) => {
          return entity && store.config.transformers[entity.__typename]?.references?.[propName];
        };

        let field = match[1];

        const config = getConfigForReference(propName);
        if (config) {
          field = config.field;
        } else {
          for (let [prop, val] of Object.entries(data)) {
            if (prop !== propName && prop.startsWith(field) && !prop.match(/(.*?)Ids?$/) && isArray(val)) {
              field = prop;
              break;
            }
          }
        }

        if (data[field] === undefined) {
          throw new Error(`found field \`${propName}\` but no field \`${field}\``);
        }

        if (data[field] === null) {
          throw new Error(`field \`${propName}\` has ids but field \`${field}\` is null`);
        }

        if (!isArray(data[field])) {
          throw new Error(`no field holding entities found for field \`${propName}\``);
        }

        if (propValue.some(id => id === undefined)) {
          throw new Error(`\`${propName}\` contains \`undefined\``);
        }

        if (!areArraysEqual(data[field].map(({ id }) => id), propValue)) {
          throw new Error(`ids in \`${field}\` don't match wih ids in \`${propName}\``);
        }

        continue;
      }

      doCheckInvalidReferences(propValue, entities, entity);
    }
  }
}
