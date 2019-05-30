const MOCK_UUID = 'mock-uuid';
jest.mock('uuid', () => jest.fn(() => MOCK_UUID));

import typeDefs from './fixtures/typeDefs';
import { makeExecutableSchema } from 'graphql-tools';
import { graphql } from 'graphql';
import { extractCypherQueriesFromOperation } from '../scanQueries';
import { CypherQueryFieldMap, DirectiveNames } from '../types';

const expectCypher = async (
  query: string,
  cypherMap: CypherQueryFieldMap,
  directiveNames: DirectiveNames = {
    cypherCustom: 'cypherCustom',
    cypherSkip: 'cypherSkip',
    generateId: 'generateId',
  }
) => {
  const finalTypeDefs = typeDefs
    .replace(/@cypherCustom/g, '@' + directiveNames.cypherCustom)
    .replace(/@cypherSkip/g, '@' + directiveNames.cypherSkip);

  const resolvers = {
    Query: {
      user: (parent, args, ctx, info) => {
        const cypherQueries = extractCypherQueriesFromOperation(info, {
          directiveNames,
        });
        expect(cypherQueries).toEqual(cypherMap);
      },
    },
    Mutation: {
      createUser: (parent, args, ctx, info) => {
        const cypherQueries = extractCypherQueriesFromOperation(info, {
          directiveNames,
        });
        expect(cypherQueries).toEqual(cypherMap);
        return {
          id: MOCK_UUID,
          name: 'foo',
          email: 'bar@baz.com',
        };
      },
    },
  };

  const schema = makeExecutableSchema({
    typeDefs: finalTypeDefs,
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
        kind: 'CustomCypherQuery',
        cypher: 'MATCH (user:User {id: $args.id}) RETURN user',
        fields: ['name', 'email'],
        paramNames: ['args'],
        params: {
          args: {
            id: 'foo',
          },
        },
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
        kind: 'CustomCypherQuery',
        cypher: 'MATCH (user:User {id: $args.id}) RETURN user',
        fields: ['id', 'name', 'posts'],
        paramNames: ['args'],
        params: {
          args: {
            id: 'foo',
          },
        },
        returnsList: false,
        fieldQueries: {
          posts: {
            kind: 'CustomCypherQuery',
            cypher: `MATCH ($parent)-[:AUTHOR_OF]->(post:Post)
RETURN post
SKIP $args.pagination.offset
LIMIT $args.pagination.first`,
            paramNames: ['args'],
            returnsList: true,
            params: {
              args: {
                pagination: {
                  first: 10,
                  offset: 0,
                },
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
        kind: 'CustomCypherQuery',
        cypher: 'MATCH (user:User {id: $args.id}) RETURN user',
        fields: ['id'],
        paramNames: ['args'],
        returnsList: false,
        params: { args: { id: 'foo' } },
        fieldQueries: {},
      },
    });
  });

  test('works with custom directive names', async () => {
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

    await expectCypher(
      query,
      {
        user: {
          kind: 'CustomCypherQuery',
          cypher: 'MATCH (user:User {id: $args.id}) RETURN user',
          fields: ['id'],
          paramNames: ['args'],
          returnsList: false,
          params: { args: { id: 'foo' } },
          fieldQueries: {},
        },
      },
      {
        cypherCustom: 'myCypher',
        cypherSkip: 'myCypherSkip',
        generateId: 'myGenerateId',
      }
    );
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
        kind: 'CustomCypherQuery',
        cypher: 'MATCH (user:User {id: $args.id}) RETURN user',
        fields: ['id', 'posts'],
        paramNames: ['args'],
        returnsList: false,
        params: {
          args: {
            id: 'foo',
          },
        },
        fieldQueries: {
          posts: {
            kind: 'CustomCypherQuery',
            cypher: `MATCH ($parent)-[:AUTHOR_OF]->(post:Post)
RETURN post
SKIP $args.pagination.offset
LIMIT $args.pagination.first`,
            paramNames: ['args'],
            returnsList: true,
            params: {
              args: {
                pagination: {
                  first: 10,
                  offset: 0,
                },
              },
            },
            fields: ['id'],
            fieldQueries: {},
          },
        },
      },
      'user,settings,user': {
        kind: 'CustomCypherQuery',
        cypher: 'MATCH (user:User {id: $parent.userId}) RETURN user',
        fields: ['id', 'name'],
        returnsList: false,
        paramNames: [],
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
        kind: 'CustomCypherQuery',
        cypher: 'MATCH (user:User {id: $args.id}) RETURN user',
        fields: ['id', 'name', 'posts'],
        paramNames: ['args'],
        returnsList: false,
        params: {
          args: {
            id: 'foo',
          },
        },
        fieldQueries: {
          posts: {
            kind: 'CustomCypherQuery',
            cypher: `MATCH ($parent)-[:AUTHOR_OF]->(post:Post)
WHERE post.title =~ $args.filter.titleMatch
RETURN post
SKIP $args.pagination.offset
LIMIT $args.pagination.first`,
            fields: ['id', 'title'],
            returnsList: true,
            params: {
              args: {
                filter: {
                  titleMatch: 'bar',
                },
                pagination: {
                  first: 5,
                  offset: 10,
                },
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
        kind: 'CustomCypherQuery',
        cypher: 'MATCH (user:User {id: $args.id}) RETURN user',
        fields: ['name', 'email'],
        paramNames: ['args'],
        params: { args: { id: 'foo' } },
        returnsList: false,
        fieldQueries: {},
      },
      'alias,settings,alias2': {
        kind: 'CustomCypherQuery',
        cypher: 'MATCH (user:User {id: $parent.userId}) RETURN user',
        fields: ['id'],
        paramNames: [],
        returnsList: false,
        params: {},
        fieldQueries: {},
      },
    });
  });

  test('adds generated parameters', async () => {
    expect.hasAssertions();

    const query = `
      mutation TestMutation {
        createUser(name: "foo", email: "bar@baz.com") {
          id
          name
        }
      }
    `;

    await expectCypher(query, {
      createUser: {
        kind: 'CustomCypherQuery',
        cypher:
          'CREATE (u:User {id: $generated.id, name: $args.name, email: $args.email}) RETURN u',
        fields: ['id', 'name'],
        paramNames: ['args', 'generated'],
        params: {
          args: {
            name: 'foo',
            email: 'bar@baz.com',
          },
          generated: {
            id: MOCK_UUID,
          },
        },
        returnsList: false,
        fieldQueries: {},
      },
    });
  });
});
