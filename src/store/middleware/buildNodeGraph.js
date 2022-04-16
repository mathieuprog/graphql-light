import Response from '../../response/Response';
import Node from '../../response/Node';
import ObjectType from '../../document/constants/ObjectType';
import Document from '../../document/Document';
import { hasObjectProperties } from 'object-array-utils';

export default async function buildNodeGraph(document, data, store) {
  if (!(document instanceof Document)) {
    throw new Error();
  }

  const rootNode = await doBuildNodeGraph(document.rootObject, data, store);
  return new Response(document, rootNode);
}

async function doBuildNodeGraph(objectMeta, data, store, parentNode = null, fetchCached = null) {
  const node = new Node(parentNode, objectMeta, fetchCached);

  Object.values(objectMeta.scalars).forEach(({ name, transformer }) => {
    if (!data[name]) {
      throw new Error();
    }
    node.fields[name] = transformer(data[name]);
  });

  await Promise.all(Object.values(objectMeta.objects).map(async (object) => {
    // if (!data[object.name]) {
    //   throw new Error(`prop '${object.name}' not found in object: ${JSON.stringify(data)}`);
    // }

    switch (object.type) {
      case ObjectType.ENTITY:
        if (object.derivedFrom) {
          const { foreignKey, handleMissing } = object.derivedFrom;

          let cachedEntity = store.getEntityById(data[foreignKey]);

          const props = Object.keys(object.scalars).concat(Object.keys(object.objects));

          if (!cachedEntity || !hasObjectProperties(cachedEntity, props)) {
            await handleMissing(data[foreignKey], data);
          }

          cachedEntity = store.getEntityById(data[foreignKey]);

          if (!cachedEntity || !hasObjectProperties(cachedEntity, props)) {
            throw new Error();
          }

          data[object.name] = cachedEntity;
        }

        fetchCached = () => store.getEntityById(data[object.name].id);
        node.fields[object.name] = await doBuildNodeGraph(object, data[object.name], store, node, fetchCached);
        break;

      case ObjectType.ENTITY_LIST:
        // if (object.derivedFrom) {
        //   const { foreignKey, handleMissing } = object.derivedFrom;

        //   let cachedEntity = store.getEntityById(data[foreignKey]);

        //   const props = Object.keys(object.scalars).concat(Object.keys(object.objects));

        //   if (!cachedEntity || !hasObjectProperties(cachedEntity, props)) {
        //     await handleMissing(data[foreignKey], data);
        //   }

        //   cachedEntity = store.getEntityById(data[foreignKey]);

        //   if (!cachedEntity || !hasObjectProperties(cachedEntity, props)) {
        //     throw new Error();
        //   }

        //   data[object.name] = cachedEntity;
        // }

        fetchCached = (entity) => () => store.getEntityById(entity.id);
        node.fields[object.name] = await Promise.all(data[object.name].map((e) => doBuildNodeGraph(object, e, store, node, fetchCached(e))));
        break;

      case ObjectType.OBJECT_LITERAL:
        fetchCached = (fetchCached) ? (() => fetchCached()[object.name]) : null;
        node.fields[object.name] = await doBuildNodeGraph(object, data[object.name], store, node, fetchCached);
        break;

      case ObjectType.OBJECT_LITERAL_LIST:
        fetchCached = (fetchCached) ? ((i) => () => fetchCached()[object.name]?.[i]) : null;

        node.fields[object.name] = await Promise.all(data[object.name].map((e, i) => doBuildNodeGraph(nestedObjectMeta, e, store, node, fetchCached?.(i))));
        break;
    }
  }));



  // switch (objectMeta.type) {
  //   case ObjectType.ENTITY:
  //     for (let [propName, propValue] of Object.entries(objectMeta.scalars)) {
  //     }


  //     fetchCached = () => store.getEntityById(propValue.id);

  //     // const scalars = filterProperties(data, Object.keys(objectMeta.scalars));
  //     // const foreignKeys = filterProperties(data, Object.keys(objectMeta.foreignKeys));

  //     node.fields[propName] = doBuildNodeGraph(nestedObjectMeta, propValue, store, node, fetchCached);
  //     break;

  //   case ObjectType.ENTITY_LIST:
  //     fetchCached = (entity) => () => store.getEntityById(entity.id);
  //     node.fields[propName] = propValue.map((e) => doBuildNodeGraph(nestedObjectMeta, e, store, node, fetchCached(e)));
  //     break;

  //   case ObjectType.OBJECT_LITERAL:
  //     fetchCached = (parentNode?.fetchCached)
  //       ? (() => parentNode.fetchCached()?.[propName])
  //       : null;
  //     node.fields[propName] = doBuildNodeGraph(nestedObjectMeta, propValue, store, node, fetchCached);
  //     break;

  //   case ObjectType.OBJECT_LITERAL_LIST:
  //     fetchCached = (parentNode?.fetchCached)
  //       ? ((index) => () => parentNode.fetchCached()?.[propName]?.[index])
  //       : null;
  //     node.fields[propName] = propValue.map((e, i) => doBuildNodeGraph(nestedObjectMeta, e, store, node, fetchCached?.(i)));
  //     break;
  // }

  // for (let [propName, propValue] of Object.entries(data)) {
  //   if (objectMeta.objects[propName]) {
  //     const nestedObjectMeta = objectMeta.objects[propName];

  //     switch (nestedObjectMeta.type) {
  //       case ObjectType.ENTITY:
  //         fetchCached = () => store.getEntityById(propValue.id);
  //         node.fields[propName] = doBuildNodeGraph(nestedObjectMeta, propValue, store, node, fetchCached);
  //         break;

  //       case ObjectType.ENTITY_LIST:
  //         fetchCached = (entity) => () => store.getEntityById(entity.id);
  //         node.fields[propName] = propValue.map((e) => doBuildNodeGraph(nestedObjectMeta, e, store, node, fetchCached(e)));
  //         break;

  //       case ObjectType.OBJECT_LITERAL:
  //         fetchCached = (parentNode?.fetchCached)
  //           ? (() => parentNode.fetchCached()?.[propName])
  //           : null;
  //         node.fields[propName] = doBuildNodeGraph(nestedObjectMeta, propValue, store, node, fetchCached);
  //         break;

  //       case ObjectType.OBJECT_LITERAL_LIST:
  //         fetchCached = (parentNode?.fetchCached)
  //           ? ((index) => () => parentNode.fetchCached()?.[propName]?.[index])
  //           : null;
  //         node.fields[propName] = propValue.map((e, i) => doBuildNodeGraph(nestedObjectMeta, e, store, node, fetchCached?.(i)));
  //         break;
  //     }

  //     continue;
  //   }

  //   const scalarMeta = objectMeta.scalars[propName];
  //   if (scalarMeta && scalarMeta.transformer) {
  //     propValue = scalarMeta.transformer(propValue);
  //   }

  //   node.fields[propName] = propValue;
  // }

  return node;
}
