import { v1 as neo4j } from 'neo4j-driver';
import { initialize, cleanup, BOLT_PORT } from './neo4j/manage';
import schema from './schema';
import { graphql } from 'graphql';
import { people, companies } from './neo4j/seed';

const TWO_MINUTES = 2 * 60 * 1000;

describe('read queries', () => {
  const driver = neo4j.driver('bolt://localhost:' + BOLT_PORT);
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

  test('a list in-graph query', async () => {
    const query = `
      query SimpleListQuery {
        people {
          id
          firstName
          age
        }
      }
    `;

    const { data, errors } = await graphql({
      schema,
      source: query,
      variableValues: {},
      contextValue: {
        neo4jDriver: driver,
      },
    });

    expect(errors).toBeUndefined();
    expect(data).toMatchInlineSnapshot(`
                                                                        Object {
                                                                          "people": Array [
                                                                            Object {
                                                                              "age": 52,
                                                                              "firstName": "Hans",
                                                                              "id": "e32ae442-f5cc-4b4e-b440-e385d5e15d57",
                                                                            },
                                                                            Object {
                                                                              "age": 25,
                                                                              "firstName": "Chaim",
                                                                              "id": "a5b5cf90-f791-4db7-bd9b-1f933451f548",
                                                                            },
                                                                            Object {
                                                                              "age": 69,
                                                                              "firstName": "Cynthia",
                                                                              "id": "5bb0662c-51ab-4ff1-8b29-d8ec2c81117c",
                                                                            },
                                                                            Object {
                                                                              "age": 63,
                                                                              "firstName": "Jovan",
                                                                              "id": "6faf1283-135f-415a-bde6-551f77dfcc06",
                                                                            },
                                                                            Object {
                                                                              "age": 47,
                                                                              "firstName": "Jared",
                                                                              "id": "c448cd7e-4752-49fa-9b19-210423fde28a",
                                                                            },
                                                                          ],
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
                                "id": "b939950a-c014-4e2f-91b0-60c6c79fc0a0",
                                "name": "devops",
                              },
                              Object {
                                "id": "1c161eab-5ba0-45b0-b9f9-a4786262a7ea",
                                "name": "typescript",
                              },
                              Object {
                                "id": "2fc8e1d2-bad5-4ed7-8df3-3501a452b2f2",
                                "name": "graph databases",
                              },
                              Object {
                                "id": "8c0b52e9-ae76-4214-8e40-7db425476a0c",
                                "name": "graphql",
                              },
                              Object {
                                "id": "d5313797-8d6b-4fa6-bcfd-4574a83b056c",
                                "name": "react",
                              },
                            ],
                          },
                        }
                `);
  });

  test('a filtered nested list in-graph query', async () => {
    const personId = people[0].id;
    const query = `
      query NestedQuery($id: ID!) {
        person(id: $id) {
          id
          firstName
          skills(strength: "strong", category: "frontend") {
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
                                "id": "1c161eab-5ba0-45b0-b9f9-a4786262a7ea",
                                "name": "typescript",
                              },
                              Object {
                                "id": "d5313797-8d6b-4fa6-bcfd-4574a83b056c",
                                "name": "react",
                              },
                            ],
                          },
                        }
                `);
  });

  test('a query that includes non-graph fields', async () => {
    const personId = people[0].id;
    const query = `
      query NestedQuery($id: ID!) {
        person(id: $id) {
          id
          firstName
          jobApplications {
            id
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
                                                                      "jobApplications": Array [
                                                                        Object {
                                                                          "id": "application1",
                                                                        },
                                                                        Object {
                                                                          "id": "application2",
                                                                        },
                                                                      ],
                                                                    },
                                                                  }
                                            `);
  });

  test('a query with mutiple cypher queries between skipped layers', async () => {
    const personId = people[0].id;
    const query = `
      query NestedQuery($id: ID!) {
        person(id: $id) {
          id
          firstName
          jobApplications {
            id
            company {
              id
              name
            }
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
                            "jobApplications": Array [
                              Object {
                                "company": Object {
                                  "id": "f5fdb0b7-8633-4154-ad06-f13caa1fdd15",
                                  "name": "Powlowski, Jacobson and Powlowski",
                                },
                                "id": "application1",
                              },
                              Object {
                                "company": Object {
                                  "id": "23474e9a-1ee6-48b8-af70-a412bfab64b1",
                                  "name": "DuBuque - Russel",
                                },
                                "id": "application2",
                              },
                            ],
                          },
                        }
                `);
  });

  test('a query with multiple cypher root fields', async () => {
    const personId = people[0].id;
    const companyId = companies[0].id;

    const query = `
      query MultiQuery($personId: ID!, $companyId: ID!) {
        person(id: $personId) {
          id
          firstName
        }

        company(id: $companyId) {
          id
          name
        }
      }
    `;

    const { data, errors } = await graphql({
      schema,
      source: query,
      variableValues: {
        personId,
        companyId,
      },
      contextValue: {
        neo4jDriver: driver,
      },
    });

    expect(errors).toBeUndefined();
    expect(data).toMatchInlineSnapshot(`
                        Object {
                          "company": Object {
                            "id": "f5fdb0b7-8633-4154-ad06-f13caa1fdd15",
                            "name": "Powlowski, Jacobson and Powlowski",
                          },
                          "person": Object {
                            "firstName": "Hans",
                            "id": "e32ae442-f5cc-4b4e-b440-e385d5e15d57",
                          },
                        }
                `);
  });

  describe('a query with an authorized field', () => {
    it('works when authorized', async () => {
      const personId = people[0].id;

      const query = `
        query AuthorizedQuery($personId: ID!) {
          person(id: $personId) {
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
          personId,
        },
        contextValue: {
          neo4jDriver: driver,
          // our 'authorization'
          isAdmin: true,
        },
      });

      expect(errors).toBeUndefined();
      expect(data).toMatchInlineSnapshot(`
                                Object {
                                  "person": Object {
                                    "firstName": "Hans",
                                    "id": "e32ae442-f5cc-4b4e-b440-e385d5e15d57",
                                    "livesIn": Object {
                                      "id": "54045ca5-750a-461d-b3e2-18321a41ee3b",
                                      "name": "Nepal",
                                    },
                                  },
                                }
                        `);
    });

    it("doesn't work when unauthorized", async () => {
      const personId = people[0].id;

      const query = `
        query AuthorizedQuery($personId: ID!) {
          person(id: $personId) {
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
          personId,
        },
        contextValue: {
          neo4jDriver: driver,
          // no 'authorization'
        },
      });

      expect(errors).toHaveLength(1);
      expect(errors && errors[0]).toMatchInlineSnapshot(
        `[GraphQLError: You aren't authorized to view that!]`
      );
      expect(data).toMatchInlineSnapshot(`
                                                                Object {
                                                                  "person": null,
                                                                }
                                                `);
    });
  });

  it('allows querying relation fields', async () => {
    const personId = people[0].id;

    const query = `
      query RelationQuery($personId: ID!) {
        person(id: $personId) {
          id
          firstName
          friendships {
            type
            person {
              id
              firstName
            }
          }
        }
      }
    `;

    const { data, errors } = await graphql({
      schema,
      source: query,
      variableValues: {
        personId,
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
                                        "friendships": Array [
                                          Object {
                                            "person": Object {
                                              "firstName": "Chaim",
                                              "id": "a5b5cf90-f791-4db7-bd9b-1f933451f548",
                                            },
                                            "type": "acquaintance",
                                          },
                                          Object {
                                            "person": Object {
                                              "firstName": "Cynthia",
                                              "id": "5bb0662c-51ab-4ff1-8b29-d8ec2c81117c",
                                            },
                                            "type": "best",
                                          },
                                        ],
                                        "id": "e32ae442-f5cc-4b4e-b440-e385d5e15d57",
                                      },
                                    }
                        `);
  });

  it('allows querying relation fields with filters', async () => {
    const personId = people[0].id;

    const query = `
      query RelationQuery($personId: ID!) {
        person(id: $personId) {
          id
          firstName
          friendships(type: "best") {
            type
            person {
              id
              firstName
            }
          }
        }
      }
    `;

    const { data, errors } = await graphql({
      schema,
      source: query,
      variableValues: {
        personId,
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
                      "friendships": Array [
                        Object {
                          "person": Object {
                            "firstName": "Cynthia",
                            "id": "5bb0662c-51ab-4ff1-8b29-d8ec2c81117c",
                          },
                          "type": "best",
                        },
                      ],
                      "id": "e32ae442-f5cc-4b4e-b440-e385d5e15d57",
                    },
                  }
            `);
  });

  it('allows querying over virtual fields', async () => {
    const personId = people[0].id;

    const query = `
      query RelationQuery($personId: ID!) {
        person(id: $personId) {
          id
          firstName
          friendshipsConnection(type: "best") {
            edges {
              type
              person {
                id
                firstName
              }
            }
          }
        }
      }
    `;

    const { data, errors } = await graphql({
      schema,
      source: query,
      variableValues: {
        personId,
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
          "friendshipsConnection": Object {
            "edges": Array [
              Object {
                "person": Object {
                  "firstName": "Cynthia",
                  "id": "5bb0662c-51ab-4ff1-8b29-d8ec2c81117c",
                },
                "type": "best",
              },
            ],
          },
          "id": "e32ae442-f5cc-4b4e-b440-e385d5e15d57",
        },
      }
    `);
  });
});
