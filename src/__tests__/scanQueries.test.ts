const MOCK_UUID = 'mock-uuid';
jest.mock('uuid', () => jest.fn(() => MOCK_UUID));

import typeDefs from './fixtures/typeDefs';
import { makeExecutableSchema } from 'graphql-tools';
import { graphql } from 'graphql';
import { extractCypherQueriesFromOperation } from '../scanQueries';
import { DirectiveNames } from '../types';
import { DEFAULT_DIRECTIVE_NAMES } from '../constants';
import { directives } from '../directives';

const expectCypher = async (
  query: string,
  directiveNames: DirectiveNames = DEFAULT_DIRECTIVE_NAMES
) => {
  return new Promise(async (resolve, reject) => {
    const finalTypeDefs = typeDefs
      .replace(/@cypherCustom/g, '@' + directiveNames.cypherCustom)
      .replace(/@cypherSkip/g, '@' + directiveNames.cypherSkip)
      .replace(/@cypher/g, '@' + directiveNames.cypher)
      .replace(/@cypherNode/g, '@' + directiveNames.cypherNode)
      .replace(/@cypherRelationship/g, '@' + directiveNames.cypherRelationship)
      .replace(/@cypherVirtual/g, '@' + directiveNames.cypherVirtual);

    const resolvers = {
      Query: {
        user: (parent, args, ctx, info) => {
          const cypherQueries = extractCypherQueriesFromOperation(info, {
            directiveNames,
          });
          resolve(cypherQueries);
        },
      },
      Mutation: {
        createUser: (parent, args, ctx, info) => {
          const cypherQueries = extractCypherQueriesFromOperation(info, {
            directiveNames,
          });
          resolve(cypherQueries);
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
      schemaDirectives: directives,
    });

    const result = await graphql({
      schema,
      source: query,
    });

    if (result.errors) {
      console.error(result.errors);
      reject(result.errors);
    }
  });
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

    const result = await expectCypher(query);
    expect(result).toMatchInlineSnapshot(`
                        Object {
                          "user": Object {
                            "create": Array [],
                            "delete": Array [],
                            "detachDelete": Array [],
                            "fieldQueries": Object {},
                            "fields": Array [
                              "name",
                              "email",
                            ],
                            "kind": "BuilderCypherQuery",
                            "limit": undefined,
                            "match": "(user:User {id: $args.id})",
                            "merge": Array [],
                            "optionalMatch": undefined,
                            "orderBy": undefined,
                            "paramNames": Array [
                              "args",
                            ],
                            "params": Object {
                              "args": Object {
                                "id": "foo",
                              },
                            },
                            "remove": Array [],
                            "return": "user",
                            "returnsList": false,
                            "set": Array [],
                            "skip": undefined,
                          },
                        }
                `);
  });

  test('works on a single query with nested nodes', async () => {
    expect.hasAssertions();

    const query = `
      query TestQuery {
        user(id: "foo") {
          id
          name
          simplePosts {
            id
            title
          }
        }
      }
    `;

    const result = await expectCypher(query);
    expect(result).toMatchInlineSnapshot(`
                  Object {
                    "user": Object {
                      "create": Array [],
                      "delete": Array [],
                      "detachDelete": Array [],
                      "fieldQueries": Object {
                        "simplePosts": Object {
                          "direction": "OUT",
                          "fieldQueries": Object {},
                          "fields": Array [
                            "id",
                            "title",
                          ],
                          "kind": "NodeCypherQuery",
                          "label": "Post",
                          "paramNames": Array [],
                          "params": Object {},
                          "relationship": "HAS_POST",
                          "returnsList": true,
                          "where": undefined,
                        },
                      },
                      "fields": Array [
                        "id",
                        "name",
                        "simplePosts",
                      ],
                      "kind": "BuilderCypherQuery",
                      "limit": undefined,
                      "match": "(user:User {id: $args.id})",
                      "merge": Array [],
                      "optionalMatch": undefined,
                      "orderBy": undefined,
                      "paramNames": Array [
                        "args",
                      ],
                      "params": Object {
                        "args": Object {
                          "id": "foo",
                        },
                      },
                      "remove": Array [],
                      "return": "user",
                      "returnsList": false,
                      "set": Array [],
                      "skip": undefined,
                    },
                  }
            `);
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

    const result = await expectCypher(query);
    expect(result).toMatchInlineSnapshot(`
                        Object {
                          "user": Object {
                            "create": Array [],
                            "delete": Array [],
                            "detachDelete": Array [],
                            "fieldQueries": Object {},
                            "fields": Array [
                              "id",
                            ],
                            "kind": "BuilderCypherQuery",
                            "limit": undefined,
                            "match": "(user:User {id: $args.id})",
                            "merge": Array [],
                            "optionalMatch": undefined,
                            "orderBy": undefined,
                            "paramNames": Array [
                              "args",
                            ],
                            "params": Object {
                              "args": Object {
                                "id": "foo",
                              },
                            },
                            "remove": Array [],
                            "return": "user",
                            "returnsList": false,
                            "set": Array [],
                            "skip": undefined,
                          },
                        }
                `);
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

    const result = await expectCypher(query, {
      cypherCustom: 'myCypherCustom',
      cypherSkip: 'myCypherSkip',
      generateId: 'myGenerateId',
      cypher: 'myCypher',
      cypherNode: 'myCypherNode',
      cypherRelationship: 'myCypherRelationship',
      cypherVirtual: 'myCypherVirtual',
    });
    expect(result).toMatchInlineSnapshot(`
                        Object {
                          "user": Object {
                            "create": Array [],
                            "delete": Array [],
                            "detachDelete": Array [],
                            "fieldQueries": Object {},
                            "fields": Array [
                              "id",
                            ],
                            "kind": "BuilderCypherQuery",
                            "limit": undefined,
                            "match": "(user:User {id: $args.id})",
                            "merge": Array [],
                            "optionalMatch": undefined,
                            "orderBy": undefined,
                            "paramNames": Array [
                              "args",
                            ],
                            "params": Object {
                              "args": Object {
                                "id": "foo",
                              },
                            },
                            "remove": Array [],
                            "return": "user",
                            "returnsList": false,
                            "set": Array [],
                            "skip": undefined,
                          },
                        }
                `);
  });

  test('works with multiple branches of distinct queries', async () => {
    expect.hasAssertions();

    const query = `
      query TestQuery {
        user(id: "foo") {
          id
          simplePosts {
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

    const result = await expectCypher(query);
    expect(result).toMatchInlineSnapshot(`
                  Object {
                    "user": Object {
                      "create": Array [],
                      "delete": Array [],
                      "detachDelete": Array [],
                      "fieldQueries": Object {
                        "simplePosts": Object {
                          "direction": "OUT",
                          "fieldQueries": Object {},
                          "fields": Array [
                            "id",
                          ],
                          "kind": "NodeCypherQuery",
                          "label": "Post",
                          "paramNames": Array [],
                          "params": Object {},
                          "relationship": "HAS_POST",
                          "returnsList": true,
                          "where": undefined,
                        },
                      },
                      "fields": Array [
                        "id",
                        "simplePosts",
                      ],
                      "kind": "BuilderCypherQuery",
                      "limit": undefined,
                      "match": "(user:User {id: $args.id})",
                      "merge": Array [],
                      "optionalMatch": undefined,
                      "orderBy": undefined,
                      "paramNames": Array [
                        "args",
                      ],
                      "params": Object {
                        "args": Object {
                          "id": "foo",
                        },
                      },
                      "remove": Array [],
                      "return": "user",
                      "returnsList": false,
                      "set": Array [],
                      "skip": undefined,
                    },
                    "user,settings,user": Object {
                      "create": Array [],
                      "delete": Array [],
                      "detachDelete": Array [],
                      "fieldQueries": Object {},
                      "fields": Array [
                        "id",
                        "name",
                      ],
                      "kind": "BuilderCypherQuery",
                      "limit": undefined,
                      "match": "(user:User {id: $parent.userId})",
                      "merge": Array [],
                      "optionalMatch": undefined,
                      "orderBy": undefined,
                      "paramNames": Array [],
                      "params": Object {},
                      "remove": Array [],
                      "return": "user",
                      "returnsList": false,
                      "set": Array [],
                      "skip": undefined,
                    },
                  }
            `);
  });

  test('works with custom cypher fields', async () => {
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

    const result = await expectCypher(query);
    expect(result).toMatchInlineSnapshot(`
                        Object {
                          "user": Object {
                            "create": Array [],
                            "delete": Array [],
                            "detachDelete": Array [],
                            "fieldQueries": Object {
                              "posts": Object {
                                "cypher": "MATCH ($parent)-[:AUTHOR_OF]->(post:Post)
                        WHERE post.title =~ $args.filter.titleMatch
                        RETURN post
                        SKIP $args.pagination.offset
                        LIMIT $args.pagination.first",
                                "fieldQueries": Object {},
                                "fields": Array [
                                  "id",
                                  "title",
                                ],
                                "kind": "CustomCypherQuery",
                                "paramNames": Array [
                                  "args",
                                ],
                                "params": Object {
                                  "args": Object {
                                    "filter": Object {
                                      "titleMatch": "bar",
                                    },
                                    "pagination": Object {
                                      "first": 5,
                                      "offset": 10,
                                    },
                                  },
                                },
                                "returnsList": true,
                              },
                            },
                            "fields": Array [
                              "id",
                              "name",
                              "posts",
                            ],
                            "kind": "BuilderCypherQuery",
                            "limit": undefined,
                            "match": "(user:User {id: $args.id})",
                            "merge": Array [],
                            "optionalMatch": undefined,
                            "orderBy": undefined,
                            "paramNames": Array [
                              "args",
                            ],
                            "params": Object {
                              "args": Object {
                                "id": "foo",
                              },
                            },
                            "remove": Array [],
                            "return": "user",
                            "returnsList": false,
                            "set": Array [],
                            "skip": undefined,
                          },
                        }
                `);
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

    const result = await expectCypher(query);
    expect(result).toMatchInlineSnapshot(`
                        Object {
                          "alias": Object {
                            "create": Array [],
                            "delete": Array [],
                            "detachDelete": Array [],
                            "fieldQueries": Object {},
                            "fields": Array [
                              "name",
                              "email",
                            ],
                            "kind": "BuilderCypherQuery",
                            "limit": undefined,
                            "match": "(user:User {id: $args.id})",
                            "merge": Array [],
                            "optionalMatch": undefined,
                            "orderBy": undefined,
                            "paramNames": Array [
                              "args",
                            ],
                            "params": Object {
                              "args": Object {
                                "id": "foo",
                              },
                            },
                            "remove": Array [],
                            "return": "user",
                            "returnsList": false,
                            "set": Array [],
                            "skip": undefined,
                          },
                          "alias,settings,alias2": Object {
                            "create": Array [],
                            "delete": Array [],
                            "detachDelete": Array [],
                            "fieldQueries": Object {},
                            "fields": Array [
                              "id",
                            ],
                            "kind": "BuilderCypherQuery",
                            "limit": undefined,
                            "match": "(user:User {id: $parent.userId})",
                            "merge": Array [],
                            "optionalMatch": undefined,
                            "orderBy": undefined,
                            "paramNames": Array [],
                            "params": Object {},
                            "remove": Array [],
                            "return": "user",
                            "returnsList": false,
                            "set": Array [],
                            "skip": undefined,
                          },
                        }
                `);
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

    const result = await expectCypher(query);
    expect(result).toMatchInlineSnapshot(`
                        Object {
                          "createUser": Object {
                            "create": Array [
                              "(user:User {id: $generated.id, name: $args.name, email: $args.email})",
                            ],
                            "delete": Array [],
                            "detachDelete": Array [],
                            "fieldQueries": Object {},
                            "fields": Array [
                              "id",
                              "name",
                            ],
                            "kind": "BuilderCypherQuery",
                            "limit": undefined,
                            "match": undefined,
                            "merge": Array [],
                            "optionalMatch": undefined,
                            "orderBy": undefined,
                            "paramNames": Array [
                              "args",
                              "generated",
                            ],
                            "params": Object {
                              "args": Object {
                                "email": "bar@baz.com",
                                "name": "foo",
                              },
                              "generated": Object {
                                "id": "mock-uuid",
                              },
                            },
                            "remove": Array [],
                            "return": "user",
                            "returnsList": false,
                            "set": Array [],
                            "skip": undefined,
                          },
                        }
                `);
  });

  test('works with virtual fields and passes on params', async () => {
    expect.hasAssertions();

    const query = `
      query TestQuery {
        user(id: "foo") {
          id
          name
          postsConnection(titleMatch: "foo") {
            posts {
              id
              title
            }
          }
        }
      }
    `;

    const result = await expectCypher(query);
    expect(result).toMatchInlineSnapshot(`
      Object {
        "user": Object {
          "create": Array [],
          "delete": Array [],
          "detachDelete": Array [],
          "fieldQueries": Object {
            "postsConnection": Object {
              "fieldQueries": Object {
                "posts": Object {
                  "direction": "OUT",
                  "fieldQueries": Object {},
                  "fields": Array [
                    "id",
                    "title",
                  ],
                  "kind": "NodeCypherQuery",
                  "label": "Post",
                  "paramNames": Array [
                    "virtual",
                  ],
                  "params": Object {
                    "virtual": Object {
                      "titleMatch": "foo",
                    },
                  },
                  "relationship": "HAS_POST",
                  "returnsList": true,
                  "where": "node.title =~ $virtual.titleMatch",
                },
              },
              "fields": Array [
                "posts",
              ],
              "kind": "VirtualCypherQuery",
              "paramNames": Array [
                "args",
              ],
              "params": Object {
                "args": Object {
                  "titleMatch": "foo",
                },
              },
              "returnsList": false,
            },
          },
          "fields": Array [
            "id",
            "name",
            "postsConnection",
          ],
          "kind": "BuilderCypherQuery",
          "limit": undefined,
          "match": "(user:User {id: $args.id})",
          "merge": Array [],
          "optionalMatch": undefined,
          "orderBy": undefined,
          "paramNames": Array [
            "args",
          ],
          "params": Object {
            "args": Object {
              "id": "foo",
            },
          },
          "remove": Array [],
          "return": "user",
          "returnsList": false,
          "set": Array [],
          "skip": undefined,
        },
      }
    `);
  });
});
