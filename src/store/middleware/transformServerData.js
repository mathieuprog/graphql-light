import { isArray, isEntity, isObjectLiteral } from '../../utils';

export default function transformServerData(result, store) {
  if (!store.config.transformers) {
    return result;
  }

  let { denormalizedData } = result;

  denormalizedData = doTransformServerData(denormalizedData, store.config.transformers);

  return { ...result, denormalizedData };
}

function doTransformServerData(data, transformers) {
  if (isObjectLiteral(data)) {
    let object = { ...data };

    if (isEntity(object)) {
      object = transformers[`transform${object.__typename}`]?.(object) ?? object;
    }

    for (let [propName, propValue] of Object.entries(object)) {
      object[propName] = doTransformServerData(propValue, transformers);
    }

    return object;
  }

  if (isArray(data)) {
    let array = [...data];
    array = array.map(element => doTransformServerData(element, transformers));

    return array;
  }

  return data;
}
