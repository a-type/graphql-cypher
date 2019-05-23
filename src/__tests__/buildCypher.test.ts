import { CypherQuery } from '../types';
import { buildCypherQuery } from '../buildCypher';

describe('building a cypher query', () => {
  test('works for a single query', () => {
    const fieldName = 'testUser';
    const query: CypherQuery = {
      cypher: 'MATCH (user:User) RETURN user',
      params: [],
      fields: ['id', 'name'],
      args: {},
      returnsList: false,
      fieldQueries: {},
    };

    expect(buildCypherQuery({ fieldName, query })).toEqual(
      `WITH apoc.cypher.runFirstColumnSingle("WITH $parent AS parent MATCH (user:User) RETURN user", {parent: $parent}) ` +
        `AS \`testUser\` ` +
        `RETURN \`testUser\` {.id, .name} AS \`testUser\``
    );
  });

  test('works for a nested field query', () => {
    const fieldName = 'testUser';
    const query: CypherQuery = {
      cypher: 'MATCH (user:User) RETURN user',
      params: [],
      fields: ['id', 'posts'],
      args: {},
      returnsList: false,
      fieldQueries: {
        posts: {
          cypher: 'MATCH (parent)-[:AUTHOR_OF]->(post:Post) RETURN post',
          params: [],
          args: {},
          returnsList: true,
          fields: ['id', 'title'],
          fieldQueries: {},
        },
      },
    };

    expect(buildCypherQuery({ fieldName, query })).toEqual(
      `WITH apoc.cypher.runFirstColumnSingle("WITH $parent AS parent MATCH (user:User) RETURN user", {parent: $parent}) ` +
        `AS \`testUser\` ` +
        `RETURN \`testUser\` {.id, .posts: ` +
        `[testUser_posts IN ` +
        `apoc.cypher.runFirstColumnMany("WITH {parent} AS parent MATCH (parent)-[:AUTHOR_OF]->(post:Post) RETURN post", {parent: testUser}) ` +
        `| testUser_posts {.id, .title}]` +
        `} AS \`testUser\``
    );
  });

  test('works with params', () => {
    const fieldName = 'testUser';
    const query: CypherQuery = {
      cypher: 'MATCH (user:User{id: $args.id}) RETURN user',
      params: ['args'],
      args: { id: 'foo' },
      returnsList: false,
      fields: ['id', 'name'],
      fieldQueries: {},
    };

    expect(buildCypherQuery({ fieldName, query })).toEqual(
      `WITH apoc.cypher.runFirstColumnSingle("WITH $parent AS parent MATCH (user:User{id: $args.id}) RETURN user", {args: $testUser_args, parent: $parent}) ` +
        `AS \`testUser\` ` +
        `RETURN \`testUser\` {.id, .name} AS \`testUser\``
    );
  });

  test('works with nested params', () => {
    const fieldName = 'testUser';
    const query: CypherQuery = {
      cypher: 'MATCH (user:User) RETURN user',
      params: [],
      fields: ['id', 'posts'],
      args: {},
      returnsList: false,
      fieldQueries: {
        posts: {
          cypher:
            'MATCH (parent)-[:AUTHOR_OF]->(post:Post) RETURN post LIMIT $args.limit',
          params: ['args'],
          args: {
            limit: 10,
          },
          returnsList: true,
          fields: ['id', 'title'],
          fieldQueries: {},
        },
      },
    };

    expect(buildCypherQuery({ fieldName, query })).toEqual(
      `WITH apoc.cypher.runFirstColumnSingle("WITH $parent AS parent MATCH (user:User) RETURN user", {parent: $parent}) ` +
        `AS \`testUser\` ` +
        `RETURN \`testUser\` {.id, .posts: ` +
        `[testUser_posts IN ` +
        `apoc.cypher.runFirstColumnMany("WITH {parent} AS parent MATCH (parent)-[:AUTHOR_OF]->(post:Post) RETURN post LIMIT $args.limit", {args: $testUser_posts_args, parent: testUser}) ` +
        `| testUser_posts {.id, .title}]` +
        `} AS \`testUser\``
    );
  });

  test('works with top-level list field', () => {
    const fieldName = 'testPosts';
    const query: CypherQuery = {
      cypher: 'MATCH (post:Post) RETURN post',
      params: [],
      fields: ['id', 'title'],
      args: {},
      returnsList: true,
      fieldQueries: {},
    };

    expect(buildCypherQuery({ fieldName, query })).toEqual(
      `WITH apoc.cypher.runFirstColumnMany("WITH $parent AS parent MATCH (post:Post) RETURN post", {parent: $parent}) ` +
        `AS x UNWIND x AS \`testPosts\` ` +
        `RETURN \`testPosts\` {.id, .title} AS \`testPosts\``
    );
  });
});
