import { isArray, isArrayWhereEvery } from 'object-array-utils';
import ObjectType from './constants/ObjectType';

export default class Object {
  constructor(parent, type, name, options = {}) {
    // use of _ to refer to parent node was inspired by https://github.com/djeang/parent-chaining
    this._ = parent;
    this.type = type;
    this.name = name;
    this.options = options;
    this.variables = [];
    this.objects = {};
    this.foreignKeys = {};
    this.scalars = {};
    this.fields = {};
    this.updateFilters = null;
    this.handleEntityCreated = null;
    this.handleEntityDeleted = null;
    this.handleEntityUpdated = null;
    this.toDelete = null;
    if ([ObjectType.ENTITY, ObjectType.ENTITY_LIST].includes(type)) {
      this.scalar('id');
      this.scalar('__typename');
    }
  }

  isRoot() {
    return !this.name;
  }

  entity(name) {
    return this.object_(name, ObjectType.ENTITY);
  }

  object(name) {
    return this.object_(name, ObjectType.OBJECT_LITERAL);
  }

  entityList(name, arrayOperation) {
    if (!['append', 'override', 'remove'].includes(arrayOperation)) {
      throw new Error();
    }

    return this.object_(name, ObjectType.ENTITY_LIST, { arrayOperation });
  }

  objectList(name) {
    return this.object_(name, ObjectType.OBJECT_LITERAL_LIST);
  }

  object_(name, type, options = {}) {
    const object = new Object(this, type, name, options);
    this.objects[name] = object;
    return object;
  }

  scalar(name, transformer = null) {
    const scalar = { name, transformer };
    this.scalars[name] = scalar;
    return this;
  }

  foreignKey(name, referencedTypename, handleMissing = null) {
    const foreignKey = { name, referencedTypename, handleMissing };
    this.foreignKeys[name] = foreignKey;
    return this;
  }

  useVariables(...variables) {
    if (isArrayWhereEvery(variables, isArray)) {
      if (variables.length > 1) {
        throw new Error();
      }
      variables = variables[0];
    }
    this.variables = variables;
    return this;
  }

  filterUpdates(filters) {
    this.updateFilters = filters;
    return this;
  }

  onEntityCreated(handler) {
    this.handleEntityCreated = handler;
    return this;
  }

  onEntityDeleted(handler) {
    this.handleEntityDeleted = handler;
    return this;
  }

  onEntityUpdated(handler) {
    this.handleEntityUpdated = handler;
    return this;
  }

  delete(toDelete) {
    this.toDelete = toDelete;
    return this;
  }

  end() { return this._; }
  endEntity() { if (this.type !== ObjectType.ENTITY) { throw new Error(); } return this._; }
  endEntityList() { if (this.type !== ObjectType.ENTITY_LIST) { throw new Error(); } return this._; }
  endObject() { if (this.type !== ObjectType.OBJECT_LITERAL) { throw new Error(); } return this._; }
  endObjectList() { if (this.type !== ObjectType.OBJECT_LITERAL_LIST) { throw new Error(); } return this._; }
}
