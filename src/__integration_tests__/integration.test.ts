import { v1 as neo4j } from 'neo4j-driver';
import { initialize, cleanup } from './neo4j/manage';
import schema from './schema';
import { graphql } from 'graphql';
import { people } from './neo4j/seed';

const TWO_MINUTES = 2 * 60 * 1000;

describe('read queries', () => {
  const driver = neo4j.driver('bolt://localhost:7687');
  let session: neo4j.Session;

  beforeAll(async done => {
    try {
      await initialize();
    } catch (err) {
      done.fail(err);
    }
    done();
  }, TWO_MINUTES);

  beforeEach(async done => {
    session = driver.session();
    done();
  });

  afterEach(async done => {
    if (session) {
      await session.close();
    }
    done();
  });

  afterAll(async done => {
    await driver.close();
    await cleanup();
    done();
  }, TWO_MINUTES);

  test('a single, flat, in-graph query', async () => {
    const personId = people[0].id;
    const query = `
      query SimpleQuery($id: ID!) {
        person(id: $id) {
          id
          firstName
          age
        }
      }
    `;

    const { data, errors } = await graphql({
      schema,
      source: query,
      variableValues: {
        id: personId,
      },
      contextValue: {
        neo4jDriver: driver,
      },
    });

    expect(errors).toBeUndefined();
    expect(data).toMatchInlineSnapshot(`
                  Object {
                    "person": Object {
                      "age": 52,
                      "firstName": "Hans",
                      "id": "e32ae442-f5cc-4b4e-b440-e385d5e15d57",
                    },
                  }
            `);
  });

  test('a nested in-graph query', async () => {
    const personId = people[0].id;
    const query = `
      query NestedQuery($id: ID!) {
        person(id: $id) {
          id
          firstName
          livesIn {
            id
            name
          }
        }
      }
    `;

    const { data, errors } = await graphql({
      schema,
      source: query,
      variableValues: {
        id: personId,
      },
      contextValue: {
        neo4jDriver: driver,
      },
    });

    expect(errors).toBeUndefined();
    expect(data).toMatchInlineSnapshot(`
            Object {
              "person": Object {
                "firstName": "Hans",
                "id": "e32ae442-f5cc-4b4e-b440-e385d5e15d57",
                "livesIn": Object {
                  "id": "ca5750a6-1df3-4e21-8321-a41ee3b9df98",
                  "name": "Bahrain",
                },
              },
            }
        `);
  });

  test('a nested list in-graph query', async () => {
    const personId = people[0].id;
    const query = `
      query NestedQuery($id: ID!) {
        person(id: $id) {
          id
          firstName
          skills {
            id
            name
          }
        }
      }
    `;

    const { data, errors } = await graphql({
      schema,
      source: query,
      variableValues: {
        id: personId,
      },
      contextValue: {
        neo4jDriver: driver,
      },
    });

    expect(errors).toBeUndefined();
    expect(data).toMatchInlineSnapshot(`
      Object {
        "person": Object {
          "firstName": "Hans",
          "id": "e32ae442-f5cc-4b4e-b440-e385d5e15d57",
          "skills": Array [
            Object {
              "id": "c0b52e9a-e762-4148-a407-db425476a0c2",
              "name": "parsing",
            },
            Object {
              "id": "d5313797-8d6b-4fa6-bcfd-4574a83b056c",
              "name": "connecting",
            },
          ],
        },
      }
    `);
  });
});
