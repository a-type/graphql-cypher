import { GraphQLResolveInfo, GraphQLList, isListType } from 'graphql';
import { isRootField, getFieldPath, createOpenPromise } from './utils';
import { extractCypherQueriesFromOperation } from './scanQueries';
import { AugmentedContext } from './types';
import {
  executeCypherQuery,
  buildCypherQuery,
  buildPrefixedVariables,
} from './executeQuery';

export const middleware = async (
  resolve: Function,
  parent: any,
  args: { [key: string]: any },
  context: AugmentedContext,
  info: GraphQLResolveInfo
) => {
  if (isRootField(info.parentType, info.schema)) {
    const isWrite = info.operation.operation === 'mutation';
    const session = context.neo4jDriver.session(isWrite ? 'WRITE' : 'READ');
    context.__graphqlCypher = {
      cypherQueries: extractCypherQueriesFromOperation(info),
      parentQuery: null,
      resultCache: {},
      session,
      isWrite,
    };
  }

  const path = getFieldPath(info);
  const pathString = path.join(',');

  const matchingCypherQuery = context.__graphqlCypher.cypherQueries[pathString];
  if (matchingCypherQuery) {
    const cypher = buildCypherQuery(info.fieldName, matchingCypherQuery);
    const cypherVariables = buildPrefixedVariables({
      fieldName: info.fieldName,
      query: matchingCypherQuery,
      parent,
      contextValues: context.cypherContext,
    });

    context.runCypher = async () => {
      const data = await executeCypherQuery({
        cypher,
        fieldName: info.fieldName,
        variables: cypherVariables,
        session: context.__graphqlCypher.session,
        isList: isListType(info.returnType),
      });
      context.__graphqlCypher.resultCache[pathString] = data;
      return data;
    };
  } else {
    context.runCypher = async () => {
      return parent[info.fieldName] || null;
    };
  }

  // begin resolving. the resolver will block on awaiting context.cypher if
  // the user has decided to use the queried data
  const resultPromise = resolve(parent, args, context, info);

  return await resultPromise;
};
