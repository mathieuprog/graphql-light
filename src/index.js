import Client from './client/Client';
import NetworkRequest from './client/NetworkRequest';
import FetchStrategy from './constants/FetchStrategy';
import OnUnobservedStrategy from './constants/OnUnobservedStrategy';
import UpdateType from './constants/UpdateType';
import GraphQLError from './errors/GraphQLError';
import NotFoundInCacheError from './errors/NotFoundInCacheError';
import Mutation from './mutation/Mutation';
import DerivedQuery from './query/DerivedQuery';
import Query from './query/Query';
import store from './store';
import {
  removeEntity,
  removeEntityById,
  updateEntity
} from './store/middleware/normalize';
import transform from './utils/transform';

export {
  Client,
  NetworkRequest,
  FetchStrategy,
  OnUnobservedStrategy,
  UpdateType,
  GraphQLError,
  NotFoundInCacheError,
  Mutation,
  DerivedQuery,
  Query,
  store,
  removeEntity,
  removeEntityById,
  updateEntity,
  transform
}
