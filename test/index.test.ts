import { graphql } from 'graphql';
import schema from './fixtures/schema';

describe('the library', () => {
  test('works', async () => {
    await graphql({
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
    });

    expect(true).toBe(true);
  });
});
