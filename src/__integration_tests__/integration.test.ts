import { v1 as neo4j } from 'neo4j-driver';
import { initialize, cleanup } from './neo4j/manage';
import schema from './schema';
import { graphql } from 'graphql';

const FIVE_MINUTES = 5 * 60 * 1000;

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
  }, FIVE_MINUTES);

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
  }, FIVE_MINUTES);

  test('making a single, flat, in-graph query', async () => {
    const personId = 'a55bcb7c856850932514eed84ea60bf75a767d38';
    const query = `
      query SimpleQuery($id: ID!) {
        person(id: $id) {
          id
          firstName
          age
        }
      }
    `;

    const { data } = await graphql({
      schema,
      source: query,
      variableValues: {
        id: personId,
      },
    });

    expect(data).toEqual({
      person: {
        id: personId,
        firstName: 'Fred',
        age: 9,
      },
    });
  });
});
