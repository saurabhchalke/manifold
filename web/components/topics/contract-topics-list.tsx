import { Topic, MAX_GROUPS_PER_MARKET } from 'common/group'
import toast from 'react-hot-toast'
import { Col } from 'web/components/layout/col'
import { Row } from 'web/components/layout/row'
import { TopicSelector } from './topic-selector'
import { useState } from 'react'
import { XIcon } from '@heroicons/react/solid'
import { TagIcon } from '@heroicons/react/outline'
import { TopicTag } from 'web/components/topics/topic-tag'

export function ContractTopicsList(props: {
  canEdit: boolean
  canEditTopic: (groupId: string) => boolean
  topics: Topic[]
  addTopic: (topic: Topic) => Promise<void>
  removeTopic: (topic: Topic) => Promise<void>
}) {
  const { canEditTopic, canEdit, topics, addTopic, removeTopic } = props

  const [error, setError] = useState<string>('')

  return (
    <Col className="gap-4">
      <Row className="items-center gap-2">
        <TagIcon className="text-ink-500 h-5 w-5" />
        <span className="text-ink-1000 text-lg font-semibold">Topics</span>
        <span className="text-ink-400 text-sm">
          {topics.length}/{MAX_GROUPS_PER_MARKET}
        </span>
      </Row>

      <Col className="gap-4">
        {topics.length === 0 ? (
          <div className="text-ink-400 rounded-md border border-dashed border-ink-200 py-6 text-center text-sm">
            No topics yet. Add topics to help people find this market.
          </div>
        ) : (
          <Row className="flex-wrap gap-2">
            {topics.map((t) => (
              <TopicTag
                location={'categories list'}
                key={t.id}
                topic={t}
                className="bg-ink-100 hover:bg-ink-200"
              >
                {canEditTopic(t.id) && (
                  <button
                    className="text-ink-400 hover:text-ink-700 ml-0.5 rounded-full p-0.5 transition-colors hover:bg-ink-200"
                    onClick={() => {
                      toast.promise(removeTopic(t), {
                        loading: `Removing "${t.name}"…`,
                        success: `Removed "${t.name}"`,
                        error: `Error removing topic. Try again?`,
                      })
                    }}
                  >
                    <XIcon className="h-3.5 w-3.5" />
                  </button>
                )}
              </TopicTag>
            ))}
          </Row>
        )}

        {canEdit && (
          <Col className="gap-1.5">
            <TopicSelector
              addingToContract={true}
              selectedIds={topics.map((g) => g.id)}
              max={MAX_GROUPS_PER_MARKET}
              setSelectedGroup={(topic) =>
                topic &&
                addTopic(topic).catch((e) => {
                  console.error(e.message)
                  setError(e.message)
                })
              }
            />
            {error && (
              <span className="text-error text-sm">{error}</span>
            )}
          </Col>
        )}
      </Col>
    </Col>
  )
}
