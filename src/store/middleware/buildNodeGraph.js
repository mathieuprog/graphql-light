import Response from '../../response/Response';
import Node from '../../response/Node';
import ObjectType from '../../document/constants/ObjectType';
import Document from '../../document/Document';

export default function buildNodeGraph(data, document, store) {
  if (!(document instanceof Document)) {
    throw new Error();
  }

  const rootNode = doBuildNodeGraph(data, document.rootObject, store);
  return new Response(document, rootNode);
}

function doBuildNodeGraph(data, objectMeta, store, parentNode = null, fetchCached = null) {
  const node = new Node(parentNode, objectMeta, fetchCached);

  for (let [propName, propValue] of Object.entries(data)) {
    if (objectMeta.objects[propName]) {
      const nestedObjectMeta = objectMeta.objects[propName];

      switch (nestedObjectMeta.type) {
        case ObjectType.ENTITY:
          fetchCached = () => store.getEntityById(propValue.id);
          node.fields[propName] = doBuildNodeGraph(propValue, nestedObjectMeta, store, node, fetchCached);
          break;

        case ObjectType.ENTITY_LIST:
          fetchCached = (entity) => () => store.getEntityById(entity.id);
          node.fields[propName] = propValue.map((e) => doBuildNodeGraph(e, nestedObjectMeta, store, node, fetchCached(e)));
          break;

        case ObjectType.OBJECT_LITERAL:
          fetchCached = (parentNode?.fetchCached)
            ? (() => parentNode.fetchCached()?.[propName])
            : null;
          node.fields[propName] = doBuildNodeGraph(propValue, nestedObjectMeta, store, node, fetchCached);
          break;

        case ObjectType.OBJECT_LITERAL_LIST:
          fetchCached = (parentNode?.fetchCached)
            ? ((index) => () => parentNode.fetchCached()?.[propName]?.[index])
            : null;
          node.fields[propName] = propValue.map((e, i) => doBuildNodeGraph(e, nestedObjectMeta, store, node, fetchCached?.(i)));
          break;
      }

      continue;
    }

    const scalarMeta = objectMeta.scalars[propName];
    if (scalarMeta && scalarMeta.transformer) {
      propValue = scalarMeta.transformer(propValue);
    }

    node.fields[propName] = propValue;
  }

  return node;
}
