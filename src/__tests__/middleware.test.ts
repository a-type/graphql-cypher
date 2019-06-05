import { graphql } from 'graphql';
import typeDefs from './fixtures/typeDefs';
import { middleware } from '../middleware';
import { makeExecutableSchema } from 'graphql-tools';
import { applyMiddleware } from 'graphql-middleware';
import neo4jDriver from './mocks/neo4jDriver';
import neo4jRecordSet from './mocks/neo4jRecordSet';

describe('the middleware', () => {
  beforeEach(() => {
    neo4jDriver._mockTransaction.run.mockClear();
  });

  test('works', async () => {
    const schema = applyMiddleware(
      makeExecutableSchema({
        typeDefs,
        resolvers: {},
      }),
      middleware
    );

    neo4jDriver._mockTransaction.run.mockResolvedValueOnce(
      neo4jRecordSet([
        {
          user: {
            name: 'Nils',
            email: 'nils@spotify.co',
            posts: [
              {
                id: '1',
                title: 'Went Missing',
              },
              {
                id: '2',
                title: 'Says',
              },
            ],
          },
        },
      ])
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
      contextValue: {
        neo4jDriver,
        cypherContext: {
          foo: 'bar',
        },
      },
    });

    expect(result.errors).toBeUndefined();

    expect(result.data).toEqual({
      user: {
        name: 'Nils',
        email: 'nils@spotify.co',
        posts: [
          {
            id: '1',
            title: 'Went Missing',
          },
          {
            id: '2',
            title: 'Says',
          },
        ],
      },
    });

    expect(neo4jDriver._mockTransaction.run).toHaveBeenCalled();
    expect(neo4jDriver._mockTransaction.run.mock.calls[0][0])
      .toMatchInlineSnapshot(`
                  "WITH $parent AS parent
                  MATCH (user:User {id: $field_user.args.id})
                  RETURN user {.name, .email, posts: [user_posts IN apoc.cypher.runFirstColumnMany(\\"WITH $parent as parent MATCH ($parent)-[:AUTHOR_OF]->(post:Post)
                  RETURN post
                  SKIP $args.pagination.offset
                  LIMIT $args.pagination.first\\", {args: $field_user_posts.args, parent: user, context: $context}) | user_posts {.id, .title}]} AS user"
            `);
    expect(neo4jDriver._mockTransaction.run.mock.calls[0][1])
      .toMatchInlineSnapshot(`
                        Object {
                          "context": Object {
                            "foo": "bar",
                          },
                          "field_user": Object {
                            "args": Object {
                              "id": "foo",
                            },
                            "generated": undefined,
                            "virtual": undefined,
                          },
                          "field_user_posts": Object {
                            "args": Object {
                              "pagination": Object {
                                "first": 10,
                                "offset": 0,
                              },
                            },
                            "generated": undefined,
                            "virtual": undefined,
                          },
                          "parent": null,
                        }
                `);
  });

  test('works with root virtual fields', async () => {
    const schema = applyMiddleware(
      makeExecutableSchema({
        typeDefs,
        resolvers: {},
      }),
      middleware
    );

    neo4jDriver._mockTransaction.run
      .mockResolvedValueOnce(
        neo4jRecordSet([
          {
            user: {
              name: 'Nils',
              email: 'nils@spotify.co',
              posts: [
                {
                  id: '1',
                  title: 'Went Missing',
                },
                {
                  id: '2',
                  title: 'Says',
                },
              ],
            },
          },
        ])
      )
      .mockResolvedValueOnce(
        neo4jRecordSet([
          {
            post: {
              id: '1',
              title: 'Went Missing',
            },
          },
        ])
      );

    const result = await graphql({
      schema,
      source: `
        query TestQuery {
          virtual(userId: "foo", postId: "bar") {
            user {
              name
              email
              posts {
                id
                title
              }
            }
            post {
              id
              title
            }
          }
        }
      `,
      contextValue: {
        neo4jDriver,
        cypherContext: {
          foo: 'bar',
        },
      },
    });

    expect(result.errors).toBeUndefined();

    expect(result.data).toEqual({
      virtual: {
        user: {
          name: 'Nils',
          email: 'nils@spotify.co',
          posts: [
            {
              id: '1',
              title: 'Went Missing',
            },
            {
              id: '2',
              title: 'Says',
            },
          ],
        },
        post: {
          id: '1',
          title: 'Went Missing',
        },
      },
    });

    expect(neo4jDriver._mockTransaction.run).toHaveBeenCalledTimes(2);
    expect(neo4jDriver._mockTransaction.run.mock.calls[0][0])
      .toMatchInlineSnapshot(`
      "WITH $parent AS parent
      MATCH (user:User {id: $field_user.virtual.userId})
      RETURN user {.name, .email, posts: [user_posts IN apoc.cypher.runFirstColumnMany(\\"WITH $parent as parent MATCH ($parent)-[:AUTHOR_OF]->(post:Post)
      RETURN post
      SKIP $args.pagination.offset
      LIMIT $args.pagination.first\\", {args: $field_user_posts.args, parent: user, context: $context}) | user_posts {.id, .title}]} AS user"
    `);
    expect(neo4jDriver._mockTransaction.run.mock.calls[0][1])
      .toMatchInlineSnapshot(`
      Object {
        "context": Object {
          "foo": "bar",
        },
        "field_user": Object {
          "args": undefined,
          "generated": undefined,
          "virtual": Object {
            "postId": "bar",
            "userId": "foo",
          },
        },
        "field_user_posts": Object {
          "args": Object {
            "pagination": Object {
              "first": 10,
              "offset": 0,
            },
          },
          "generated": undefined,
          "virtual": undefined,
        },
        "parent": Object {},
      }
    `);

    expect(neo4jDriver._mockTransaction.run.mock.calls[1][0])
      .toMatchInlineSnapshot(`
            "WITH $parent AS parent
            MATCH (post:Post {id: $field_post.virtual.postId})
            RETURN post {.id, .title} AS post"
        `);
    expect(neo4jDriver._mockTransaction.run.mock.calls[1][1])
      .toMatchInlineSnapshot(`
            Object {
              "context": Object {
                "foo": "bar",
              },
              "field_post": Object {
                "args": undefined,
                "generated": undefined,
                "virtual": Object {
                  "postId": "bar",
                  "userId": "foo",
                },
              },
              "parent": Object {},
            }
        `);
  });

  test('works with authorization', async () => {
    neo4jDriver._mockTransaction.run.mockResolvedValue(
      neo4jRecordSet([
        {
          user: {
            name: 'Nils',
            email: 'nils@spotify.co',
            posts: [
              {
                id: '1',
                title: 'Went Missing',
              },
              {
                id: '2',
                title: 'Says',
              },
            ],
          },
        },
      ])
    );

    const query = `
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
    `;

    /**
     * A resolver is added to the schema here which does not call
     * runCypher unless the user 'passes our authorization checks',
     * i.e. a context boolean is set (in this simple test case)
     */
    const schema = applyMiddleware(
      makeExecutableSchema({
        typeDefs,
        resolvers: {
          Query: {
            user: async (parent, args, ctx, info) => {
              if (!ctx.authorized) {
                return null;
              }

              const data = await parent.user(args, ctx, info);
              return data;
            },
          },
        },
      }),
      middleware
    );

    const unauthorizedResult = await graphql({
      schema,
      source: query,
      contextValue: {
        neo4jDriver,
        cypherContext: {
          foo: 'bar',
        },
        authorized: false,
      },
    });

    expect(unauthorizedResult.data).toEqual({
      user: null,
    });

    const result = await graphql({
      schema,
      source: query,
      contextValue: {
        neo4jDriver,
        cypherContext: {
          foo: 'bar',
        },
        authorized: true,
      },
    });

    expect(result.errors).toBeUndefined();

    expect(result.data).toEqual({
      user: {
        name: 'Nils',
        email: 'nils@spotify.co',
        posts: [
          {
            id: '1',
            title: 'Went Missing',
          },
          {
            id: '2',
            title: 'Says',
          },
        ],
      },
    });
  });
});
