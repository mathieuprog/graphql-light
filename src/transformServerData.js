import { isArray, isEntity, isObjectLiteral } from './utils';

export default function transformServerData(transformers, data) {
  if (isObjectLiteral(data)) {
    let object = { ...data };

    if (isEntity(object)) {
      object = transformers[`transform${object.__typename}`]?.(object) ?? object;
    }

    for (let [propName, propValue] of Object.entries(object)) {
      object[propName] = transformServerData(transformers, propValue);
    }

    return object;
  }

  if (isArray(data)) {
    let array = [...data];
    array = array.map(element => transformServerData(transformers, element));

    return array;
  }

  return data;
}
