import { middleware, cypherResolver, autoResolver } from '../src';
import { makeExecutableSchema } from 'graphql-tools';
import { applyMiddleware } from 'graphql-middleware';
import { graphql } from 'graphql';

const typeDefs = `
directive @cypher on FIELD_DEFINITION

input Pagination {
  first: Int
  offset: Int
}

input PostFilter {
  titleMatch: String
}

type Post {
  id: ID!
  title: String!
  body: String!
}

type User {
  id: ID!
  name: String!
  email: String!

  posts(
    pagination: Pagination = { first: 10, offset: 0 }
    filter: PostFilter
  ): [Post!]! @cypher
}

type Query {
  user(id: ID!): User @cypher
}
`;

describe('the library', () => {
  test('generates placeholders for things', async () => {
    const resolvers = {
      Query: {
        user: autoResolver,
      },
      User: {
        posts: cypherResolver`
          MATCH (parent)-[:AUTHOR_OF]->(post:Post)
          ${(_parent, args) =>
            !!args.filter
              ? `
            WHERE post.title =~ $args.filter.titleMatch
            `
              : null}
          RETURN post
          SKIP $args.pagination.offset
          LIMIT $args.pagination.first
        `,
      },
    };

    const schema = applyMiddleware(
      makeExecutableSchema({
        typeDefs,
        resolvers,
      }),
      middleware
    );

    const result = await graphql({
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

    expect(result).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "user": null,
        },
        "errors": Array [
          [GraphQLError: Cannot return null for non-nullable field User.name.],
        ],
      }
    `);
  });
});
