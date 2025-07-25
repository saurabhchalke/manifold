import {
  DotsHorizontalIcon,
  EyeOffIcon,
  PencilIcon,
} from '@heroicons/react/solid'
import { PostComment } from 'common/comment'
import { getPostShareUrl, TopLevelPost } from 'common/src/top-level-post'
import { richTextToString } from 'common/util/parse'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { IoWarning } from 'react-icons/io5'
import { Button } from 'web/components/buttons/button'
import { CopyLinkOrShareButton } from 'web/components/buttons/copy-link-button'
import { FollowPostButton } from 'web/components/buttons/follow-post-button'
import { BackButton } from 'web/components/contract/back-button'
import { ReactButton } from 'web/components/contract/react-button'
import { Col } from 'web/components/layout/col'
import { Page } from 'web/components/layout/page'
import { Row } from 'web/components/layout/row'
import { Spacer } from 'web/components/layout/spacer'
import { AddPostBoostButton } from 'web/components/posts/add-post-boost-button'
import { SEO } from 'web/components/SEO'
import {
  PostCommentsActivity,
  useNewPostComments,
} from 'web/components/top-level-posts/post-comments'
import DropdownMenu from 'web/components/widgets/dropdown-menu'
import {
  Content,
  TextEditor,
  useTextEditor,
} from 'web/components/widgets/editor'
import { ExpandingInput } from 'web/components/widgets/expanding-input'
import { UserAvatarAndBadge } from 'web/components/widgets/user-link'
import { useAdminOrMod } from 'web/hooks/use-admin'
import { useSaveReferral } from 'web/hooks/use-save-referral'
import { useUser } from 'web/hooks/use-user'
import { api, report as reportContent } from 'web/lib/api/api'
import { getCommentsOnPost } from 'web/lib/supabase/comments'
import { getPostBySlug } from 'web/lib/supabase/posts'
import { DisplayUser, getUserById } from 'web/lib/supabase/users'
import Custom404 from 'web/pages/404'

export async function getStaticProps(props: { params: { slug: string } }) {
  const { slug } = props.params

  const postData = await getPostBySlug(slug)
  const creator = postData ? await getUserById(postData.creatorId) : null
  const comments = postData ? await getCommentsOnPost(postData.id) : []
  const watched: string[] = []
  const skipped: string[] = []

  return {
    props: {
      post: postData,
      creator,
      comments,
      watched,
      skipped,
    },
  }
}

export async function getStaticPaths() {
  return { paths: [], fallback: 'blocking' }
}

export default function PostPage(props: {
  post: TopLevelPost | null
  creator: DisplayUser | null
  comments: PostComment[]
  watched?: string[] //user ids
  skipped?: string[] //user ids
}) {
  const { creator } = props
  const { comments: newComments } = useNewPostComments(props.post?.id ?? '_')
  const comments = [...newComments, ...props.comments]
  const [post, setPost] = useState(props.post)
  const isAdminOrMod = useAdminOrMod()
  const [editing, setEditing] = useState(false)
  const currentUser = useUser()
  useSaveReferral(currentUser, {
    defaultReferrerUsername: post?.creatorUsername,
  })
  useEffect(() => {
    setPost(props.post)
  }, [props.post])

  if (!post || !creator) {
    return <Custom404 />
  }
  const shareUrl = getPostShareUrl(post, currentUser?.username)

  const handleReact = () => {
    if (!currentUser || !post) return
    setPost((prevPost) => {
      if (!prevPost) return null
      const newLikedByUserIds = [
        ...(prevPost.likedByUserIds ?? []),
        currentUser.id,
      ]
      return {
        ...prevPost,
        likedByUserCount: (prevPost.likedByUserCount ?? 0) + 1,
        likedByUserIds: newLikedByUserIds,
      }
    })
  }

  const handleUnreact = () => {
    if (!currentUser || !post) return
    setPost((prevPost) => {
      if (!prevPost) return null
      const newLikedByUserIds =
        prevPost.likedByUserIds?.filter((id) => id !== currentUser.id) ?? []
      return {
        ...prevPost,
        likedByUserCount: Math.max(0, (prevPost.likedByUserCount ?? 0) - 1),
        likedByUserIds: newLikedByUserIds,
      }
    })
  }

  const togglePostVisibility = async () => {
    if (!post) return
    const newVisibility = post.visibility === 'unlisted' ? 'public' : 'unlisted'
    try {
      await api('update-post', {
        id: post.id,
        visibility: newVisibility,
      })
      setPost((prevPost) =>
        prevPost ? { ...prevPost, visibility: newVisibility } : null
      )
      toast.success(
        `Post successfully made ${
          newVisibility === 'public' ? 'public' : 'unlisted'
        }.`
      )
    } catch (error) {
      console.error('Error updating post visibility:', error)
      toast.error(
        `Failed to update post visibility. ${
          error instanceof Error ? error.message : ''
        }`
      )
    } finally {
    }
  }

  return (
    <Page trackPageView={'post slug page'}>
      <SEO
        title={post.title}
        description={richTextToString(post.content)}
        url={'/post/' + post.slug}
        shouldIgnore={post.visibility === 'unlisted'}
      />
      <Col className="mx-auto w-full max-w-2xl px-4 py-4 ">
        {!editing && (
          <Col>
            <Row>
              <BackButton className="!p-0" />
            </Row>
            <Col className="border-canvas-50 pt-4">
              <Row className=" items-center justify-between gap-1 text-2xl font-bold">
                <span>
                  {post.title}{' '}
                  {post.visibility === 'unlisted' && (
                    <EyeOffIcon className="inline-block h-4 w-4" />
                  )}
                </span>
              </Row>
              <Row className="mt-3 items-center gap-2 ">
                {post && (
                  <ReactButton
                    contentId={post.id}
                    contentCreatorId={post.creatorId}
                    user={currentUser}
                    contentType={'post'}
                    contentText={post.title}
                    trackingLocation={'post page'}
                    reactionType={'like'}
                    size={'sm'}
                    userReactedWith={
                      currentUser &&
                      post.likedByUserIds?.includes(currentUser.id)
                        ? 'like'
                        : 'none'
                    }
                    onReact={handleReact}
                    onUnreact={handleUnreact}
                    color={'gray-outline'}
                    className="!p-1.5"
                  >
                    <span className="mr-1">Like</span>
                  </ReactButton>
                )}
                <CopyLinkOrShareButton
                  color={'gray-outline'}
                  tooltip="Copy link to post"
                  url={shareUrl}
                  eventTrackingName={'copy post link'}
                >
                  <span className="ml-2">Share</span>
                </CopyLinkOrShareButton>
                {currentUser && (
                  <FollowPostButton post={post} user={currentUser} />
                )}
                {(isAdminOrMod || post.creatorId === currentUser?.id) &&
                  post && (
                    <DropdownMenu
                      items={[
                        {
                          name:
                            post.visibility === 'unlisted'
                              ? 'Make Public'
                              : 'Make Unlisted',
                          icon:
                            post.visibility === 'unlisted' ? (
                              <EyeOffIcon className="h-5 w-5" />
                            ) : (
                              <EyeOffIcon className="h-5 w-5" />
                            ),
                          onClick: togglePostVisibility,
                        },
                        {
                          name: 'Report',
                          icon: <IoWarning className="h-5 w-5" />,
                          onClick: async () => {
                            await toast.promise(
                              reportContent({
                                contentId: post.id,
                                contentType: 'post',
                                contentOwnerId: post.creatorId,
                              }),
                              {
                                loading: 'Reporting...',
                                success: `Post reported! Admins will take a look within 24 hours.`,
                                error: `Error reporting post`,
                              }
                            )
                          },
                        },
                      ]}
                      buttonContent={<DotsHorizontalIcon className="h-5 w-5" />}
                      buttonClass="p-2"
                      menuWidth="w-40"
                    />
                  )}
              </Row>
            </Col>

            <Row className="border-canvas-50 items-center justify-between gap-4 border-b py-4">
              <UserAvatarAndBadge user={creator} />
              <span className="text-ink-700">
                {new Date(post.createdTime).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </Row>
          </Col>
        )}
        <div className="bg-canvas-0 rounded-lg py-4 sm:py-0">
          <div className="flex w-full flex-col py-4">
            <RichEditPost
              post={post}
              onUpdate={setPost}
              editing={editing}
              setEditing={setEditing}
            />
          </div>
        </div>
        <Row className="my-2">
          <AddPostBoostButton post={post} />
        </Row>
        <Spacer h={4} />
        <PostCommentsActivity post={post} comments={comments} />
      </Col>
    </Page>
  )
}

function RichEditPost(props: {
  post: TopLevelPost
  children?: React.ReactNode
  onUpdate?: (post: TopLevelPost) => void
  editing: boolean
  setEditing: (isEditing: boolean) => void
}) {
  const { post, children, onUpdate, editing, setEditing } = props
  const user = useUser()
  const canEdit = user?.id === post.creatorId
  const [editableTitle, setEditableTitle] = useState(post.title)

  const editor = useTextEditor({
    defaultValue: post.content,
    key: `post ${post?.id || ''}`,
    size: 'lg',
  })

  return editing ? (
    <>
      <ExpandingInput
        value={editableTitle}
        onChange={(e) => setEditableTitle(e.target.value || '')}
        placeholder="Post title"
        className="mb-2 text-2xl font-bold"
      />
      <TextEditor editor={editor} />
      <Spacer h={2} />
      <Row className="gap-2">
        <Button
          color="gray"
          onClick={() => {
            setEditing(false)
            setEditableTitle(post.title)
            editor?.commands.focus('end')
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={async () => {
            if (!editor) return
            const { post: updatedPost } = await api('update-post', {
              id: post.id,
              title: editableTitle,
              content: editor.getJSON(),
            })
            onUpdate?.(updatedPost)
            setEditing(false)
          }}
        >
          Save
        </Button>
      </Row>
    </>
  ) : (
    <Col className="gap-2">
      <Content size="lg" content={post.content} />
      {canEdit && (
        <Row className="place-content-end">
          <Button
            color="gray-white"
            size="xs"
            onClick={() => {
              setEditableTitle(post.title)
              setEditing(true)
              editor?.commands.focus('end')
            }}
          >
            <PencilIcon className="inline h-4 w-4" />
          </Button>
          {children}
        </Row>
      )}
    </Col>
  )
}
