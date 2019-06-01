import { buildCypher } from '../builder';
import { CustomCypherQuery, BuilderCypherQuery } from '../../types';

describe('cypher query builder', () => {
  describe('with builder queries', () => {
    const defaultBuilder: BuilderCypherQuery = {
      create: [],
      merge: [],
      set: [],
      delete: [],
      detachDelete: [],
      remove: [],
      kind: 'BuilderCypherQuery',
      match: '(testUser:User {id:$args.id})',
      return: 'testUser',
      paramNames: ['args'],
      fields: ['id', 'name'],
      returnsList: false,
      fieldQueries: {},
      params: {
        args: {
          id: 'foo',
        },
      },
    };

    test('works for a single query', () => {
      const fieldName = 'testUser';
      const query = defaultBuilder;

      expect(buildCypher({ fieldName, query, isWrite: false }))
        .toMatchInlineSnapshot(`
                                                                "WITH $parent AS parent
                                                                MATCH (testUser:User {id:$field_testUser.args.id})
                                                                RETURN testUser {.id, .name} AS testUser"
                                                `);
    });

    test('works for a basic nested query', () => {
      const fieldName = 'testUser';
      const query: BuilderCypherQuery = {
        ...defaultBuilder,
        fields: ['id', 'name', 'posts'],
        fieldQueries: {
          posts: {
            kind: 'NodeCypherQuery',
            relationship: 'HAS_POST',
            direction: 'OUT',
            label: 'Post',
            returnsList: true,
            paramNames: [],
            params: {},
            fields: ['id', 'title'],
            fieldQueries: {},
          },
        },
      };

      expect(buildCypher({ fieldName, query, isWrite: false }))
        .toMatchInlineSnapshot(`
                                "WITH $parent AS parent
                                MATCH (testUser:User {id:$field_testUser.args.id})
                                RETURN testUser {.id, .name, posts: [(testUser)-[testUser_posts_relationship:HAS_POST]->(testUser_posts:Post) | testUser_posts {.id, .title}]} AS testUser"
                        `);
    });

    test('works for a node query with a where clause', () => {
      const fieldName = 'testUser';
      const query: BuilderCypherQuery = {
        ...defaultBuilder,
        fields: ['id', 'name', 'posts'],
        fieldQueries: {
          posts: {
            kind: 'NodeCypherQuery',
            relationship: 'HAS_POST',
            direction: 'OUT',
            label: 'Post',
            where: 'node.likes > $args.likesGt',
            returnsList: true,
            paramNames: ['args'],
            params: {
              args: {
                likesGt: 5,
              },
            },
            fields: ['id', 'title'],
            fieldQueries: {},
          },
        },
      };

      expect(buildCypher({ fieldName, query, isWrite: false }))
        .toMatchInlineSnapshot(`
                                "WITH $parent AS parent
                                MATCH (testUser:User {id:$field_testUser.args.id})
                                RETURN testUser {.id, .name, posts: [(testUser)-[testUser_posts_relationship:HAS_POST]->(testUser_posts:Post) WHERE testUser_posts.likes > $field_testUser_posts.args.likesGt | testUser_posts {.id, .title}]} AS testUser"
                        `);
    });

    test('works for a deeply nested query (node queries)', () => {
      const fieldName = 'testUser';
      const query: BuilderCypherQuery = {
        ...defaultBuilder,
        fields: ['id', 'name', 'posts'],
        fieldQueries: {
          posts: {
            kind: 'NodeCypherQuery',
            relationship: 'HAS_POST',
            direction: 'OUT',
            label: 'Post',
            returnsList: true,
            paramNames: [],
            params: {},
            fields: ['id', 'title', 'tags', 'author'],
            fieldQueries: {
              tags: {
                kind: 'NodeCypherQuery',
                relationship: 'HAS_TAG',
                direction: 'OUT',
                label: 'Tag',
                returnsList: true,
                paramNames: [],
                params: {},
                fields: ['id', 'name'],
                fieldQueries: {},
              },
              author: {
                kind: 'NodeCypherQuery',
                relationship: 'HAS_POST',
                direction: 'IN',
                label: 'User',
                returnsList: false,
                paramNames: [],
                params: {},
                fields: ['id', 'name'],
                fieldQueries: {},
              },
            },
          },
        },
      };

      expect(buildCypher({ fieldName, query, isWrite: false }))
        .toMatchInlineSnapshot(`
                                "WITH $parent AS parent
                                MATCH (testUser:User {id:$field_testUser.args.id})
                                RETURN testUser {.id, .name, posts: [(testUser)-[testUser_posts_relationship:HAS_POST]->(testUser_posts:Post) | testUser_posts {.id, .title, tags: [(testUser_posts)-[testUser_posts_tags_relationship:HAS_TAG]->(testUser_posts_tags:Tag) | testUser_posts_tags {.id, .name}], author: head([(testUser_posts)<-[testUser_posts_author_relationship:HAS_POST]-(testUser_posts_author:User) | testUser_posts_author {.id, .name}])}]} AS testUser"
                        `);
    });

    test('works for an edge query', () => {
      const fieldName = 'testUser';
      const query: BuilderCypherQuery = {
        ...defaultBuilder,
        fields: ['id', 'name', 'posts'],
        fieldQueries: {
          posts: {
            kind: 'RelationshipCypherQuery',
            nodeLabel: 'Post',
            relationshipType: 'HAS_POST',
            direction: 'OUT',
            returnsList: true,
            paramNames: [],
            params: {},
            fields: ['isAuthor', 'post'],
            fieldQueries: {
              post: {
                kind: 'NodeCypherQuery',
                label: 'Post',
                relationship: 'HAS_POST',
                direction: 'OUT',
                returnsList: false,
                paramNames: [],
                params: {},
                fields: ['id', 'title'],
                fieldQueries: {},
              },
            },
          },
        },
      };

      expect(buildCypher({ fieldName, query, isWrite: false }))
        .toMatchInlineSnapshot(`
                                                        "WITH $parent AS parent
                                                        MATCH (testUser:User {id:$field_testUser.args.id})
                                                        RETURN testUser {.id, .name, posts: [(testUser)-[testUser_posts:HAS_POST]->(testUser_posts_node:Post) | testUser_posts {.isAuthor, post: head([()-[testUser_posts:HAS_POST]->(testUser_posts_post:Post) | testUser_posts_post {.id, .title}])}]} AS testUser"
                                          `);
    });

    test('works for an edge query with a where clause', () => {
      const fieldName = 'testUser';
      const query: BuilderCypherQuery = {
        ...defaultBuilder,
        fields: ['id', 'name', 'posts'],
        fieldQueries: {
          posts: {
            kind: 'RelationshipCypherQuery',
            nodeLabel: 'Post',
            relationshipType: 'HAS_POST',
            direction: 'OUT',
            where:
              'relationship.role = $args.role AND node.likes > $args.likesGt',
            returnsList: true,
            paramNames: ['args'],
            params: {
              args: {
                role: 'author',
                likesGt: 5,
              },
            },
            fields: ['isAuthor', 'post'],
            fieldQueries: {
              post: {
                kind: 'NodeCypherQuery',
                label: 'Post',
                relationship: 'HAS_POST',
                direction: 'OUT',
                returnsList: false,
                paramNames: [],
                params: {},
                fields: ['id', 'title'],
                fieldQueries: {},
              },
            },
          },
        },
      };

      expect(buildCypher({ fieldName, query, isWrite: false }))
        .toMatchInlineSnapshot(`
                                        "WITH $parent AS parent
                                        MATCH (testUser:User {id:$field_testUser.args.id})
                                        RETURN testUser {.id, .name, posts: [(testUser)-[testUser_posts:HAS_POST]->(testUser_posts_node:Post) WHERE testUser_posts.role = $field_testUser_posts.args.role AND testUser_posts_node.likes > $field_testUser_posts.args.likesGt | testUser_posts {.isAuthor, post: head([()-[testUser_posts:HAS_POST]->(testUser_posts_post:Post) | testUser_posts_post {.id, .title}])}]} AS testUser"
                              `);
    });

    test('works with write clauses', () => {
      const fieldName = 'testUser';
      const query: BuilderCypherQuery = {
        ...defaultBuilder,
        optionalMatch: '(globalGroup:GlobalGroup), (deleteMe:DeleteMe)',
        set: [
          'testUser.name = $args.input.name',
          'testUser.age = $args.input.age',
        ],
        merge: ['(globalGroup)-[:HAS_USER]->(testUser)'],
        delete: ['deleteMe'],
        detachDelete: ['deleteMe'], // invalid, but just for the sake of testing...
        remove: ['testUser.pending'],
      };

      expect(buildCypher({ fieldName, query, isWrite: false }))
        .toMatchInlineSnapshot(`
                                                                "WITH $parent AS parent
                                                                MATCH (testUser:User {id:$field_testUser.args.id})
                                                                OPTIONAL MATCH (globalGroup:GlobalGroup), (deleteMe:DeleteMe)
                                                                MERGE (globalGroup)-[:HAS_USER]->(testUser)
                                                                SET testUser.name = $field_testUser.args.input.name
                                                                SET testUser.age = $field_testUser.args.input.age
                                                                DELETE deleteMe
                                                                DETACH DELETE deleteMe
                                                                REMOVE testUser.pending
                                                                RETURN testUser {.id, .name} AS testUser"
                                                `);
    });

    test('works with virtual fields', () => {
      const fieldName = 'testUser';
      const query: BuilderCypherQuery = {
        ...defaultBuilder,
        fields: ['id', 'name', 'virtualPosts'],
        fieldQueries: {
          virtualPosts: {
            kind: 'VirtualCypherQuery',
            returnsList: false,
            paramNames: [],
            params: {},
            fields: ['posts'],
            fieldQueries: {
              posts: {
                kind: 'NodeCypherQuery',
                relationship: 'HAS_POST',
                direction: 'OUT',
                label: 'Post',
                returnsList: true,
                paramNames: [],
                params: {},
                fields: ['id', 'title'],
                fieldQueries: {},
              },
            },
          },
        },
      };

      expect(buildCypher({ fieldName, query, isWrite: false }))
        .toMatchInlineSnapshot(`
        "WITH $parent AS parent
        MATCH (testUser:User {id:$field_testUser.args.id})
        RETURN testUser {.id, .name, virtualPosts: {posts: [(testUser)-[testUser_virtualPosts_posts_relationship:HAS_POST]->(testUser_virtualPosts_posts:Post) | testUser_virtualPosts_posts {.id, .title}]}} AS testUser"
      `);
    });
  });

  describe('with custom cypher', () => {
    test('works for a single query', () => {
      const fieldName = 'testUser';
      const query: CustomCypherQuery = {
        kind: 'CustomCypherQuery',
        cypher: 'MATCH (user:User) RETURN user',
        paramNames: [],
        fields: ['id', 'name'],
        params: {},
        returnsList: false,
        fieldQueries: {},
      };

      expect(buildCypher({ fieldName, query, isWrite: false }))
        .toMatchInlineSnapshot(`
                                                                "WITH apoc.cypher.runFirstColumnSingle(\\"WITH $parent as parent MATCH (user:User) RETURN user\\", {parent: $parent}) AS testUser
                                                                RETURN testUser {.id, .name} AS testUser"
                                                `);
    });

    test('works for a nested field query', () => {
      const fieldName = 'testUser';
      const query: CustomCypherQuery = {
        kind: 'CustomCypherQuery',
        cypher: 'MATCH (user:User) RETURN user',
        paramNames: [],
        fields: ['id', 'posts'],
        params: {},
        returnsList: false,
        fieldQueries: {
          posts: {
            kind: 'CustomCypherQuery',
            cypher: 'MATCH (parent)-[:AUTHOR_OF]->(post:Post) RETURN post',
            paramNames: [],
            params: {},
            returnsList: true,
            fields: ['id', 'title'],
            fieldQueries: {},
          },
        },
      };

      expect(buildCypher({ fieldName, query, isWrite: false }))
        .toMatchInlineSnapshot(`
                                                                "WITH apoc.cypher.runFirstColumnSingle(\\"WITH $parent as parent MATCH (user:User) RETURN user\\", {parent: $parent}) AS testUser
                                                                RETURN testUser {.id, posts: [testUser_posts IN apoc.cypher.runFirstColumnMany(\\"WITH $parent as parent MATCH (parent)-[:AUTHOR_OF]->(post:Post) RETURN post\\", {parent: testUser}) | testUser_posts {.id, .title}]} AS testUser"
                                                `);
    });

    test('works for a deeply nested field query', () => {
      const fieldName = 'testUser';
      const query: CustomCypherQuery = {
        kind: 'CustomCypherQuery',
        cypher: 'MATCH (user:User) RETURN user',
        paramNames: [],
        fields: ['id', 'posts'],
        params: {},
        returnsList: false,
        fieldQueries: {
          posts: {
            kind: 'CustomCypherQuery',
            cypher: 'MATCH (parent)-[:AUTHOR_OF]->(post:Post) RETURN post',
            paramNames: [],
            params: {},
            returnsList: true,
            fields: ['id', 'title', 'tags'],
            fieldQueries: {
              tags: {
                kind: 'CustomCypherQuery',
                cypher: 'MATCH (parent)-[:HAS_TAG]->(tag:Tag) RETURN tag',
                paramNames: [],
                params: {},
                returnsList: true,
                fields: ['id', 'name'],
                fieldQueries: {},
              },
            },
          },
        },
      };

      expect(buildCypher({ fieldName, query, isWrite: false }))
        .toMatchInlineSnapshot(`
                                                                "WITH apoc.cypher.runFirstColumnSingle(\\"WITH $parent as parent MATCH (user:User) RETURN user\\", {parent: $parent}) AS testUser
                                                                RETURN testUser {.id, posts: [testUser_posts IN apoc.cypher.runFirstColumnMany(\\"WITH $parent as parent MATCH (parent)-[:AUTHOR_OF]->(post:Post) RETURN post\\", {parent: testUser}) | testUser_posts {.id, .title, tags: [testUser_posts_tags IN apoc.cypher.runFirstColumnMany(\\"WITH $parent as parent MATCH (parent)-[:HAS_TAG]->(tag:Tag) RETURN tag\\", {parent: testUser_posts}) | testUser_posts_tags {.id, .name}]}]} AS testUser"
                                                `);
    });

    test('works with params', () => {
      const fieldName = 'testUser';
      const query: CustomCypherQuery = {
        kind: 'CustomCypherQuery',
        cypher: 'MATCH (user:User{id: $args.id}) RETURN user',
        paramNames: ['args'],
        params: {
          args: {
            id: 'foo',
          },
        },
        returnsList: false,
        fields: ['id', 'name'],
        fieldQueries: {},
      };

      expect(buildCypher({ fieldName, query, isWrite: false }))
        .toMatchInlineSnapshot(`
                                                                "WITH apoc.cypher.runFirstColumnSingle(\\"WITH $parent as parent MATCH (user:User{id: $args.id}) RETURN user\\", {args: $field_testUser.args, parent: $parent}) AS testUser
                                                                RETURN testUser {.id, .name} AS testUser"
                                                `);
    });

    test('works with nested params', () => {
      const fieldName = 'testUser';
      const query: CustomCypherQuery = {
        kind: 'CustomCypherQuery',
        cypher: 'MATCH (user:User) RETURN user',
        paramNames: [],
        fields: ['id', 'posts'],
        params: {},
        returnsList: false,
        fieldQueries: {
          posts: {
            kind: 'CustomCypherQuery',
            cypher:
              'MATCH (parent)-[:AUTHOR_OF]->(post:Post) RETURN post LIMIT $args.limit',
            paramNames: ['args'],
            params: {
              args: {
                limit: 10,
              },
            },
            returnsList: true,
            fields: ['id', 'title'],
            fieldQueries: {},
          },
        },
      };

      expect(buildCypher({ fieldName, query, isWrite: false }))
        .toMatchInlineSnapshot(`
                                                                "WITH apoc.cypher.runFirstColumnSingle(\\"WITH $parent as parent MATCH (user:User) RETURN user\\", {parent: $parent}) AS testUser
                                                                RETURN testUser {.id, posts: [testUser_posts IN apoc.cypher.runFirstColumnMany(\\"WITH $parent as parent MATCH (parent)-[:AUTHOR_OF]->(post:Post) RETURN post LIMIT $args.limit\\", {args: $field_testUser_posts.args, parent: testUser}) | testUser_posts {.id, .title}]} AS testUser"
                                                `);
    });

    test('works with top-level list field', () => {
      const fieldName = 'testPosts';
      const query: CustomCypherQuery = {
        kind: 'CustomCypherQuery',
        cypher: 'MATCH (post:Post) RETURN post',
        paramNames: [],
        fields: ['id', 'title'],
        params: {},
        returnsList: true,
        fieldQueries: {},
      };

      expect(buildCypher({ fieldName, query, isWrite: false }))
        .toMatchInlineSnapshot(`
                                                                "WITH apoc.cypher.runFirstColumnMany(\\"WITH $parent as parent MATCH (post:Post) RETURN post\\", {parent: $parent}) AS x UNWIND x AS testPosts
                                                                RETURN testPosts {.id, .title} AS testPosts"
                                                `);
    });

    test('works with a write query', () => {
      const fieldName = 'testCreateUser';
      const query: CustomCypherQuery = {
        kind: 'CustomCypherQuery',
        cypher: 'CREATE (user:User{name: $args.name}) RETURN user',
        paramNames: ['args'],
        params: {
          args: {
            name: 'blah',
          },
        },
        fields: ['name'],
        returnsList: false,
        fieldQueries: {},
      };

      expect(buildCypher({ fieldName, query, isWrite: true }))
        .toMatchInlineSnapshot(`
                                                                "CALL apoc.cypher.doIt(\\"WITH $parent as parent CREATE (user:User{name: $args.name}) RETURN user\\", {args: $field_testCreateUser.args, parent: $parent})
                                                                YIELD value WITH apoc.map.values(value, [keys(value)[0]])[0] AS \`testCreateUser\`
                                                                RETURN testCreateUser {.name} AS testCreateUser"
                                                `);
    });

    test('works with a nested write query', () => {
      const fieldName = 'testCreateUser';
      const query: CustomCypherQuery = {
        kind: 'CustomCypherQuery',
        cypher: 'CREATE (user:User{name: $args.name}) RETURN user',
        paramNames: ['args'],
        params: {
          args: {
            name: 'blah',
          },
        },
        fields: ['name', 'group'],
        returnsList: false,
        fieldQueries: {
          group: {
            kind: 'CustomCypherQuery',
            cypher: 'MATCH (parent)-[:BELONGS_TO]->(group:Group) RETURN group',
            paramNames: [],
            params: {},
            fields: ['id', 'name'],
            returnsList: false,
            fieldQueries: {},
          },
        },
      };

      expect(buildCypher({ fieldName, query, isWrite: true }))
        .toMatchInlineSnapshot(`
                                                                "CALL apoc.cypher.doIt(\\"WITH $parent as parent CREATE (user:User{name: $args.name}) RETURN user\\", {args: $field_testCreateUser.args, parent: $parent})
                                                                YIELD value WITH apoc.map.values(value, [keys(value)[0]])[0] AS \`testCreateUser\`
                                                                RETURN testCreateUser {.name, group: head([testCreateUser_group IN apoc.cypher.runFirstColumnSingle(\\"WITH $parent as parent MATCH (parent)-[:BELONGS_TO]->(group:Group) RETURN group\\", {parent: testCreateUser}) | testCreateUser_group {.id, .name}])} AS testCreateUser"
                                                `);
    });
  });

  describe('with a combination of builder and custom', () => {
    test('works starting from custom cypher', () => {
      const fieldName = 'testUser';
      const query: CustomCypherQuery = {
        kind: 'CustomCypherQuery',
        cypher: 'MATCH (user:User {id: $args.id}) RETURN user',
        returnsList: false,
        paramNames: ['args'],
        params: { args: { id: 'foo' } },
        fields: ['id', 'posts'],
        fieldQueries: {
          posts: {
            kind: 'NodeCypherQuery',
            label: 'Post',
            relationship: 'HAS_POST',
            direction: 'OUT',
            paramNames: [],
            params: {},
            returnsList: true,
            fields: ['id', 'title', 'tags'],
            fieldQueries: {
              tags: {
                kind: 'CustomCypherQuery',
                cypher: 'MATCH (parent)-[:HAS_TAG]->(tag:Tag)',
                returnsList: true,
                paramNames: [],
                params: {},
                fields: ['id', 'name'],
                fieldQueries: {},
              },
            },
          },
        },
      };

      expect(buildCypher({ query, fieldName, isWrite: false }))
        .toMatchInlineSnapshot(`
                                "WITH apoc.cypher.runFirstColumnSingle(\\"WITH $parent as parent MATCH (user:User {id: $args.id}) RETURN user\\", {args: $field_testUser.args, parent: $parent}) AS testUser
                                RETURN testUser {.id, posts: [(testUser)-[testUser_posts_relationship:HAS_POST]->(testUser_posts:Post) | testUser_posts {.id, .title, tags: [testUser_posts_tags IN apoc.cypher.runFirstColumnMany(\\"WITH $parent as parent MATCH (parent)-[:HAS_TAG]->(tag:Tag)\\", {parent: testUser_posts}) | testUser_posts_tags {.id, .name}]}]} AS testUser"
                        `);
    });

    test('works starting from builder', () => {
      const fieldName = 'testUser';
      const query: BuilderCypherQuery = {
        kind: 'BuilderCypherQuery',
        match: '(user:User {id: $args.id})',
        set: [],
        create: [],
        merge: [],
        delete: [],
        detachDelete: [],
        remove: [],
        return: 'user',
        returnsList: false,
        paramNames: ['args'],
        params: { args: { id: 'foo' } },
        fields: ['id', 'posts'],
        fieldQueries: {
          posts: {
            kind: 'CustomCypherQuery',
            cypher: 'MATCH (parent)-[:HAS_POST]->(post:Post)',
            returnsList: false,
            paramNames: [],
            params: {},
            fields: ['id', 'tags'],
            fieldQueries: {
              tags: {
                kind: 'NodeCypherQuery',
                label: 'Tag',
                relationship: 'HAS_TAG',
                direction: 'OUT',
                returnsList: true,
                paramNames: [],
                params: {},
                fields: ['id', 'name'],
                fieldQueries: {},
              },
            },
          },
        },
      };

      expect(buildCypher({ query, fieldName, isWrite: false }))
        .toMatchInlineSnapshot(`
                        "WITH $parent AS parent
                        MATCH (user:User {id: $field_testUser.args.id})
                        RETURN user {.id, posts: head([testUser_posts IN apoc.cypher.runFirstColumnSingle(\\"WITH $parent as parent MATCH (parent)-[:HAS_POST]->(post:Post)\\", {parent: user}) | testUser_posts {.id, tags: [(testUser_posts)-[testUser_posts_tags_relationship:HAS_TAG]->(testUser_posts_tags:Tag) | testUser_posts_tags {.id, .name}]}])} AS testUser"
                  `);
    });
  });
});
