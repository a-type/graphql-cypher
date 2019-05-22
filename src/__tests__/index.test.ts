import { graphql } from 'graphql';
import typeDefs from './fixtures/typeDefs';
import { middleware } from '..';
import { makeExecutableSchema } from 'graphql-tools';
import { applyMiddleware } from 'graphql-middleware';

const resolvers = {};

const schema = applyMiddleware(
  makeExecutableSchema({
    typeDefs,
    resolvers,
  }),
  middleware
);

describe('the library', () => {
  test('works', async () => {
    await graphql({
      schema,
      source: `
        query TestQuery {
          user(id: "foo") {
            name
            email
            posts {
              id
              title
            }
          }
        }
      `,
    });

    expect(true).toBe(true);
  });
});
