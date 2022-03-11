import {
  areArraysEqual,
  isArray,
  isEntityProxy,
  isObjectLiteral
} from '../../utils';

export default function checkInvalidReferences(result, store) {
  doCheckInvalidReferences(store.getEntities(), store.getEntities());
  return result;
}

function doCheckInvalidReferences(data, entities) {
  if (isArray(data)) {
    data.forEach(element => doCheckInvalidReferences(element, entities));

  } else if (isObjectLiteral(data) && !isEntityProxy(data)) {
    for (let [propName, propValue] of Object.entries(data)) {
      if (['id', '__typename'].includes(propName)) {
        continue;
      }

      let match = propName.match(/(.*?)Id$/);
      if (match) {
        const field = match[1];

        if (!data[field]) {
          throw new Error(`found field \`${propName}\` but no field \`${field}\``);
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
        let field = match[1];
        for (let [prop, val] of Object.entries(data)) {
          if (prop !== propName && prop.startsWith(field) && !prop.match(/(.*?)Ids?$/) && isArray(val)) {
            field = prop;
            break;
          }
        }

        if (!data[field]) {
          throw new Error(`found field \`${propName}\` but no field \`${field}\``);
        }

        if (!isArray(data[field])) {
          throw new Error(`no field holding entities found for field \`${propName}\``);
        }

        if (!areArraysEqual(data[field].map(({ id }) => id), propValue)) {
          throw new Error(`ids in \`${field}\` don't match wih ids in \`${propName}\``);
        }

        continue;
      }

      doCheckInvalidReferences(propValue, entities);
    }
  }
}
