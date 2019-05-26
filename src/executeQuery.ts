import { v1 } from 'neo4j-driver';

export const executeCypherQuery = async ({
  fieldName,
  cypher,
  variables,
  session,
  write = false,
  isList,
}: {
  fieldName: string;
  cypher: string;
  variables: { [name: string]: any };
  session: v1.Session;
  isList: boolean;
  write?: boolean;
}): Promise<any> => {
  const transaction = write
    ? session.writeTransaction.bind(session)
    : session.readTransaction.bind(session);

  const data = await transaction(async (tx: v1.Transaction) => {
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
