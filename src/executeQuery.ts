import { v1 } from 'neo4j-driver';
import chalk from 'chalk';

export const executeCypherQuery = async ({
  fieldName,
  cypher,
  variables,
  session,
  write = false,
  isList,
  debug = false,
}: {
  fieldName: string;
  cypher: string;
  variables: { [name: string]: any };
  session: v1.Session;
  isList: boolean;
  write?: boolean;
  debug?: boolean;
}): Promise<any> => {
  const transaction = write
    ? session.writeTransaction
    : session.readTransaction;

  if (debug) {
    console.debug(
      [
        chalk.blue(`[GraphQL-Cypher]`) +
          `Running ${write ? 'write' : 'read'} transaction:`,
        '',
        chalk.grey(cypher),
        '',
        chalk.green(`Parameters:`),
        chalk.grey(JSON.stringify(variables)),
      ].join('\n')
    );
  }

  const data = await transaction(async tx => {
    const result = await tx.run(cypher, variables);
    if (result.records && result.records.length) {
      if (isList) {
        return result.records.map(record => record.get(fieldName));
      } else {
        return result.records[0].get(fieldName);
      }
    }
    return null;
  });

  return data;
};
