import typeDefs from './typeDefs';
import resolvers from './resolvers';
import { makeExecutableSchema } from 'graphql-tools';
import { directives } from '../../directives';
import { applyMiddleware } from 'graphql-middleware';
import { middleware } from '../../middleware';

export default applyMiddleware(
  makeExecutableSchema({
    typeDefs,
    resolvers,
    schemaDirectives: directives,
  }),
  middleware
);
