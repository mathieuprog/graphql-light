import { isArray, isArrayWhereEvery } from 'object-array-utils';
import ObjectType from './constants/ObjectType';

export default class Object {
  constructor(parent, type, name) {
    // use of _ to refer to parent node was inspired by https://github.com/djeang/parent-chaining
    this._ = parent;
    this.type = type;
    this.name = name;
    this.variables = [];
    this.scalars = {};
    this.objects = {};
    this.derivedFrom = null;
    this.updateFilters = null;
    this.handleEntityCreated = null;
    this.handleEntityDeleted = null;
    this.handleEntityUpdated = null;
    this.isToBeDeleted = null;
    if ([ObjectType.ENTITY, ObjectType.ENTITY_LIST].includes(type)) {
      this.scalar('id');
      this.scalar('__typename');
    }
  }

  isRoot() {
    return !this.name;
  }

  scalar(name, transformer = ((v) => v)) {
    this.scalars[name] = { name, transformer };
    return this;
  }

  entity(name) {
    return this.object_(name, ObjectType.ENTITY);
  }

  object(name) {
    return this.object_(name, ObjectType.OBJECT_LITERAL);
  }

  entityList(name) {
    return this.object_(name, ObjectType.ENTITY_LIST);
  }

  objectList(name) {
    return this.object_(name, ObjectType.OBJECT_LITERAL_LIST);
  }

  object_(name, type) {
    const object = new Object(this, type, name);
    this.objects[name] = object;
    return object;
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

  deriveFromForeignKey(foreignKey, handleMissing = null) {
    this.derivedFrom = { foreignKey, handleMissing };
    return this;
  }

  appendElements() {
    this.appendElements = true;
    return this;
  }

  overrideElements() {
    this.overrideElements = true;
    return this;
  }

  removeElements() {
    this.removeElements = true;
    return this;
  }

  deleteElements() {
    this.isToBeDeleted = true;
    return this;
  }

  delete() {
    this.isToBeDeleted = true;
    return this;
  }

  end() { return this._; }
  endEntity() { if (this.type !== ObjectType.ENTITY) { throw new Error(); } return this._; }
  endEntityList() { if (this.type !== ObjectType.ENTITY_LIST) { throw new Error(); } return this._; }
  endObject() { if (this.type !== ObjectType.OBJECT_LITERAL) { throw new Error(); } return this._; }
  endObjectList() { if (this.type !== ObjectType.OBJECT_LITERAL_LIST) { throw new Error(); } return this._; }
}
