import { GraphQLResolveInfo } from 'graphql';

export const middleware = async (
  resolve: Function,
  parent: any,
  args: { [key: string]: any },
  context: any,
  info: GraphQLResolveInfo
) => {
  return resolve(parent, args, context, info);
};
