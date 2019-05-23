import { GraphQLResolveInfo, defaultFieldResolver } from 'graphql';
import { isRootField, getFieldPath, isListOrWrappedListType } from './utils';
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
    context.runCypher = async () => {
      const cypher = buildCypherQuery({
        fieldName: info.fieldName,
        query: matchingCypherQuery,
      });
      const cypherVariables = buildPrefixedVariables({
        fieldName: info.fieldName,
        query: matchingCypherQuery,
        parent,
        contextValues: context.cypherContext,
      });
      const data = await executeCypherQuery({
        cypher,
        fieldName: info.fieldName,
        variables: cypherVariables,
        session: context.__graphqlCypher.session,
        isList: isListOrWrappedListType(info.returnType),
        debug: __DEV__,
      });
      context.__graphqlCypher.resultCache[pathString] = data;
      return data;
    };
  } else {
    context.runCypher = async () => {
      return defaultFieldResolver(parent, args, context, info);
    };
  }

  const result = await resolve(parent, args, context, info);
  return result;
};
