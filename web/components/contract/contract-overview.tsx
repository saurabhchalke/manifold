import clsx from 'clsx'
import { ReactNode, memo, useEffect, useState } from 'react'

import { Answer, MultiSort, getDefaultSort } from 'common/answer'
import { Bet } from 'common/bet'
import { getAutoBountyPayoutPerHour } from 'common/bounty'
import { getAnswerProbability } from 'common/calculate'
import { HistoryPoint, MultiPoints } from 'common/chart'
import {
  BinaryContract,
  BinaryOrPseudoNumericContract,
  BountiedQuestionContract,
  CPMMMultiContract,
  CPMMNumericContract,
  Contract,
  MultiDateContract,
  MultiNumericContract,
  PseudoNumericContract,
  StonkContract,
  dayProbChange,
  getMainBinaryMCAnswer,
  isBinaryMulti,
  tradingAllowed,
} from 'common/contract'
import { isAdminId, isModId } from 'common/envs/constants'
import { NEW_GRAPH_COLOR } from 'common/src/number'
import { Period, periodDurations } from 'common/period'
import { type ChartAnnotation } from 'common/supabase/chart-annotations'
import { filterDefined } from 'common/util/array'
import { formatMoney, formatPercent } from 'common/util/format'
import { orderBy } from 'lodash'
import { FaArrowUp, FaArrowDown, FaChartArea } from 'react-icons/fa'
import { BinaryMultiAnswersPanel } from 'web/components/answers/binary-multi-answers-panel'
import {
  NumberDistributionChart,
  NumericBetPanel,
} from 'web/components/answers/numeric-bet-panel'
import { NumberContractChart } from 'web/components/charts/contract/number'
import { UserPositionSearchButton } from 'web/components/charts/user-position-search-button'
import {
  BinaryResolutionOrChance,
  MultiDateResolutionOrExpectation,
  MultiNumericResolutionOrExpectation,
  NumberResolutionOrExpectation,
  PseudoNumericResolutionOrExpectation,
  StonkPrice,
} from 'web/components/contract/contract-price'
import { SizedContainer } from 'web/components/sized-container'
import { useAnnotateChartTools } from 'web/hooks/use-chart-annotations'
import { useChartPositions } from 'web/hooks/use-chart-positions'
import { useLiveContract } from 'web/hooks/use-contract'
import { usePersistentInMemoryState } from 'client-common/hooks/use-persistent-in-memory-state'
import { useUser } from 'web/hooks/use-user'
import {
  AnswersResolvePanel,
  IndependentAnswersResolvePanel,
} from '../answers/answer-resolve-panel'
import { AnswersPanel } from '../answers/answers-panel'
import { BuyPanel } from '../bet/bet-panel'
import { UserBetsSummary } from '../bet/user-bet-summary'
import {
  ChartAnnotations,
  EditChartAnnotationsButton,
} from '../charts/chart-annotations'
import { MultiBinaryChart, SizedBinaryChart } from '../charts/contract/binary'
import { ChoiceContractChart, getAnswerColor } from '../charts/contract/choice'
import { PseudoNumericContractChart } from '../charts/contract/pseudo-numeric'
import { StonkContractChart } from '../charts/contract/stonk'
import {
  useDataZoomFetcher,
  useMultiChoiceDataZoomFetcher,
} from '../charts/contract/zoom-utils'
import { getEndDate, useZoom } from '../charts/helpers'
import { TimeRangePicker } from '../charts/time-range-picker'
import { Col } from '../layout/col'
import { Row } from '../layout/row'
import { CancelLabel } from '../outcome-label'
import { PollPanel } from '../poll/poll-panel'
import { AlertBox } from '../widgets/alert-box'
import { LoadingIndicator } from '../widgets/loading-indicator'
import { GradientContainer } from '../widgets/gradient-container'
import { getIsLive } from 'common/sports-info'
import { MultiNumericContractChart } from '../charts/contract/multi-numeric'
import { MultiDateContractChart } from '../charts/contract/multi-date'
import { Tooltip } from '../widgets/tooltip'
import { useIsMobile } from 'web/hooks/use-is-mobile'

export const ContractOverview = memo(
  (props: {
    contract: Contract
    betPoints: HistoryPoint<Partial<Bet>>[] | MultiPoints
    showResolver: boolean
    resolutionRating?: ReactNode
    setShowResolver: (show: boolean) => void
    onAnswerCommentClick: (answer: Answer) => void
    chartAnnotations: ChartAnnotation[]
    hideGraph: boolean
    setHideGraph: (hide: boolean) => void
  }) => {
    const {
      betPoints,
      contract,
      showResolver,
      resolutionRating,
      setShowResolver,
      onAnswerCommentClick,
      chartAnnotations,
      hideGraph,
      setHideGraph,
    } = props

    switch (contract.outcomeType) {
      case 'BINARY':
        return (
          <BinaryOverview
            betPoints={betPoints as any}
            contract={contract}
            resolutionRating={resolutionRating}
            chartAnnotations={chartAnnotations}
            zoomY
          />
        )
      case 'PSEUDO_NUMERIC':
        return (
          <PseudoNumericOverview
            contract={contract}
            betPoints={betPoints as any}
            resolutionRating={resolutionRating}
          />
        )

      case 'QUADRATIC_FUNDING':
        return <AlertBox title="Quadratic Funding markets are deprecated" />
      case 'MULTIPLE_CHOICE':
        if (isBinaryMulti(contract)) {
          return (
            <BinaryChoiceOverview
              contract={contract as CPMMMultiContract}
              points={betPoints as any}
              showResolver={showResolver}
              setShowResolver={setShowResolver}
              resolutionRating={resolutionRating}
              chartAnnotations={chartAnnotations}
              zoomY
            />
          )
        }
        return (
          <ChoiceOverview
            contract={contract}
            points={betPoints as MultiPoints}
            showResolver={showResolver}
            setShowResolver={setShowResolver}
            resolutionRating={resolutionRating}
            onAnswerCommentClick={onAnswerCommentClick}
            chartAnnotations={chartAnnotations}
            hideGraph={hideGraph}
            setHideGraph={setHideGraph}
            zoomY
          />
        )
      case 'MULTI_NUMERIC':
        return (
          <MultiNumericOverview
            contract={contract}
            points={betPoints as MultiPoints}
            showResolver={showResolver}
            setShowResolver={setShowResolver}
            resolutionRating={resolutionRating}
            onAnswerCommentClick={onAnswerCommentClick}
          />
        )
      case 'DATE':
        return (
          <MultiDateOverview
            contract={contract}
            points={betPoints as MultiPoints}
            showResolver={showResolver}
            setShowResolver={setShowResolver}
            resolutionRating={resolutionRating}
            onAnswerCommentClick={onAnswerCommentClick}
          />
        )
      case 'NUMBER':
        return (
          <NumberOverview
            contract={contract}
            points={betPoints as MultiPoints}
            showResolver={showResolver}
            setShowResolver={setShowResolver}
            resolutionRating={resolutionRating}
            onAnswerCommentClick={onAnswerCommentClick}
            chartAnnotations={chartAnnotations}
          />
        )
      case 'STONK':
        return (
          <StonkOverview contract={contract} betPoints={betPoints as any} />
        )
      case 'BOUNTIED_QUESTION':
        return <BountyPanel contract={contract} />
      case 'POLL':
        return <PollPanel contract={contract} />
      default:
        return <AlertBox title="Invalid contract" />
    }
  }
)

export const BinaryOverview = (props: {
  contract: BinaryContract
  betPoints: HistoryPoint<Partial<Bet>>[]
  resolutionRating?: ReactNode
  chartAnnotations: ChartAnnotation[]
  zoomY?: boolean
}) => {
  const { contract, resolutionRating, zoomY } = props

  const [showZoomer, setShowZoomer] = useState(false)
  const { currentTimePeriod, setTimePeriod, maxRange, zoomParams } =
    useTimePicker(contract, () => setShowZoomer(true))

  const { points, loading } = useDataZoomFetcher({
    contract,
    viewXScale: zoomParams?.viewXScale,
    points: props.betPoints,
  })

  const {
    pointerMode,
    setPointerMode,
    hoveredAnnotation,
    setHoveredAnnotation,
    chartAnnotations,
    enableAdd,
  } = useAnnotateChartTools(contract, props.chartAnnotations)
  const isMobile = useIsMobile()
  return (
    <>
      <Row className="items-end justify-between gap-2 sm:gap-4">
        <Col>
          <Row className="items-baseline">
            <BinaryResolutionOrChance contract={contract} />
            {!!dayProbChange(contract) && (
              <Tooltip text={`1-day probability change`}>
                <Row
                  className={clsx(
                    'text-ink-700 mx-1 inline-flex items-center rounded-full px-1 align-middle text-xs',
                    contract.probChanges.day > 0
                      ? 'text-teal-600'
                      : 'text-scarlet-500'
                  )}
                >
                  {contract.probChanges.day > 0 ? (
                    <FaArrowUp className="mr-0.5 h-2.5 w-2.5" />
                  ) : (
                    <FaArrowDown className="mr-0.5 h-2.5 w-2.5" />
                  )}
                  {dayProbChange(contract)}
                </Row>
              </Tooltip>
            )}
          </Row>
          {resolutionRating}
        </Col>
        <Row className={'gap-1'}>
          {loading && !isMobile && (
            <LoadingIndicator spinnerColor="border-ink-400" size="sm" />
          )}
          {enableAdd && (
            <EditChartAnnotationsButton
              pointerMode={pointerMode}
              setPointerMode={setPointerMode}
            />
          )}
          <TimeRangePicker
            currentTimePeriod={currentTimePeriod}
            setCurrentTimePeriod={setTimePeriod}
            maxRange={maxRange}
            color="green"
            ignoreLabels={isMobile ? ['6H'] : undefined}
          />
        </Row>
      </Row>

      <SizedBinaryChart
        showZoomer={showZoomer}
        showAnnotations={true}
        zoomParams={zoomParams}
        betPoints={points}
        contract={contract}
        hoveredAnnotation={hoveredAnnotation}
        setHoveredAnnotation={setHoveredAnnotation}
        pointerMode={pointerMode}
        chartAnnotations={chartAnnotations}
        zoomY={zoomY}
      />
      {tradingAllowed(contract) && <BinaryBetPanel contract={contract} />}
    </>
  )
}

const ChoiceOverview = (props: {
  points: MultiPoints
  contract: CPMMMultiContract
  showResolver: boolean
  resolutionRating?: ReactNode
  setShowResolver: (show: boolean) => void
  onAnswerCommentClick: (answer: Answer) => void
  chartAnnotations: ChartAnnotation[]
  zoomY?: boolean
  hideGraph: boolean
  setHideGraph: (hide: boolean) => void
}) => {
  const {
    contract,
    showResolver,
    resolutionRating,
    setShowResolver,
    onAnswerCommentClick,
    zoomY,
    hideGraph,
    setHideGraph,
  } = props

  const currentUser = useUser()
  const currentUserId = currentUser?.id
  const [showZoomer, setShowZoomer] = useState(false)
  const { currentTimePeriod, setTimePeriod, maxRange, zoomParams } =
    useTimePicker(contract, () => setShowZoomer(true))

  const [hoverAnswerId, setHoverAnswerId] = useState<string>()
  const [selectedAnswerIds, setSelectedAnswerIds] = useState<string[]>([])
  const [defaultAnswerIdsToGraph, setDefaultAnswerIdsToGraph] = useState<
    string[]
  >([])
  const shouldAnswersSumToOne =
    'shouldAnswersSumToOne' in contract ? contract.shouldAnswersSumToOne : true

  const [query, setQuery] = usePersistentInMemoryState(
    '',
    'create-answer-text' + contract.id
  )

  const defaultSort = getDefaultSort(contract)
  const [sort, setSort] = usePersistentInMemoryState<MultiSort>(
    defaultSort,
    'answer-sort' + contract.id
  )
  const [showSetDefaultSort, setShowSetDefaultSort] = useState(false)
  useEffect(() => {
    if (
      ((contract.sort && sort !== contract.sort) ||
        (!contract.sort && sort !== defaultSort)) &&
      currentUserId &&
      (isModId(currentUserId) ||
        isAdminId(currentUserId) ||
        contract.creatorId === currentUserId)
    )
      setShowSetDefaultSort(true)
  }, [sort, contract.sort])

  const {
    pointerMode,
    setPointerMode,
    hoveredAnnotation,
    setHoveredAnnotation,
    chartAnnotations,
    enableAdd,
  } = useAnnotateChartTools(contract, props.chartAnnotations)
  const {
    chartPositions,
    setHoveredChartPosition,
    hoveredChartPosition,
    displayUser,
    setDisplayUser,
  } = useChartPositions(contract)
  const contractPositionAnswerIds = chartPositions.map((cp) => cp.answerId)
  useEffect(() => {
    setSelectedAnswerIds(filterDefined(contractPositionAnswerIds))
  }, [JSON.stringify(contractPositionAnswerIds)])

  function addAnswerToGraph(answer: Answer) {
    setSelectedAnswerIds((answers) =>
      answers.includes(answer.id)
        ? answers.filter((a) => a !== answer.id)
        : [...answers, answer.id]
    )
  }
  const { points, loading } = useMultiChoiceDataZoomFetcher({
    contract,
    viewXScale: zoomParams?.viewXScale,
    points: props.points,
    createdTime: contract.createdTime,
    lastBetTime: contract.lastBetTime ?? contract.createdTime,
  })
  return (
    <>
      <Row className="relative justify-between gap-2">
        {contract.resolution === 'CANCEL' ? (
          <div className="flex items-end gap-2 text-2xl sm:text-3xl">
            <span className="text-base">Resolved</span>
            <CancelLabel />
          </div>
        ) : (
          <div />
        )}
        {!hideGraph && (
          <>
            <Row className={'relative gap-1'}>
              {loading && (
                <LoadingIndicator spinnerColor="border-ink-400" size="sm" />
              )}
              <UserPositionSearchButton
                currentUser={currentUser}
                displayUser={displayUser}
                contract={contract}
                setDisplayUser={setDisplayUser}
              />
              {enableAdd && (
                <EditChartAnnotationsButton
                  pointerMode={pointerMode}
                  setPointerMode={setPointerMode}
                />
              )}
              <TimeRangePicker
                currentTimePeriod={currentTimePeriod}
                setCurrentTimePeriod={setTimePeriod}
                maxRange={maxRange}
                color="indigo"
              />
            </Row>
          </>
        )}
      </Row>
      {contract.mechanism == 'cpmm-multi-1' && !hideGraph && (
        <SizedContainer
          className={clsx(
            'h-[150px] w-full pb-4 pr-10 sm:h-[250px]',
            showZoomer && 'mb-12'
          )}
        >
          {(w, h) => (
            <ChoiceContractChart
              showZoomer={showZoomer}
              zoomParams={zoomParams}
              width={w}
              height={h}
              multiPoints={points}
              contract={contract}
              highlightAnswerId={hoverAnswerId}
              selectedAnswerIds={
                selectedAnswerIds.length
                  ? selectedAnswerIds
                  : defaultAnswerIdsToGraph
              }
              pointerMode={pointerMode}
              setHoveredAnnotation={setHoveredAnnotation}
              hoveredAnnotation={hoveredAnnotation}
              chartAnnotations={chartAnnotations}
              chartPositions={chartPositions?.filter((cp) =>
                hoverAnswerId
                  ? cp.answerId === hoverAnswerId
                  : selectedAnswerIds.length === 0 ||
                    (cp.answerId && selectedAnswerIds.includes(cp.answerId))
              )}
              hoveredChartPosition={hoveredChartPosition}
              setHoveredChartPosition={setHoveredChartPosition}
              zoomY={zoomY}
            />
          )}
        </SizedContainer>
      )}
      {chartAnnotations?.length && !hideGraph ? (
        <ChartAnnotations
          annotations={chartAnnotations}
          hoveredAnnotation={hoveredAnnotation}
          setHoveredAnnotation={setHoveredAnnotation}
        />
      ) : null}
      {!shouldAnswersSumToOne && contract.mechanism === 'cpmm-multi-1' ? (
        <IndependentAnswersResolvePanel
          contract={contract}
          onClose={() => setShowResolver(false)}
          show={showResolver}
        />
      ) : showResolver ? (
        <GradientContainer>
          <AnswersResolvePanel
            contract={contract as CPMMMultiContract}
            onClose={() => setShowResolver(false)}
          />
        </GradientContainer>
      ) : null}
      {!showResolver && (
        <>
          {resolutionRating}
          <AnswersPanel
            setDefaultAnswerIdsToGraph={setDefaultAnswerIdsToGraph}
            selectedAnswerIds={selectedAnswerIds}
            contract={contract}
            onAnswerCommentClick={onAnswerCommentClick}
            onAnswerHover={(ans) => setHoverAnswerId(ans?.id)}
            onAnswerClick={
              hideGraph
                ? (ans) => {
                    setSelectedAnswerIds([ans.id])
                    setHideGraph(false)
                  }
                : addAnswerToGraph
            }
            sort={sort}
            setSort={setSort}
            query={query}
            setQuery={setQuery}
            showSetDefaultSort={showSetDefaultSort}
            className={hideGraph ? '-mt-4' : ''}
          />
        </>
      )}
    </>
  )
}
const NumberOverview = (props: {
  points: MultiPoints
  contract: CPMMNumericContract
  showResolver: boolean
  resolutionRating?: ReactNode
  setShowResolver: (show: boolean) => void
  onAnswerCommentClick: (answer: Answer) => void
  chartAnnotations: ChartAnnotation[]
}) => {
  const { points, contract, showResolver, resolutionRating, setShowResolver } =
    props
  const { min, max } = contract
  const user = useUser()
  const {
    currentTimePeriod,
    setCustomTimePeriod,
    setTimePeriod,
    maxRange,
    zoomParams,
  } = useTimePicker(contract, undefined, 'custom')
  const [showDistribution, setShowDistribution] = useState(true)
  const {
    pointerMode,
    setPointerMode,
    hoveredAnnotation,
    setHoveredAnnotation,
    chartAnnotations,
    enableAdd,
  } = useAnnotateChartTools(contract, props.chartAnnotations)

  return (
    <>
      <Row className="justify-between gap-2">
        <NumberResolutionOrExpectation contract={contract} />
        {resolutionRating}
        <Row className={'gap-1'}>
          {enableAdd && !showDistribution && (
            <EditChartAnnotationsButton
              pointerMode={pointerMode}
              setPointerMode={setPointerMode}
            />
          )}
          <button
            className={clsx(
              'text-ink-500 hover:text-ink-700 rounded-l-md ',
              'border-ink-500 -mr-1.5 border border-opacity-50 px-1.5 '
            )}
            onClick={() => {
              setShowDistribution(true)
              setCustomTimePeriod('custom')
            }}
          >
            <div
              className={clsx(
                'rounded-md px-1 py-1.5',
                showDistribution && 'bg-primary-100'
              )}
            >
              <FaChartArea
                className={clsx('h-4 w-4', showDistribution && 'text-ink-800')}
              />
            </div>
          </button>
          <TimeRangePicker
            currentTimePeriod={currentTimePeriod}
            setCurrentTimePeriod={(period) => {
              setShowDistribution(false)
              setTimePeriod(period)
            }}
            maxRange={maxRange}
            color="indigo"
            className={'rounded-l-none'}
          />
        </Row>
      </Row>
      {!!Object.keys(points).length && contract.mechanism == 'cpmm-multi-1' && (
        <SizedContainer
          className={clsx(
            'h-[150px] w-full pb-4 pr-10 sm:h-[250px]',
            !showDistribution && 'mb-12'
          )}
        >
          {(w, h) => (
            <>
              <div className={clsx(!showDistribution ? 'hidden' : 'block')}>
                <NumberDistributionChart
                  newColor={NEW_GRAPH_COLOR}
                  contract={contract}
                  width={w}
                  height={h}
                  range={[min, max]}
                />
              </div>
              {/*// The chart component must be instantiated for useZoom to work*/}
              <div className={clsx(showDistribution ? 'hidden' : 'block')}>
                <NumberContractChart
                  width={w}
                  height={h}
                  multiPoints={points}
                  zoomParams={zoomParams}
                  contract={contract}
                  showZoomer={true}
                />
              </div>
            </>
          )}
        </SizedContainer>
      )}
      {chartAnnotations?.length ? (
        <ChartAnnotations
          annotations={chartAnnotations}
          hoveredAnnotation={hoveredAnnotation}
          setHoveredAnnotation={setHoveredAnnotation}
        />
      ) : null}
      {showResolver ? (
        <GradientContainer>
          <AnswersResolvePanel
            contract={contract}
            onClose={() => setShowResolver(false)}
          />
        </GradientContainer>
      ) : (
        <>
          {resolutionRating}
          {tradingAllowed(contract) && <NumericBetPanel contract={contract} />}
        </>
      )}
    </>
  )
}

const MultiNumericOverview = (props: {
  points: MultiPoints
  contract: MultiNumericContract
  showResolver: boolean
  resolutionRating?: ReactNode
  setShowResolver: (show: boolean) => void
  onAnswerCommentClick: (answer: Answer) => void
}) => {
  const {
    points,
    contract,
    showResolver,
    resolutionRating,
    setShowResolver,
    onAnswerCommentClick,
  } = props

  const [showZoomer, setShowZoomer] = useState(false)
  const { currentTimePeriod, setTimePeriod, maxRange, zoomParams } =
    useTimePicker(contract, () => setShowZoomer(true))

  return (
    <>
      <Row className="relative justify-between gap-2">
        <MultiNumericResolutionOrExpectation contract={contract} />
        <Row className={'relative gap-1'}>
          <TimeRangePicker
            className="h-[2.4rem]"
            currentTimePeriod={currentTimePeriod}
            setCurrentTimePeriod={setTimePeriod}
            maxRange={maxRange}
            color="indigo"
          />
        </Row>
      </Row>
      <SizedContainer
        className={clsx('mb-12 h-[150px] w-full pb-4 pr-10 sm:h-[200px]')}
      >
        {(w, h) => (
          <MultiNumericContractChart
            width={w}
            height={h}
            multiPoints={points}
            zoomParams={zoomParams}
            contract={contract}
            showZoomer={showZoomer}
          />
        )}
      </SizedContainer>
      {!contract.shouldAnswersSumToOne ? (
        <IndependentAnswersResolvePanel
          show={showResolver}
          contract={contract}
          onClose={() => setShowResolver(false)}
        />
      ) : showResolver ? (
        <GradientContainer>
          <AnswersResolvePanel
            contract={contract}
            onClose={() => setShowResolver(false)}
          />
        </GradientContainer>
      ) : null}
      {!showResolver && (
        <>
          {resolutionRating}
          <AnswersPanel
            hideSearch
            selectedAnswerIds={[]}
            contract={contract}
            onAnswerCommentClick={onAnswerCommentClick}
            sort={getDefaultSort(contract)}
            setSort={() => {}}
            query={''}
            setQuery={() => {}}
          />
        </>
      )}
    </>
  )
}
const MultiDateOverview = (props: {
  points: MultiPoints
  contract: MultiDateContract
  showResolver: boolean
  resolutionRating?: ReactNode
  setShowResolver: (show: boolean) => void
  onAnswerCommentClick: (answer: Answer) => void
}) => {
  const {
    points,
    contract,
    showResolver,
    resolutionRating,
    setShowResolver,
    onAnswerCommentClick,
  } = props

  const [showZoomer, setShowZoomer] = useState(false)
  const { currentTimePeriod, setTimePeriod, maxRange, zoomParams } =
    useTimePicker(contract, () => setShowZoomer(true))

  return (
    <>
      <Row className="relative justify-between gap-2">
        <MultiDateResolutionOrExpectation contract={contract} />
        <Row className={'relative gap-1'}>
          <TimeRangePicker
            className="h-[2.4rem]"
            currentTimePeriod={currentTimePeriod}
            setCurrentTimePeriod={setTimePeriod}
            maxRange={maxRange}
            color="indigo"
          />
        </Row>
      </Row>
      <SizedContainer
        className={clsx('mb-12 h-[150px] w-full pb-4 pr-10 sm:h-[200px]')}
      >
        {(w, h) => (
          <MultiDateContractChart
            width={w}
            height={h}
            multiPoints={points}
            zoomParams={zoomParams}
            contract={contract}
            showZoomer={showZoomer}
          />
        )}
      </SizedContainer>
      {!contract.shouldAnswersSumToOne ? (
        <IndependentAnswersResolvePanel
          show={showResolver}
          contract={contract}
          onClose={() => setShowResolver(false)}
        />
      ) : showResolver ? (
        <GradientContainer>
          <AnswersResolvePanel
            contract={contract}
            onClose={() => setShowResolver(false)}
          />
        </GradientContainer>
      ) : null}
      {!showResolver && (
        <>
          {resolutionRating}
          <AnswersPanel
            hideSearch
            selectedAnswerIds={[]}
            contract={contract}
            onAnswerCommentClick={onAnswerCommentClick}
            sort={getDefaultSort(contract)}
            setSort={() => {}}
            query={''}
            setQuery={() => {}}
          />
        </>
      )}
    </>
  )
}

const BinaryChoiceOverview = (props: {
  points: MultiPoints
  contract: CPMMMultiContract
  showResolver: boolean
  resolutionRating?: ReactNode
  setShowResolver: (show: boolean) => void
  chartAnnotations: ChartAnnotation[]
  zoomY?: boolean
}) => {
  const {
    points,
    contract,
    showResolver,
    resolutionRating,
    setShowResolver,
    zoomY,
  } = props
  const user = useUser()

  const [showZoomer, setShowZoomer] = useState(false)
  const { currentTimePeriod, setTimePeriod, maxRange, zoomParams } =
    useTimePicker(contract, () => setShowZoomer(true))

  const answers = contract.answers.map((a) => ({
    ...a,
    prob: getAnswerProbability(contract, a.id),
  }))

  const {
    pointerMode,
    setPointerMode,
    hoveredAnnotation,
    setHoveredAnnotation,
    chartAnnotations,
    enableAdd,
  } = useAnnotateChartTools(contract, props.chartAnnotations)

  const mainAnswer = getMainBinaryMCAnswer(contract)!
  const betPoints = mainAnswer ? props.points[mainAnswer.id] : []
  const leadingAnswer = orderBy(answers, 'prob', 'desc')[0]
  return (
    <>
      {!contract.isResolved && (
        <Row className={clsx('justify-start gap-1 text-xl')}>
          <span style={{ color: getAnswerColor(leadingAnswer) }}>
            {leadingAnswer.text}
          </span>
          <span>{formatPercent(leadingAnswer.prob)}</span>
          {getIsLive(contract) && (
            <Row className="items-center  gap-2 text-base text-red-500">
              <div className="ml-2 h-2 w-2 animate-pulse rounded-full bg-red-500" />
              Live
            </Row>
          )}
        </Row>
      )}
      <Row className="justify-between gap-2">
        {contract.resolution === 'CANCEL' ? (
          <div className="flex items-end gap-2 text-2xl sm:text-3xl">
            <span className="text-base">Resolved</span>
            <CancelLabel />
          </div>
        ) : (
          <div />
        )}
        <Row className={'gap-1'}>
          {enableAdd && (
            <EditChartAnnotationsButton
              pointerMode={pointerMode}
              setPointerMode={setPointerMode}
            />
          )}
          <TimeRangePicker
            currentTimePeriod={currentTimePeriod}
            setCurrentTimePeriod={setTimePeriod}
            maxRange={maxRange}
            color="indigo"
          />
        </Row>
      </Row>
      {!!Object.keys(points).length && contract.mechanism == 'cpmm-multi-1' && (
        <SizedContainer
          className={clsx(
            'h-[150px] w-full pb-4 pr-10 sm:h-[250px]',
            showZoomer && 'mb-12'
          )}
        >
          {(w, h) => (
            <MultiBinaryChart
              showZoomer={showZoomer}
              zoomParams={zoomParams}
              width={w}
              height={h}
              betPoints={betPoints}
              contract={contract}
              zoomY={zoomY}
            />
          )}
        </SizedContainer>
      )}
      {chartAnnotations?.length ? (
        <ChartAnnotations
          annotations={chartAnnotations}
          hoveredAnnotation={hoveredAnnotation}
          setHoveredAnnotation={setHoveredAnnotation}
        />
      ) : null}
      {showResolver ? (
        <GradientContainer>
          <AnswersResolvePanel
            contract={contract}
            onClose={() => setShowResolver(false)}
          />
        </GradientContainer>
      ) : (
        <>
          {resolutionRating}
          <BinaryMultiAnswersPanel contract={contract} />
        </>
      )}
    </>
  )
}

export const SimpleMultiOverview = (props: { contract: CPMMMultiContract }) => {
  const contract = useLiveContract(props.contract)
  const user = useUser()
  const defaultSort = getDefaultSort(contract)

  const [sort, setSort] = usePersistentInMemoryState<MultiSort>(
    defaultSort,
    'answer-sort' + contract.id
  )

  const [query, setQuery] = usePersistentInMemoryState(
    '',
    'create-answer-text' + contract.id
  )

  return (
    <>
      <Row className="justify-between gap-2">
        {contract.resolution === 'CANCEL' ? (
          <div className="flex items-end gap-2 text-2xl sm:text-3xl">
            <span className="text-base">Resolved</span>
            <CancelLabel />
          </div>
        ) : (
          <div />
        )}
      </Row>

      <AnswersPanel
        showAll
        contract={contract}
        selectedAnswerIds={[]}
        sort={sort}
        setSort={setSort}
        query={query}
        setQuery={setQuery}
        onAnswerHover={() => null}
        onAnswerClick={() => null}
        floatingSearchClassName={'top-0 pt-2'}
      />

      <UserBetsSummary
        className="border-ink-200 mb-2 mt-2 "
        contract={contract}
        includeSellButton={user}
      />
    </>
  )
}

const PseudoNumericOverview = (props: {
  contract: PseudoNumericContract
  betPoints: HistoryPoint<Partial<Bet>>[]
  resolutionRating?: ReactNode
}) => {
  const { contract, betPoints, resolutionRating } = props
  const [showZoomer, setShowZoomer] = useState(false)
  const { currentTimePeriod, setTimePeriod, maxRange, zoomParams } =
    useTimePicker(contract, () => setShowZoomer(true))
  const user = useUser()

  return (
    <>
      <Row className="items-end justify-between gap-4">
        <Col>
          <PseudoNumericResolutionOrExpectation contract={contract} />
          {resolutionRating}
        </Col>
        <TimeRangePicker
          currentTimePeriod={currentTimePeriod}
          setCurrentTimePeriod={setTimePeriod}
          maxRange={maxRange}
          color="indigo"
        />
      </Row>
      <SizedContainer className="mb-8 h-[150px] w-full pb-4 pr-10 sm:h-[250px]">
        {(w, h) => (
          <PseudoNumericContractChart
            width={w}
            height={h}
            betPoints={betPoints}
            zoomParams={zoomParams}
            contract={contract}
            showZoomer={showZoomer}
          />
        )}
      </SizedContainer>

      {user && tradingAllowed(contract) && (
        <BinaryBetPanel contract={contract} />
      )}
    </>
  )
}

const StonkOverview = (props: {
  contract: StonkContract
  betPoints: HistoryPoint<Partial<Bet>>[]
}) => {
  const { contract, betPoints } = props
  const [showZoomer, setShowZoomer] = useState(false)
  const { currentTimePeriod, setTimePeriod, maxRange, zoomParams } =
    useTimePicker(contract, () => setShowZoomer(true))
  const user = useUser()

  return (
    <>
      <Row className="items-end justify-between gap-4">
        <StonkPrice contract={contract} />
        <TimeRangePicker
          currentTimePeriod={currentTimePeriod}
          setCurrentTimePeriod={setTimePeriod}
          maxRange={maxRange}
          color="green"
        />
      </Row>
      <SizedContainer className="h-[150px] w-full pb-4 pr-10 sm:h-[250px]">
        {(w, h) => (
          <StonkContractChart
            width={w}
            height={h}
            betPoints={betPoints}
            zoomParams={zoomParams}
            showZoomer={showZoomer}
            contract={contract}
          />
        )}
      </SizedContainer>

      {user && tradingAllowed(contract) && (
        <BinaryBetPanel contract={contract} />
      )}
    </>
  )
}

export function BinaryBetPanel(props: {
  contract: BinaryOrPseudoNumericContract
}) {
  const { contract } = props

  return (
    <Col className="mt-2 w-full">
      <BuyPanel inModal={false} contract={contract} className="bg-canvas-50" />
    </Col>
  )
}

const BountyPanel = (props: { contract: BountiedQuestionContract }) => {
  const { contract } = props
  const { isAutoBounty } = contract
  if (!isAutoBounty) return null

  const payoutPerHour = getAutoBountyPayoutPerHour(contract)

  return (
    <Col className="border-ink-200 self-start rounded border px-3 py-2">
      <div className="text-ink-700 text-sm">Auto-award enabled</div>
      <Row className="items-baseline gap-1">
        <div className="font-semibold text-teal-700">
          {formatMoney(payoutPerHour)} per hour
        </div>
        <div className="text-ink-700 text-sm">
          paid in proportion to comment likes
        </div>
      </Row>
    </Col>
  )
}

export const useTimePicker = (
  contract: Contract,
  onRescale?: () => void,
  defaultTimePeriod?: Period | 'custom'
) => {
  const [currentTimePeriod, setCurrentTimePeriod] = useState<Period | 'custom'>(
    defaultTimePeriod ?? 'allTime'
  )

  const start = contract.createdTime
  const endRange = getEndDate(contract)
  const end = endRange ?? Date.now()
  const maxRange = end - start

  const zoomParams = useZoom((scale) => {
    onRescale?.()
    if (scale) {
      setCurrentTimePeriod('custom')
    } else {
      setCurrentTimePeriod('allTime')
    }
  })

  const setTimePeriod = (period: Period) => {
    if (period === 'allTime') {
      zoomParams.rescale(null)
    } else {
      const time = periodDurations[period]
      const start = end - time
      zoomParams.rescaleBetween(start, end)
    }

    setCurrentTimePeriod(period)
  }

  return {
    currentTimePeriod,
    setTimePeriod,
    maxRange,
    zoomParams,
    setCustomTimePeriod: setCurrentTimePeriod,
  }
}
