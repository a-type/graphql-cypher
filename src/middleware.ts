import { GraphQLResolveInfo, defaultFieldResolver } from 'graphql';
import {
  isRoot as getIsRootField,
  getFieldPath,
  isListOrWrappedListType,
} from './utils/graphql';
import { extractCypherQueriesFromOperation } from './scanQueries';
import { AugmentedContext, DirectiveNames } from './types';
import { executeCypherQuery } from './executeQuery';
import { buildCypherQuery, buildPrefixedVariables } from './buildCypher';
import { log } from './logger';

export type MiddlewareConfig = {
  directiveNames: DirectiveNames;
};

export const createMiddleware = (
  config: MiddlewareConfig = {
    directiveNames: {
      cypher: 'cypher',
      cypherSkip: 'cypherSkip',
      generateId: 'generateId',
    },
  }
) => async (
  resolve: Function,
  parent: any,
  args: { [key: string]: any },
  context: AugmentedContext,
  info: GraphQLResolveInfo
) => {
  const isWrite = info.operation.operation === 'mutation';
  const isRootField = getIsRootField(info);

  if (isRootField) {
    try {
      const cypherQueries = extractCypherQueriesFromOperation(info, {
        directiveNames: config.directiveNames,
      });

      context.__graphqlCypher = {
        cypherQueries,
        parentQuery: null,
        resultCache: {},
        isWrite,
      };
    } catch (err) {
      log({
        title: 'Error extracting cypher queries from operation',
        level: 'error',
        details: [err.toString(), (err as Error).stack],
      });

      throw err;
    }

    log({
      title: 'Planned Cypher queries for this operation',
      level: 'verbose',
      details: [JSON.stringify(context.__graphqlCypher.cypherQueries)],
    });
  }

  const path = getFieldPath(info);
  const pathString = path.join(',');

  const matchingCypherQuery = context.__graphqlCypher.cypherQueries[pathString];

  let runCypher: () => Promise<any>;

  if (matchingCypherQuery) {
    runCypher = async () => {
      try {
        const cypher = buildCypherQuery({
          fieldName: info.fieldName,
          query: matchingCypherQuery,
          // we only do a write transaction if this is the mutation root field; while
          // it's not enforced in GraphQL, it's a resonable assumption that only
          // the root field of a mutation will alter the graph.
          isWrite: isWrite && isRootField,
        });

        log({
          title: 'Cypher query structure',
          level: 'debug',
          details: [JSON.stringify(matchingCypherQuery)],
        });

        const cypherVariables = buildPrefixedVariables({
          fieldName: info.fieldName,
          query: matchingCypherQuery,
          parent: parent || null,
          contextValues: context.cypherContext,
        });

        const session = context.neo4jDriver.session(isWrite ? 'WRITE' : 'READ');

        log({
          title: `Running ${isWrite ? 'write' : 'read'} transaction`,
          level: 'info',
          details: [cypher, 'Parameters:', JSON.stringify(cypherVariables)],
        });

        const data = await executeCypherQuery({
          cypher,
          fieldName: info.fieldName,
          variables: cypherVariables,
          session,
          isList: isListOrWrappedListType(info.returnType),
        });

        log({
          title: `Query response data`,
          level: 'debug',
          details: [JSON.stringify(data)],
        });

        session.close();
        context.__graphqlCypher.resultCache[pathString] = data;
        return data;
      } catch (err) {
        log({
          title: 'Execution error',
          level: 'error',
          details: [err.toString(), (err as Error).stack],
        });
        throw err;
      }
    };
  } else {
    runCypher = async () => {
      return defaultFieldResolver(parent, args, context, info);
    };
  }

  const result = await resolve(parent, args, { ...context, runCypher }, info);
  return result;
};

/**
 * This middleware is made to the graphql-middleware spec and can be
 * used out of the box with graphql-yoga servers, or added to any
 * schema using graphql-middleware.
 * https://github.com/prisma/graphql-middleware
 */
export const middleware = createMiddleware();
