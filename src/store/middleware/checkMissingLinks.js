import {
  isArray,
  isEntityProxy,
  isObjectLiteral
} from '../../utils';

export default function checkMissingLinks(result, store) {
  doCheckMissingLinks(store.getEntities(), store.getEntities());
  return result;
}

function doCheckMissingLinks(data, entities) {
  if (isEntityProxy(data)) {
    const { id, __typename } = data;

    if (!entities[id]) {
      throw new Error(`linked entity \`{ id: '${id}', __typename: '${__typename}' }\` is missing`);
    }

  } else if (isArray(data)) {
    data.forEach(element => doCheckMissingLinks(element, entities));

  } else if (isObjectLiteral(data)) {
    for (let [propName, propValue] of Object.entries(data)) {
      if (['id', '__typename'].includes(propName)) {
        continue;
      }

      doCheckMissingLinks(propValue, entities);
    }
  }
}
