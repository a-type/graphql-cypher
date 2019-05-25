import { GraphQLResolveInfo, defaultFieldResolver } from 'graphql';
import { isRootField, getFieldPath, isListOrWrappedListType } from './utils';
import { extractCypherQueriesFromOperation } from './scanQueries';
import { AugmentedContext } from './types';
import { executeCypherQuery } from './executeQuery';
import { buildCypherQuery, buildPrefixedVariables } from './buildCypher';
import chalk from 'chalk';

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
    if (__DEV__) {
      console.debug(
        [
          chalk.cyan(
            '[GraphQL-Cypher] Planned Cypher queries for this operation:'
          ),
          chalk.gray(JSON.stringify(context.__graphqlCypher.cypherQueries)),
        ].join('\n')
      );
    }
  }

  const path = getFieldPath(info);
  const pathString = path.join(',');
  console.log(pathString);

  const matchingCypherQuery = context.__graphqlCypher.cypherQueries[pathString];
  if (matchingCypherQuery) {
    context.runCypher = async () => {
      try {
        const cypher = buildCypherQuery({
          fieldName: info.fieldName,
          query: matchingCypherQuery,
        });
        if (__DEV__) {
          console.debug(
            [
              chalk.yellow('[GraphQL-Cypher] Cypher query structure:'),
              chalk.gray(JSON.stringify(matchingCypherQuery)),
            ].join('\n')
          );
        }
        const cypherVariables = buildPrefixedVariables({
          fieldName: info.fieldName,
          query: matchingCypherQuery,
          parent: parent || null,
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
      } catch (err) {
        console.error(
          [
            chalk.red('[GraphQL-Cypher] Execution error'),
            err.toString(),
            (err as Error).stack,
          ].join('\n')
        );
        throw err;
      }
    };
  } else {
    context.runCypher = async () => {
      return defaultFieldResolver(parent, args, context, info);
    };
  }

  const result = await resolve(parent, args, context, info);
  return result;
};
