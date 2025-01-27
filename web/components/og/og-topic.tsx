import Logo from 'web/public/logo.svg'

// don't use `about` because they are looong or missing. by design.
// TODO: banner image, total members
export type OgTopicProps = {
  id: string
  name: string
  totalMembers: string // number
  topQuestions?: string // comma separated html encoded titles
}

export function OgTopic(props: OgTopicProps) {
  const { name, totalMembers } = props
  const topQuestions = props.topQuestions?.split(',') ?? []

  return (
    <div
      className="relative flex h-full w-full flex-col items-stretch bg-indigo-700 px-6 py-4"
      style={{
        backgroundImage: 'linear-gradient(to bottom, #4338ca, #818cf8)',
      }}
    >
      <div className="flex overflow-hidden text-5xl leading-tight text-white">
        {name} {topQuestions.length > 0 ? 'odds on' : ''}
      </div>

      <div className="mt-2 flex max-h-[150px] flex-col overflow-hidden">
        {topQuestions.map((question, i) => (
          <div key={i} className="mb-2 flex text-xl leading-tight text-gray-50">
            {question}
          </div>
        ))}
      </div>
      {topQuestions.length > 0 && (
        <div className="mt-1 flex text-sm text-gray-300">and more!</div>
      )}

      <div className="mt-auto flex w-full flex-row items-center justify-between text-lg">
        {/* Manifold logo */}
        <div className="flex items-center pb-1">
          <Logo className="h-12 w-12" stroke="white" />

          <span
            className="text-3xl font-thin uppercase text-white"
            style={{ fontFamily: 'var(--font-main), Figtree-light' }}
          >
            Manifold
          </span>
        </div>

        {/* Details */}
        <div className="flex items-center pt-1 text-gray-300">
          a topic with {totalMembers.toLocaleString()} followers
        </div>
      </div>
    </div>
  )
}
