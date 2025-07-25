import { useApiSubscription } from 'client-common/hooks/use-api-subscription'
import { usePersistentInMemoryState } from 'client-common/hooks/use-persistent-in-memory-state'
import { ContractComment } from 'common/comment'
import { convertContractComment } from 'common/supabase/comments'
import { groupBy, sortBy, uniqBy } from 'lodash'
import { useEffect, useState } from 'react'
import { api } from 'web/lib/api/api'
import {
  getAllCommentRows,
  getComment,
  getCommentThread,
  getNumContractComments,
} from 'web/lib/supabase/comments'

export function useNumContractComments(contractId: string) {
  const [numComments, setNumComments] = useState<number>(0)

  useEffect(() => {
    if (contractId) {
      getNumContractComments(contractId).then((result) =>
        setNumComments(result)
      )
    }
  }, [contractId])

  return numComments
}

export function useCommentsOnContract(contractId: string) {
  const [comments, setComments] = useState<ContractComment[] | undefined>(
    undefined
  )
  useEffect(() => {
    api('comments', { contractId }).then((comments) => {
      setComments(comments)
    })
  }, [contractId])
  return comments
}

export function useCommentOnContract(commentId: string) {
  const [comment, setComment] = useState<ContractComment | undefined | null>(
    undefined
  )
  useEffect(() => {
    getComment(commentId).then(setComment)
  }, [commentId])
  return comment
}

export function useCommentThread(commentId: string | undefined) {
  const [thread, setThread] = useState<ContractComment[] | undefined>(undefined)

  useEffect(() => {
    if (!commentId) {
      setThread(undefined)
      return
    }
    console.log('fetching comment thread', commentId)

    getCommentThread(commentId).then((comments) => {
      if (comments) {
        setThread(sortBy(comments, 'createdTime'))
      }
    })
  }, [commentId])

  return thread
}

export const useSubscribeGlobalComments = () => {
  const [newComments, setNewComments] = usePersistentInMemoryState<
    ContractComment[]
  >([], 'global-new-comments')

  useApiSubscription({
    topics: [`global/new-comment`],
    onBroadcast: (msg) => {
      const newComment = msg.data.comment as ContractComment
      setNewComments((currentComments) =>
        sortBy(uniqBy([...currentComments, newComment], 'id'), 'createdTime')
      )
    },
  })

  return newComments
}

export const useGlobalComments = (limit: number) => {
  const [comments, setComments] = usePersistentInMemoryState<
    ContractComment[] | undefined
  >(undefined, `global-comments-${limit}`)

  useEffect(() => {
    getAllCommentRows(limit).then((rows) =>
      setComments(rows.map(convertContractComment))
    )
  }, [limit])

  return comments
}

export const useCommentThreads = (
  contractId: string,
  limit: number,
  disabled: boolean
) => {
  const [threads, setThreads] = useState<
    { parent: ContractComment; replies: ContractComment[] }[]
  >([])
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)

  const loadMore = async () => {
    if (loading) return
    setLoading(true)
    const { parentComments, replyComments } = await api('comment-threads', {
      contractId,
      limit,
      page,
    })
    const repliesByParent = groupBy(replyComments, 'replyToCommentId')
    const newThreads = parentComments.map((p) => ({
      parent: p,
      replies: repliesByParent[p.id] ?? [],
    }))
    setThreads((t) => [...t, ...newThreads])
    setPage((p) => p + 1)
    setLoading(false)
  }

  useEffect(() => {
    if (disabled) return
    loadMore()
  }, [contractId, disabled])

  return { threads, loadMore, loading }
}
