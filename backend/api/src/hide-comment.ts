import { isAdminId, isModId } from 'common/envs/constants'
import {
  getContract,
  getUser,
  revalidateContractStaticProps,
} from 'shared/utils'
import { getComment } from 'shared/supabase/contract-comments'
import { createSupabaseDirectClient } from 'shared/supabase/init'
import { updateData } from 'shared/supabase/utils'
import { APIError, type APIHandler } from './helpers/endpoint'
import { trackPublicEvent } from 'shared/analytics'

export const hideComment: APIHandler<'hide-comment'> = async (
  { commentPath },
  auth
) => {
  // Comment path is of the form /[username]/[contractId]/comment/[commentId] because firebase
  const [, contractId, , commentId] = commentPath.split('/')
  if (!contractId || !commentId) {
    throw new APIError(
      400,
      'Invalid comment path. If you can read this, tell sinclair to change this endpoint to have more sensible inputs'
    )
  }

  const pg = createSupabaseDirectClient()
  const user = await getUser(auth.uid)
  if (!user) throw new APIError(404, 'User not found')
  if (user.isBannedFromPosting || user.userDeleted)
    throw new APIError(
      403,
      'You are banned from posting or your account has been deleted'
    )

  const contract = await getContract(pg, contractId)
  if (!contract) throw new APIError(404, 'Contract not found')

  const isContractCreator = contract.creatorId === auth.uid

  if (!isAdminId(auth.uid) && !isContractCreator && !isModId(auth.uid)) {
    throw new APIError(
      403,
      'Only the market creator or mod can hide/unhide comments'
    )
  }

  const comment = await getComment(pg, commentId)
  const hide = !comment.hidden
  if ((isAdminId(comment.userId) || isModId(comment.userId)) && hide) {
    throw new APIError(403, 'You cannot hide comments from admins or mods')
  }

  // update the comment
  await updateData(pg, 'contract_comments', 'comment_id', {
    comment_id: commentId,
    hidden: hide,
    hiddenTime: hide ? Date.now() : undefined,
    hiderId: auth.uid,
  })

  await revalidateContractStaticProps(contract)
  return {
    result: { success: true },
    continue: async () => {
      await trackPublicEvent(auth.uid, 'hide_comment', {
        contractId,
        commentId,
        hidden: hide,
        userId: auth.uid,
      })
    },
  }
}
