import { CustomCypherQuery } from '../types';
import { buildCypherQuery } from '../buildCypher';

describe('building a cypher query', () => {
  test('works for a single query', () => {
    const fieldName = 'testUser';
    const query: CustomCypherQuery = {
      cypher: 'MATCH (user:User) RETURN user',
      paramNames: [],
      fields: ['id', 'name'],
      params: {},
      returnsList: false,
      fieldQueries: {},
    };

    expect(buildCypherQuery({ fieldName, query, isWrite: false })).toEqual(
      `WITH apoc.cypher.runFirstColumnSingle("WITH $parent AS parent MATCH (user:User) RETURN user", {parent: $parent}) ` +
        `AS \`testUser\` ` +
        `RETURN \`testUser\` {.id, .name} AS \`testUser\``
    );
  });

  test('works for a nested field query', () => {
    const fieldName = 'testUser';
    const query: CustomCypherQuery = {
      cypher: 'MATCH (user:User) RETURN user',
      paramNames: [],
      fields: ['id', 'posts'],
      params: {},
      returnsList: false,
      fieldQueries: {
        posts: {
          cypher: 'MATCH (parent)-[:AUTHOR_OF]->(post:Post) RETURN post',
          paramNames: [],
          params: {},
          returnsList: true,
          fields: ['id', 'title'],
          fieldQueries: {},
        },
      },
    };

    expect(buildCypherQuery({ fieldName, query, isWrite: false })).toEqual(
      `WITH apoc.cypher.runFirstColumnSingle("WITH $parent AS parent MATCH (user:User) RETURN user", {parent: $parent}) ` +
        `AS \`testUser\` ` +
        `RETURN \`testUser\` {.id, posts: ` +
        `[testUser_posts IN ` +
        `apoc.cypher.runFirstColumnMany("WITH {parent} AS parent MATCH (parent)-[:AUTHOR_OF]->(post:Post) RETURN post", {parent: testUser}) ` +
        `| testUser_posts {.id, .title}]` +
        `} AS \`testUser\``
    );
  });

  test('works for a deeply nested field query', () => {
    const fieldName = 'testUser';
    const query: CustomCypherQuery = {
      cypher: 'MATCH (user:User) RETURN user',
      paramNames: [],
      fields: ['id', 'posts'],
      params: {},
      returnsList: false,
      fieldQueries: {
        posts: {
          cypher: 'MATCH (parent)-[:AUTHOR_OF]->(post:Post) RETURN post',
          paramNames: [],
          params: {},
          returnsList: true,
          fields: ['id', 'title', 'tags'],
          fieldQueries: {
            tags: {
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

    expect(buildCypherQuery({ fieldName, query, isWrite: false })).toEqual(
      `WITH apoc.cypher.runFirstColumnSingle("WITH $parent AS parent MATCH (user:User) RETURN user", {parent: $parent}) ` +
        `AS \`testUser\` ` +
        `RETURN \`testUser\` {.id, posts: ` +
        `[testUser_posts IN ` +
        `apoc.cypher.runFirstColumnMany("WITH {parent} AS parent MATCH (parent)-[:AUTHOR_OF]->(post:Post) RETURN post", {parent: testUser}) ` +
        `| testUser_posts {.id, .title, tags: [testUser_posts_tags IN apoc.cypher.runFirstColumnMany("WITH {parent} AS parent MATCH (parent)-[:HAS_TAG]->(tag:Tag) RETURN tag", {parent: testUser_posts}) | testUser_posts_tags {.id, .name}]}]` +
        `} AS \`testUser\``
    );
  });

  test('works with params', () => {
    const fieldName = 'testUser';
    const query: CustomCypherQuery = {
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

    expect(buildCypherQuery({ fieldName, query, isWrite: false })).toEqual(
      `WITH apoc.cypher.runFirstColumnSingle("WITH $parent AS parent MATCH (user:User{id: $args.id}) RETURN user", {args: $testUser_args, parent: $parent}) ` +
        `AS \`testUser\` ` +
        `RETURN \`testUser\` {.id, .name} AS \`testUser\``
    );
  });

  test('works with nested params', () => {
    const fieldName = 'testUser';
    const query: CustomCypherQuery = {
      cypher: 'MATCH (user:User) RETURN user',
      paramNames: [],
      fields: ['id', 'posts'],
      params: {},
      returnsList: false,
      fieldQueries: {
        posts: {
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

    expect(buildCypherQuery({ fieldName, query, isWrite: false })).toEqual(
      `WITH apoc.cypher.runFirstColumnSingle("WITH $parent AS parent MATCH (user:User) RETURN user", {parent: $parent}) ` +
        `AS \`testUser\` ` +
        `RETURN \`testUser\` {.id, posts: ` +
        `[testUser_posts IN ` +
        `apoc.cypher.runFirstColumnMany("WITH {parent} AS parent MATCH (parent)-[:AUTHOR_OF]->(post:Post) RETURN post LIMIT $args.limit", {args: $testUser_posts_args, parent: testUser}) ` +
        `| testUser_posts {.id, .title}]` +
        `} AS \`testUser\``
    );
  });

  test('works with top-level list field', () => {
    const fieldName = 'testPosts';
    const query: CustomCypherQuery = {
      cypher: 'MATCH (post:Post) RETURN post',
      paramNames: [],
      fields: ['id', 'title'],
      params: {},
      returnsList: true,
      fieldQueries: {},
    };

    expect(buildCypherQuery({ fieldName, query, isWrite: false })).toEqual(
      `WITH apoc.cypher.runFirstColumnMany("WITH $parent AS parent MATCH (post:Post) RETURN post", {parent: $parent}) ` +
        `AS x UNWIND x AS \`testPosts\` ` +
        `RETURN \`testPosts\` {.id, .title} AS \`testPosts\``
    );
  });

  test('works with a write query', () => {
    const fieldName = 'testCreateUser';
    const query: CustomCypherQuery = {
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

    expect(buildCypherQuery({ fieldName, query, isWrite: true })).toEqual(
      `CALL apoc.cypher.doIt("WITH $parent AS parent CREATE (user:User{name: $args.name}) RETURN user", {args: $testCreateUser_args, parent: $parent}) ` +
        `YIELD value WITH apoc.map.values(value, [keys(value)[0]])[0] AS \`testCreateUser\` ` +
        `RETURN \`testCreateUser\` {.name} AS \`testCreateUser\``
    );
  });

  test('works with a nested write query', () => {
    const fieldName = 'testCreateUser';
    const query: CustomCypherQuery = {
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
          cypher: 'MATCH (parent)-[:BELONGS_TO]->(group:Group) RETURN group',
          paramNames: [],
          params: {},
          fields: ['id', 'name'],
          returnsList: false,
          fieldQueries: {},
        },
      },
    };

    expect(buildCypherQuery({ fieldName, query, isWrite: true })).toEqual(
      `CALL apoc.cypher.doIt("WITH $parent AS parent CREATE (user:User{name: $args.name}) RETURN user", {args: $testCreateUser_args, parent: $parent}) ` +
        `YIELD value WITH apoc.map.values(value, [keys(value)[0]])[0] AS \`testCreateUser\` ` +
        `RETURN \`testCreateUser\` {.name, group: ` +
        `head([testCreateUser_group IN apoc.cypher.runFirstColumnSingle(\"WITH {parent} AS parent MATCH (parent)-[:BELONGS_TO]->(group:Group) RETURN group\", {parent: testCreateUser}) | testCreateUser_group {.id, .name}])} AS \`testCreateUser\``
    );
  });
});
