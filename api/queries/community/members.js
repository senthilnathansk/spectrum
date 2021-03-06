// @flow
import type { DBCommunity } from 'shared/types';
import type { GraphQLContext } from '../../';
import type { PaginationOptions } from '../../utils/paginate-arrays';
import { encode, decode } from '../../utils/base64';
const { getMembersInCommunity } = require('../../models/usersCommunities');

type MembersFilterType = {
  isMember?: boolean,
  isOwner?: boolean,
  isModerator?: boolean,
  isPending?: boolean,
  isBlocked?: boolean,
};

export default (
  { id }: DBCommunity,
  {
    first = 10,
    after,
    filter,
  }: { ...$Exact<PaginationOptions>, filter: MembersFilterType },
  { loaders }: GraphQLContext
) => {
  const cursor = decode(after);
  // Get the index from the encoded cursor, asdf234gsdf-2 => ["-2", "2"]
  const lastDigits = cursor.match(/-(\d+)$/);
  const lastUserIndex =
    lastDigits && lastDigits.length > 0 && parseInt(lastDigits[1], 10);

  // Note @brian: this is a shitty hack, but if we want to show both
  // moderators and admins in a single list, I need to tweak the inbound
  // filter here
  let dbfilter = filter;
  if (filter && (filter.isOwner && filter.isModerator)) {
    dbfilter = row => row('isModerator').or(row('isOwner'));
  }

  // $FlowFixMe
  return getMembersInCommunity(id, { first, after: lastUserIndex }, dbfilter)
    .then(users => {
      const permissionsArray = users.map(userId => [userId, id]);
      // $FlowIssue
      return loaders.userPermissionsInCommunity.loadMany(permissionsArray);
    })
    .then(result => ({
      pageInfo: {
        hasNextPage: result && result.length >= first,
      },
      edges: result.filter(Boolean).map((user, index) => ({
        cursor: encode(`${user.userId}-${lastUserIndex + index + 1}`),
        node: user,
      })),
    }));
};
