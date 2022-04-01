import { isArray, isArrayWhereEvery } from 'object-array-utils';
import ObjectType from './constants/ObjectType';

export default class Object {
  constructor(parent, type, name, options = {}) {
    this._ = parent;
    this.type = type;
    this.name = name;
    this.options = options;
    this.objects = [];
    this.variables = [];
    this.scalars = ([ObjectType.ENTITY, ObjectType.ENTITY_LIST].includes(type))
      ? ['id', '__typename']
      : [];
  }

  isRoot() {
    return !this.name;
  }

  entity(name) {
    return this.object(name, ObjectType.ENTITY);
  }

  entityList(name, arrayOperation) {
    if (!['append', 'override', 'remove'].includes(arrayOperation)) {
      throw new Error();
    }

    return this.object(name, ObjectType.ENTITY_LIST, { arrayOperation });
  }

  list(name) {
    return this.object(name, ObjectType.LIST);
  }

  object(name, type, options = {}) {
    const object = new Object(this, type, name, options);
    this.objects.push(object);
    return object;
  }

  scalar(name) {
    this.scalars.push(name);
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

  end() {
    return this._;
  }
}
