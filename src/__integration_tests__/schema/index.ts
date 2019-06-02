import typeDefs from './typeDefs';
import resolvers from './resolvers';
import { makeExecutableSchema } from 'graphql-tools';
import { applyMiddleware } from 'graphql-middleware';
import { middleware } from '../../middleware';

export default applyMiddleware(
  makeExecutableSchema({
    typeDefs,
    resolvers,
  }),
  middleware
);
