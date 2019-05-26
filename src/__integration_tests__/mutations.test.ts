import { v1 as neo4j } from 'neo4j-driver';
import { initialize, cleanup } from './neo4j/manage';
import schema from './schema';
import { graphql } from 'graphql';
import { people } from './neo4j/seed';

const TWO_MINUTES = 2 * 60 * 1000;

describe('write mutations', () => {
  const driver = neo4j.driver('bolt://localhost:7687');
  let session: neo4j.Session;

  beforeEach(async done => {
    session = driver.session();
    try {
      await initialize();
    } catch (err) {
      done.fail(err);
    }
    done();
  }, TWO_MINUTES);

  afterEach(async done => {
    if (session) {
      await session.close();
    }
    await driver.close();
    await cleanup();
    done();
  }, TWO_MINUTES);

  test('can create a node and return it alone', async () => {
    const personCreateInput = {
      firstName: 'Bob',
      lastName: 'Belcher',
      age: 43,
    };
    const mutation = `
      mutation SimpleMutation($input: PersonCreateInput!) {
        createPerson(input: $input) {
          id
          firstName
          age
        }
      }
    `;

    const { data, errors } = await graphql({
      schema,
      source: mutation,
      variableValues: {
        input: personCreateInput,
      },
      contextValue: {
        neo4jDriver: driver,
      },
    });

    expect(errors).toBeUndefined();
    expect(data.createPerson).toBeDefined();
    // we have to extract the id and test it separately since it's random
    const {
      createPerson: { id, ...rest },
    } = data;
    expect(id).toBeDefined();
    expect(rest).toMatchInlineSnapshot(`
            Object {
              "age": 43,
              "firstName": "Bob",
            }
        `);
  });

  test('can update a node and return connected nodes', async () => {
    const personUpdateInput = {
      id: people[0].id,
      lastName: 'Gruber',
    };
    const mutation = `
      mutation NestedMutation($input: PersonUpdateInput!) {
        updatePerson(input: $input) {
          id
          firstName
          lastName
          skills {
            id
            name
          }
        }
      }
    `;

    const { data, errors } = await graphql({
      schema,
      source: mutation,
      variableValues: {
        input: personUpdateInput,
      },
      contextValue: {
        neo4jDriver: driver,
      },
    });

    expect(errors).toBeUndefined();
    expect(data).toMatchInlineSnapshot(`
      Object {
        "updatePerson": Object {
          "firstName": "Hans",
          "id": "e32ae442-f5cc-4b4e-b440-e385d5e15d57",
          "lastName": "Gruber",
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
