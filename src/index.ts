import { GraphQLResolveInfo, GraphQLObjectType } from 'graphql';
import {
  isGraphqlScalarType,
  isRoot,
  createPlaceholder,
  isCypherPlaceholder,
  isExternalPlaceholder,
} from './utils';
import {
  GenericResolver,
  CypherPlaceholder,
  ExternalPlaceholder,
  ExtractQueryTraversalInfo,
  CypherQuery,
  CypherQueryFieldMap,
  ResolveTraversalInfo,
} from 'types';

export const autoResolver: GenericResolver = (): CypherPlaceholder => {
  return createPlaceholder('TODO');
};

export type CustomCypherInterpolation = GenericResolver;

export const cypherResolver = (
  strings: TemplateStringsArray,
  ...interpolations: CustomCypherInterpolation[]
): GenericResolver => {
  const resolver: GenericResolver = (
    parent,
    args,
    ctx,
    info
  ): CypherPlaceholder => {
    const customCypher = strings.reduce((cypher, part, index) => {
      const nextInterpolation = interpolations[index];
      return (
        cypher +
        part +
        (nextInterpolation ? nextInterpolation(parent, args, ctx, info) : '')
      );
    }, '');

    return createPlaceholder(customCypher);
  };

  return resolver;
};

// type CypherQuery = {
//   cypher: string;
//   fieldQueries: {
//     [key: string]: CypherQuery;
//   };
// };

// const recursivelyExtractCypherQueries = (
//   cypherQueries: CypherQuery[],
//   parentQuery: CypherQuery | null,
//   field: any,
//   key: string
// ): CypherQuery[] => {
//   if (typeof field !== 'object') {
//     return field;
//   }

//   if (field.isCypherMiddlewarePlaceholder) {
//     const { isCypherMiddlewarePlaceholder, message, cypher, ...rest } = field;

//     const fieldQuery = {
//       cypher,
//       fieldQueries: {},
//     };

//     if (!parentQuery) {
//       cypherQueries.push(fieldQuery);
//     } else {
//       parentQuery.fieldQueries[key] = fieldQuery;
//     }

//     return recursivelyExtractCypherQueries();
//   }

//   if (field instanceof Array) {
//     return field.reduce((item, index) =>
//       recursivelyExtractCypherQueries(cypherQueries, parentQuery, item, index)
//     );
//   }

//   return Object.keys(field).reduce(
//     (queries, key) =>
//       recursivelyExtractCypherQueries(queries, null, field[key], key),
//     cypherQueries
//   );
// };

const isExternal = (info: GraphQLResolveInfo) => {
  const type = info.parentType.name;
  const field = info.fieldName;

  const schemaType = info.schema.getType(type);
  if (!schemaType || !schemaType.astNode) {
    throw new Error('Schema type was not found for ' + type);
  }

  if (isGraphqlScalarType(schemaType)) {
    console.debug('^ scalar');
    return true;
  }

  const fieldNode = (schemaType as GraphQLObjectType).getFields()[field];

  console.info('fieldNode', fieldNode);

  return (
    fieldNode.astNode &&
    fieldNode.astNode.directives &&
    !fieldNode.astNode.directives.some(
      directive => directive.name.value === 'cypher'
    )
  );
};

/**
 * Eagerly traverses connected query nodes starting from a particular node.
 */
const eagerlyTraverseQueryNodes = (
  query: CypherQuery | null,
  placeholder: CypherPlaceholder & any,
  fieldName: string
): CypherQuery => {
  const {
    __graphqlCypher: { cypher },
    ...rest
  } = placeholder;

  const cypherChildFieldNames = Object.keys(rest).filter(name =>
    isCypherPlaceholder(rest[name])
  );

  if (query) {
    query.fieldQueries[fieldName] = {
      cypher,
      fields: cypherChildFieldNames,
      fieldQueries: {},
    };
  } else {
    query = {
      cypher,
      fields: cypherChildFieldNames,
      fieldQueries: {},
    };
  }

  return cypherChildFieldNames.reduce((q, childName) => {
    const child = rest[childName];
    return eagerlyTraverseQueryNodes(q, child, childName);
  }, query);
};

const extractQueriesFromPlaceholderTree = (
  queries: CypherQueryFieldMap,
  placeholder: CypherPlaceholder | ExternalPlaceholder | null,
  traversalInfo: ExtractQueryTraversalInfo
): CypherQueryFieldMap => {
  if (placeholder === null) {
    return queries;
  }

  if (isCypherPlaceholder(placeholder)) {
    if (!traversalInfo.parent || isExternalPlaceholder(traversalInfo.parent)) {
      const query = eagerlyTraverseQueryNodes(
        null,
        placeholder,
        traversalInfo.fieldName
      );
      queries.set(traversalInfo.path, query);
    }
  }

  const { __graphqlCypher, ...rest } = placeholder;
  const childFields = rest as { [fieldName: string]: any };

  return Object.keys(childFields).reduce((queryMap, childKey: string) => {
    const child = childFields[childKey];
    return extractQueriesFromPlaceholderTree(queryMap, child, {
      parent: placeholder,
      fieldName: childKey,
      path: [...traversalInfo.path, childKey],
    });
  }, queries);
};

const runCypherQuery = async (
  query: CypherQuery,
  { transaction }: ResolveTraversalInfo
) => {};

const traverseAndResolve = async (
  placeholder: CypherPlaceholder | ExternalPlaceholder | null,
  { parent, fieldName, path, queries }: ResolveTraversalInfo
) => {
  const { __graphqlCypher, ...rest } = placeholder;
  const childFields = rest as { [fieldName: string]: any };

  const nodeQuery = queries.get(path);

  if (nodeQuery) {
  }
};

export const middleware = async (
  resolve: Function,
  parent: any,
  args: { [key: string]: any },
  context: any,
  info: GraphQLResolveInfo
) => {
  let placeholder: CypherPlaceholder | ExternalPlaceholder | null = null;

  // for non-root field resolvers, construct a tree which represents all placeholder values
  console.debug('non-root', info.parentType.name + '.' + info.fieldName);
  // immediately bail on external resolvers without running them. we will run them later.
  if (isExternal(info)) {
    console.debug('^external');
    placeholder = {
      __graphqlCypher: {
        isCypher: false,
        resolver: resolve as GenericResolver,
        args,
        info,
      },
    };

    // non-root external fields exit now! we will come back and resolve them in the 2nd pass
    if (!isRoot(info)) {
      return placeholder;
    }
  } else {
    // go ahead and run the resolver. This will create a placeholder, too
    placeholder = await resolve(parent, args, context, info);
  }

  console.debug('^', placeholder);

  // if this is a root resolver, complete the processing
  if (isRoot(info)) {
    if (isExternal(info)) {
      // special case for non-cypher root. we must get past the resolver to continue,
      // so resolve it immediately and create a fake placeholder which holds the resolved value.
      const resolvedResult = await resolve(parent, args, context, info);
      placeholder = {
        __graphqlCypher: {
          isCypher: false,
          resolver: () => resolvedResult,
          args,
          info,
        },
      };
    }

    const queries = extractQueriesFromPlaceholderTree(new Map(), placeholder, {
      parent: null,
      fieldName: info.fieldName,
      path: [info.parentType.name, info.fieldName],
    });
  } else {
    return placeholder;
  }
};
