import { CypherQuery } from '../types';
import { buildQuery } from '../executeQuery';

describe('building a cypher query', () => {
  test('works for a single query', () => {
    const fieldName = 'testUser';
    const query: CypherQuery = {
      cypher: 'MATCH (user:User) RETURN user',
      params: [],
      fields: ['id', 'name'],
      fieldQueries: {},
    };

    expect(buildQuery(fieldName, query)).toEqual(
      `WITH apoc.cypher.runFirstColumn("MATCH (user:User) RETURN user", {}, true) ` +
        `AS x UNWIND x AS \`testUser\` ` +
        `RETURN \`testUser\` {.id, .name} AS \`testUser\``
    );
  });

  test('works for a nested field query', () => {
    const fieldName = 'testUser';
    const query: CypherQuery = {
      cypher: 'MATCH (user:User) RETURN user',
      params: [],
      fields: ['id', 'posts'],
      fieldQueries: {
        posts: {
          cypher: 'MATCH (parent)-[:AUTHOR_OF]->(post:Post) RETURN post',
          params: [],
          fields: ['id', 'title'],
          fieldQueries: {},
        },
      },
    };

    expect(buildQuery(fieldName, query)).toEqual(
      `WITH apoc.cypher.runFirstColumn("MATCH (user:User) RETURN user", {}, true) ` +
        `AS x UNWIND x AS \`testUser\` ` +
        `RETURN \`testUser\` {.id, .posts: ` +
        `[testUser_posts IN ` +
        `apoc.cypher.runFirstColumn("MATCH (parent)-[:AUTHOR_OF]->(post:Post) RETURN post", {parent: testUser}, true) ` +
        `| testUser_posts {.id, .title}]` +
        `} AS \`testUser\``
    );
  });

  test('works with params', () => {
    const fieldName = 'testUser';
    const query: CypherQuery = {
      cypher: 'MATCH (user:User{id: $args.id}) RETURN user',
      params: ['args'],
      fields: ['id', 'name'],
      fieldQueries: {},
    };

    expect(buildQuery(fieldName, query)).toEqual(
      `WITH apoc.cypher.runFirstColumn("MATCH (user:User{id: $args.id}) RETURN user", {args: $testUser_args}, true) ` +
        `AS x UNWIND x AS \`testUser\` ` +
        `RETURN \`testUser\` {.id, .name} AS \`testUser\``
    );
  });

  test('works with nested params', () => {
    const fieldName = 'testUser';
    const query: CypherQuery = {
      cypher: 'MATCH (user:User) RETURN user',
      params: [],
      fields: ['id', 'posts'],
      fieldQueries: {
        posts: {
          cypher:
            'MATCH (parent)-[:AUTHOR_OF]->(post:Post) RETURN post LIMIT $args.limit',
          params: ['args'],
          fields: ['id', 'title'],
          fieldQueries: {},
        },
      },
    };

    expect(buildQuery(fieldName, query)).toEqual(
      `WITH apoc.cypher.runFirstColumn("MATCH (user:User) RETURN user", {}, true) ` +
        `AS x UNWIND x AS \`testUser\` ` +
        `RETURN \`testUser\` {.id, .posts: ` +
        `[testUser_posts IN ` +
        `apoc.cypher.runFirstColumn("MATCH (parent)-[:AUTHOR_OF]->(post:Post) RETURN post LIMIT $args.limit", {args: $testUser_posts_args, parent: testUser}, true) ` +
        `| testUser_posts {.id, .title}]` +
        `} AS \`testUser\``
    );
  });
});
