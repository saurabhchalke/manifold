import clsx from 'clsx'
import { CommentWithTotalReplies, ContractComment } from 'common/comment'
import { Contract } from 'common/contract'
import { groupBy, keyBy, orderBy, uniq, uniqBy } from 'lodash'
import { memo, useCallback, useEffect, useState } from 'react'
import { usePrivateUser } from 'web/hooks/use-user'
import { ContractMention } from './contract/contract-mention'
import { FeedBet } from './feed/feed-bets'
import { Col } from './layout/col'
import { Row } from './layout/row'
import { RelativeTimestamp } from './relative-timestamp'
import { Avatar } from './widgets/avatar'
import { Content } from './widgets/editor'
import { LoadingIndicator } from './widgets/loading-indicator'
import { UserLink } from './widgets/user-link'
import { UserHovercard } from './user/user-hovercard'
import { useAPIGetter } from 'web/hooks/use-api-getter'
import { VisibilityObserver } from 'web/components/widgets/visibility-observer'
import { LikeAndDislikeComment } from './comments/comment-actions'
import { NextRouter, useRouter } from 'next/router'
import { useUser } from 'web/hooks/use-user'
import { User } from 'common/user'
import { PrivateUser } from 'common/user'
import { track } from 'web/lib/service/analytics'
import { usePersistentLocalState } from 'web/hooks/use-persistent-local-state'
import { LiteGroup } from 'common/group'
import DropdownMenu, { DropdownItem } from './widgets/dropdown-menu'
import { DropdownPill } from './search/filter-pills'
import { Input } from './widgets/input'
import { APIResponse } from 'common/src/api/schema'
import { MultiTopicPillSelector } from './topics/topic-selector'

interface ActivityState {
  selectedTopics: LiteGroup[]
  types: ('bets' | 'comments' | 'markets')[]
  minBetAmount: number | undefined
}

const defaultGroups: LiteGroup[] = [
  {
    id: 'IlzY3moWwOcpsVZXCVej',
    slug: 'technology-default',
    name: '🖥️ Technology',
    totalMembers: 46584,
    privacyStatus: 'public',
    importanceScore: 0,
  },
  {
    id: 'UCnpxVUdLOZYgoMsDlHD',
    slug: 'politics-default',
    name: '🗳️ Politics',
    totalMembers: 21594,
    privacyStatus: 'public',
    importanceScore: 0,
  },
  {
    id: 'yEWvvwFFIqzf8JklMewp',
    slug: 'ai',
    name: '🤖 AI',
    totalMembers: 26072,
    privacyStatus: 'public',
    importanceScore: 0,
  },
]

export const ACTIVITY_TYPES = [
  { name: 'All activity', value: ['bets', 'comments', 'markets'] },
  { name: 'Trades', value: ['bets'] },
  { name: 'Comments', value: ['comments'] },
  { name: 'Markets', value: ['markets'] },
] as const

const PRESET_BET_AMOUNTS = [500, 1000, 10000]

export function SiteActivity(props: { className?: string }) {
  const { className } = props
  const privateUser = usePrivateUser()
  const user = useUser()
  const router = useRouter()

  const blockedGroupSlugs = privateUser?.blockedGroupSlugs ?? []
  const userBlockedContractIds = privateUser?.blockedContractIds ?? []
  const blockedUserIds = privateUser?.blockedUserIds ?? []

  const [activityState, setActivityState] =
    usePersistentLocalState<ActivityState>(
      {
        selectedTopics: defaultGroups,
        types: ['comments', 'bets', 'markets'],
        minBetAmount: PRESET_BET_AMOUNTS[1],
      },
      'site-activity-state'
    )
  const [offset, setOffset] = useState(0)

  const { selectedTopics, types, minBetAmount } = activityState
  const topicIds =
    selectedTopics.length > 0 ? selectedTopics.map((t) => t.id) : undefined

  const limit = 30 / types.length
  const [allData, setAllData] = useState<APIResponse<'get-site-activity'>>()

  // State to manage the custom input value within the dropdown
  const [customAmountString, setCustomAmountString] = useState<string>(
    PRESET_BET_AMOUNTS.includes(minBetAmount ?? 0)
      ? ''
      : minBetAmount !== undefined
      ? String(minBetAmount)
      : ''
  )

  const updateActivityState = useCallback(
    (newState: Partial<ActivityState>) => {
      setOffset(0)
      setAllData(undefined)
      setTimeout(() => {
        setActivityState((prevState) => ({
          ...prevState,
          ...newState,
        }))
      }, 100)
    },
    [setActivityState, setOffset]
  )

  const { data, loading, refresh } = useAPIGetter(
    'get-site-activity',
    {
      limit,
      offset,
      blockedUserIds,
      blockedGroupSlugs,
      blockedContractIds: uniq([
        ...userBlockedContractIds,
        ...(allData?.relatedContracts.map((c) => c.id) ?? []),
      ]),
      topicIds,
      types,
      minBetAmount,
    },
    ['blockedContractIds', 'offset']
  )

  useEffect(() => {
    if (data) {
      setAllData((prev) => {
        if (!prev) return data
        // Ensure offset is 0 when setting initial data after a filter change
        const base =
          offset === 0
            ? { bets: [], comments: [], newContracts: [], relatedContracts: [] }
            : prev
        return {
          bets: uniqBy([...base.bets, ...data.bets], 'id'),
          comments: uniqBy([...base.comments, ...data.comments], 'id'),
          newContracts: uniqBy(
            [...base.newContracts, ...data.newContracts],
            'id'
          ),
          relatedContracts: uniqBy(
            [...base.relatedContracts, ...data.relatedContracts],
            'id'
          ),
        }
      })
    }
  }, [data])

  // Update custom amount string if minBetAmount changes externally or via presets
  useEffect(() => {
    setCustomAmountString(
      PRESET_BET_AMOUNTS.includes(minBetAmount ?? 0)
        ? ''
        : minBetAmount !== undefined
        ? String(minBetAmount)
        : ''
    )
  }, [minBetAmount])

  const { bets, comments, newContracts, relatedContracts } = allData ?? {
    bets: [],
    comments: [],
    newContracts: [],
    relatedContracts: [],
  }
  const contracts = [...newContracts, ...relatedContracts]
  const contractsById = keyBy(contracts, 'id')

  const items = orderBy(
    [...bets, ...comments, ...newContracts],
    'createdTime',
    'desc'
  )

  const groups = orderBy(
    Object.entries(
      groupBy(items, (item) =>
        'contractId' in item ? item.contractId : item.id
      )
    ).map(([parentId, items]) => ({
      parentId,
      items,
    })),
    ({ items }) => Math.max(...items.map((item) => item.createdTime)),
    'desc'
  )

  return (
    <Col className={clsx('gap-4', className)}>
      <Row className="mt-2 items-center gap-2">
        <MultiTopicPillSelector
          topics={selectedTopics}
          setTopics={(topics) => {
            updateActivityState({ selectedTopics: topics })
            track('site activity topic change', {
              topics: topics.map((t) => t.slug),
            })
          }}
          maxTopics={10}
        />
        <DropdownMenu
          closeOnClick
          selectedItemName={
            ACTIVITY_TYPES.find(
              (t) =>
                t.value.length === types.length &&
                t.value.every((v) => types.includes(v))
            )?.name ?? 'All activity'
          }
          items={ACTIVITY_TYPES.map((type) => ({
            name: type.name,
            onClick: () => {
              updateActivityState({ types: [...type.value] })
              track('site activity type change', {
                types: [...type.value],
              })
            },
          }))}
          buttonContent={(open) => (
            <DropdownPill open={open}>
              {ACTIVITY_TYPES.find(
                (t) =>
                  t.value.length === types.length &&
                  t.value.every((v) => types.includes(v))
              )?.name ?? 'All activity'}
            </DropdownPill>
          )}
        />
        {types.includes('bets') && (
          <DropdownMenu
            buttonContent={(open) => (
              <DropdownPill open={open}>
                Min bet{' '}
                {minBetAmount !== undefined ? `M$${minBetAmount}` : 'Any'}
              </DropdownPill>
            )}
            items={[
              ...PRESET_BET_AMOUNTS.map((amount) => ({
                name: `M$${amount}`,
                onClick: () => {
                  updateActivityState({ minBetAmount: amount })
                  track('site activity bet amount change', {
                    amount,
                  })
                },
              })),
              {
                name: (
                  <Row
                    className="items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    M$
                    <Input
                      type="number"
                      className="!h-8 w-32"
                      placeholder="Custom"
                      min={1}
                      value={customAmountString}
                      onChange={(e) => {
                        e.stopPropagation()
                        setCustomAmountString(e.target.value)
                      }}
                      onBlur={() => {
                        // Parse and apply the filter when input loses focus
                        const value = parseInt(customAmountString)
                        const newAmount =
                          isNaN(value) || value <= 0 ? undefined : value
                        updateActivityState({ minBetAmount: newAmount })
                      }}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          // Parse and apply filter immediately on Enter
                          const value = parseInt(customAmountString)
                          const newAmount =
                            isNaN(value) || value <= 0 ? undefined : value
                          updateActivityState({ minBetAmount: newAmount })
                        }
                      }}
                    />
                  </Row>
                ) as any,
                onClick: undefined, // Let onBlur/onKeyDown handle the state update
                selected:
                  minBetAmount !== undefined &&
                  !PRESET_BET_AMOUNTS.includes(minBetAmount),
                closeOnClickOverride: false,
              } as DropdownItem,
              {
                name: 'M$0',
                onClick: () => {
                  updateActivityState({ minBetAmount: 0 })
                },
              },
            ]}
          />
        )}
      </Row>
      <Col className="gap-4">
        {!allData ? (
          <LoadingIndicator />
        ) : (
          groups.map(({ parentId, items }) => {
            const contract = contractsById[parentId] as Contract

            // Separate comments and group replies
            const comments = items.filter(
              (item): item is CommentWithTotalReplies =>
                'userId' in item && !('question' in item) && !('amount' in item)
            )
            const replies = comments.filter((c) => !!c.replyToCommentId)
            const repliesByParentId = groupBy(
              orderBy(replies, 'createdTime', 'asc'), // Sort replies ascending
              'replyToCommentId'
            )

            // Filter items to include non-comments and parent comments, sorted descending
            const displayItems = orderBy(
              items.filter(
                (item) =>
                  !(
                    'userId' in item &&
                    (item as CommentWithTotalReplies).replyToCommentId
                  ) // Exclude replies from main list
              ),
              'createdTime',
              'desc'
            )

            return (
              <Col
                key={parentId}
                className={clsx(
                  'bg-canvas-0 dark:bg-canvas-50 dark:border-canvas-50 hover:border-primary-300 gap-2 rounded-lg border p-3 shadow-md transition-colors sm:px-5'
                )}
              >
                <Row className="gap-2">
                  <Col className="flex-1 gap-2">
                    <ContractMention
                      contract={contract}
                      trackingLocation={'site-activity'}
                    />
                    <div className="space-y-1">
                      {displayItems.map((item) => {
                        if ('amount' in item) {
                          // Render Bet
                          return (
                            <FeedBet
                              className="p-1"
                              key={item.id}
                              contract={contract}
                              bet={item}
                              avatarSize="xs"
                              hideActions={true}
                            />
                          )
                        } else if ('question' in item) {
                          // Render Market Creation
                          return (
                            <MarketCreatedLog
                              key={item.id}
                              contract={item}
                              showDescription={items.length === 1} // Maybe adjust this logic if needed
                            />
                          )
                        } else if ('userId' in item) {
                          const comment = item as CommentWithTotalReplies
                          const childReplies =
                            repliesByParentId[comment.id] ?? []
                          const hiddenRepliesCount =
                            (comment.totalReplies ?? 0) - childReplies.length

                          return (
                            <div key={comment.id}>
                              <CommentLog
                                comment={comment}
                                privateUser={privateUser}
                                user={user}
                                router={router}
                                hiddenReplies={hiddenRepliesCount}
                              />

                              {hiddenRepliesCount > 0 &&
                                childReplies.length > 0 && (
                                  <Row className="text-ink-400 ml-6 items-center gap-1 pb-2 pl-2 text-xs">
                                    <div className="border-ink-400 w-5 border-b-[1px] border-l-[1px]" />
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        router.push(
                                          `/${comment.userUsername}/${comment.contractSlug}#${comment.id}`
                                        )
                                      }}
                                      className="hover:underline"
                                    >
                                      {hiddenRepliesCount} more{' '}
                                      {hiddenRepliesCount === 1
                                        ? 'reply'
                                        : 'replies'}
                                    </button>
                                    <div className="border-ink-400 w-5 border-b-[1px] border-l-[1px]" />
                                  </Row>
                                )}

                              {childReplies.length > 0 && (
                                <Col className="ml-6 space-y-1 pl-2">
                                  {childReplies.map((reply) => (
                                    <CommentLog
                                      key={reply.id}
                                      comment={reply}
                                      privateUser={privateUser}
                                      user={user}
                                      router={router}
                                      isReply={true} // Indicate this is a reply
                                    />
                                  ))}
                                </Col>
                              )}
                            </div>
                          )
                        }
                      })}
                    </div>
                  </Col>

                  {contract.coverImageUrl && (
                    <img
                      src={contract.coverImageUrl}
                      alt=""
                      className={clsx(
                        'rounded-md object-cover',
                        'h-12 w-12 sm:h-32 sm:w-32',
                        // Only hide on desktop if single bet
                        items.length === 1 &&
                          'amount' in items[0] &&
                          'sm:hidden'
                      )}
                    />
                  )}
                </Row>
              </Col>
            )
          })
        )}
      </Col>
      {allData && (
        <div className="relative">
          {loading && <LoadingIndicator />}
          <VisibilityObserver
            className="pointer-events-none absolute bottom-0 h-screen w-full select-none"
            onVisibilityUpdated={(visible) => {
              if (visible && !loading) {
                setOffset(offset + limit)
                setTimeout(() => {
                  refresh()
                }, 100)
              }
            }}
          />
        </div>
      )}
    </Col>
  )
}

const MarketCreatedLog = memo(
  (props: { contract: Contract; showDescription?: boolean }) => {
    const {
      creatorId,
      creatorAvatarUrl,
      creatorUsername,
      creatorName,
      createdTime,
    } = props.contract
    const { showDescription = false } = props

    return (
      <Col className="gap-2">
        <Row className="text-ink-1000 items-center gap-2 text-sm">
          <UserHovercard userId={creatorId}>
            <Row className="items-center gap-2 font-semibold">
              <Avatar
                avatarUrl={creatorAvatarUrl}
                username={creatorUsername}
                size="xs"
              />
              <UserLink
                user={{
                  id: creatorId,
                  name: creatorName,
                  username: creatorUsername,
                }}
              />
            </Row>
          </UserHovercard>
          <div className="-ml-1">created this market</div>
          <Row className="text-ink-400">
            <RelativeTimestamp time={createdTime} shortened />
          </Row>
        </Row>

        {showDescription && props.contract.description && (
          <div className="relative max-h-[120px] max-w-xs overflow-hidden sm:max-w-none">
            <Content
              size="sm"
              content={props.contract.description}
              className="mt-2 text-left"
            />
            <div className="dark:from-canvas-0 absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent" />
          </div>
        )}
      </Col>
    )
  }
)

const CommentLog = memo(function FeedComment(props: {
  comment: ContractComment
  privateUser: PrivateUser | null | undefined
  user: User | null | undefined
  router: NextRouter
  isReply?: boolean
  hiddenReplies?: number
}) {
  const { comment, privateUser, user, router, isReply } = props // Destructure new prop
  const {
    userName,
    content,
    userId,
    userUsername,
    userAvatarUrl,
    createdTime,
    contractSlug,
  } = comment

  return (
    <Col
      className={clsx('hover:bg-canvas-100 cursor-pointer rounded-md p-1')}
      onClick={() => {
        router.push(`/${userUsername}/${contractSlug}#${comment.id}`)
        track('site activity comment click', {
          commentId: comment.id,
          userId: userId,
          contractSlug: contractSlug,
        })
      }}
    >
      <Row id={comment.id} className="items-center gap-2 text-sm">
        <UserHovercard userId={userId}>
          <Row className="items-center gap-2 font-semibold">
            <Avatar
              avatarUrl={userAvatarUrl}
              username={userUsername}
              size="xs"
            />
            <UserLink
              user={{
                id: userId,
                name: userName,
                username: userUsername,
              }}
            />
          </Row>
        </UserHovercard>
        <div className="-ml-1">{isReply ? 'replied' : 'commented'}</div>
        <Row className="text-ink-400">
          <RelativeTimestamp time={createdTime} shortened />
        </Row>
      </Row>
      <Content size="sm" className="grow" content={content} />
      <Row className="items-center justify-end">
        <LikeAndDislikeComment
          comment={comment}
          trackingLocation={'site-activity'}
          privateUser={privateUser}
          user={user}
        />
      </Row>
    </Col>
  )
})
