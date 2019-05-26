import typeDefs from './fixtures/typeDefs';
import { makeExecutableSchema } from 'graphql-tools';
import { graphql } from 'graphql';
import { extractCypherQueriesFromOperation } from '../scanQueries';
import { CypherQueryFieldMap } from '../types';

const expectCypher = async (query: string, cypherMap: CypherQueryFieldMap) => {
  const resolvers = {
    Query: {
      user: (parent, args, ctx, info) => {
        const cypherQueries = extractCypherQueriesFromOperation(info);
        expect(cypherQueries).toEqual(cypherMap);
      },
    },
  };

  const schema = makeExecutableSchema({
    typeDefs,
    resolvers,
  });

  const result = await graphql({
    schema,
    source: query,
  });

  if (result.errors) {
    throw result.errors[0];
  }
};

describe('scanning queries from an operation', () => {
  test('works on a single query', async () => {
    expect.hasAssertions();

    const query = `
      query TestQuery {
        user(id: "foo") {
          name
          email
        }
      }
    `;

    await expectCypher(query, {
      user: {
        cypher: 'MATCH (user:User {id: $args.id}) RETURN user',
        fields: ['name', 'email'],
        paramNames: ['args'],
        params: { id: 'foo' },
        returnsList: false,
        fieldQueries: {},
      },
    });
  });

  test('works on a single query with nested cypher', async () => {
    expect.hasAssertions();

    const query = `
      query TestQuery {
        user(id: "foo") {
          id
          name
          posts {
            id
            title
          }
        }
      }
    `;

    await expectCypher(query, {
      user: {
        cypher: 'MATCH (user:User {id: $args.id}) RETURN user',
        fields: ['id', 'name', 'posts'],
        paramNames: ['args'],
        params: { id: 'foo' },
        returnsList: false,
        fieldQueries: {
          posts: {
            cypher: `MATCH ($parent)-[:AUTHOR_OF]->(post:Post)
RETURN post
SKIP $args.pagination.offset
LIMIT $args.pagination.first`,
            paramNames: ['args'],
            returnsList: true,
            params: {
              pagination: {
                first: 10,
                offset: 0,
              },
            },
            fields: ['id', 'title'],
            fieldQueries: {},
          },
        },
      },
    });
  });

  test('works with non-cypher fields', async () => {
    expect.hasAssertions();

    const query = `
      query TestQuery {
        user(id: "foo") {
          id
          settings {
            id
            homepage
          }
        }
      }
    `;

    await expectCypher(query, {
      user: {
        cypher: 'MATCH (user:User {id: $args.id}) RETURN user',
        fields: ['id'],
        paramNames: ['args'],
        returnsList: false,
        params: { id: 'foo' },
        fieldQueries: {},
      },
    });
  });

  test('works with multiple branches of distinct cypher queries', async () => {
    expect.hasAssertions();

    const query = `
      query TestQuery {
        user(id: "foo") {
          id
          posts {
            id
          }
          settings {
            id
            user {
              id
              name
            }
          }
        }
      }
    `;

    await expectCypher(query, {
      user: {
        cypher: 'MATCH (user:User {id: $args.id}) RETURN user',
        fields: ['id', 'posts'],
        paramNames: ['args'],
        returnsList: false,
        params: {
          id: 'foo',
        },
        fieldQueries: {
          posts: {
            cypher: `MATCH ($parent)-[:AUTHOR_OF]->(post:Post)
RETURN post
SKIP $args.pagination.offset
LIMIT $args.pagination.first`,
            paramNames: ['args'],
            returnsList: true,
            params: {
              pagination: {
                first: 10,
                offset: 0,
              },
            },
            fields: ['id'],
            fieldQueries: {},
          },
        },
      },
      'user,settings,user': {
        cypher: 'MATCH (user:User {id: $parent.userId}) RETURN user',
        fields: ['id', 'name'],
        returnsList: false,
        paramNames: ['args'],
        params: {},
        fieldQueries: {},
      },
    });
  });

  test('matches cypher statements', async () => {
    expect.hasAssertions();

    const query = `
      query TestQuery {
        user(id: "foo") {
          id
          name
          posts(filter: { titleMatch: "bar" }, pagination: { first: 5, offset: 10 }) {
            id
            title
          }
        }
      }
    `;

    await expectCypher(query, {
      user: {
        cypher: 'MATCH (user:User {id: $args.id}) RETURN user',
        fields: ['id', 'name', 'posts'],
        paramNames: ['args'],
        returnsList: false,
        params: {
          id: 'foo',
        },
        fieldQueries: {
          posts: {
            cypher: `MATCH ($parent)-[:AUTHOR_OF]->(post:Post)
WHERE post.title =~ $args.filter.titleMatch
RETURN post
SKIP $args.pagination.offset
LIMIT $args.pagination.first`,
            fields: ['id', 'title'],
            returnsList: true,
            params: {
              filter: {
                titleMatch: 'bar',
              },
              pagination: {
                first: 5,
                offset: 10,
              },
            },
            paramNames: ['args'],
            fieldQueries: {},
          },
        },
      },
    });
  });

  test('works with aliases', async () => {
    expect.hasAssertions();

    const query = `
      query TestQuery {
        alias: user(id: "foo") {
          name
          email
          settings {
            alias2: user {
              id
            }
          }
        }
      }
    `;

    await expectCypher(query, {
      alias: {
        cypher: 'MATCH (user:User {id: $args.id}) RETURN user',
        fields: ['name', 'email'],
        paramNames: ['args'],
        params: { id: 'foo' },
        returnsList: false,
        fieldQueries: {},
      },
      'alias,settings,alias2': {
        cypher: 'MATCH (user:User {id: $parent.userId}) RETURN user',
        fields: ['id'],
        paramNames: ['args'],
        returnsList: false,
        params: {},
        fieldQueries: {},
      },
    });
  });
});
