import clsx from 'clsx'
import { track } from 'web/lib/service/analytics'
import { Col } from '../layout/col'
import { getLabelFromValue } from './search-dropdown-helpers'

import { useState } from 'react'
import { FaSortAmountDownAlt } from 'react-icons/fa'
import { FaFileContract, FaFilter, FaSliders } from 'react-icons/fa6'
import { IconButton } from 'web/components/buttons/button'
import { Carousel } from 'web/components/widgets/carousel'
import { MODAL_CLASS, Modal } from '../layout/modal'
import { Row } from '../layout/row'
import {
  BOUNTY_MARKET_SORTS,
  CONTRACT_TYPES,
  ContractTypeType,
  DEFAULT_BOUNTY_SORTS,
  DEFAULT_CONTRACT_TYPE,
  DEFAULT_CONTRACT_TYPES,
  DEFAULT_FILTER,
  DEFAULT_FILTERS,
  DEFAULT_POLL_SORTS,
  DEFAULT_SORT,
  DEFAULT_SORTS,
  DEFAULT_TIER,
  FILTERS,
  FOR_YOU_KEY,
  Filter,
  POLL_SORTS,
  PREDICTION_MARKET_PROB_SORTS,
  PREDICTION_MARKET_SORTS,
  SORTS,
  SearchParams,
  Sort,
  bountySorts,
  predictionMarketSorts,
} from '../supabase-search'
import {
  AdditionalFilterPill,
  FilterDropdownPill,
  FilterPill,
} from './filter-pills'
import { SpiceCoin } from 'web/public/custom-components/spiceCoin'
import { MarketTierType, TierParamsType, tiers } from 'common/tier'
import { TierDropdownPill } from './filter-pills'
import { useUser } from 'web/hooks/use-user'
import {
  CrystalTier,
  PlusTier,
  PremiumTier,
} from 'web/public/custom-components/tiers'

export function ContractFilters(props: {
  className?: string
  params: SearchParams
  updateParams: (params: Partial<SearchParams>) => void
  topicSlug?: string
}) {
  const { className, params, updateParams, topicSlug } = props

  const {
    s: sort,
    f: filter,
    ct: contractType,
    p: isPrizeMarketString,
    mt: currentTiers,
  } = params

  const selectFilter = (selection: Filter) => {
    if (selection === filter) return

    updateParams({ f: selection })
    track('select search filter', { filter: selection })
  }

  const selectSort = (selection: Sort) => {
    if (selection === sort) return

    if (selection === 'close-date') {
      updateParams({ s: selection, f: 'open' })
    } else if (selection === 'resolve-date') {
      updateParams({ s: selection, f: 'resolved' })
    } else {
      updateParams({ s: selection })
    }

    track('select search sort', { sort: selection })
  }

  const selectContractType = (selection: ContractTypeType) => {
    if (selection === contractType) return

    if (selection === 'BOUNTIED_QUESTION' && predictionMarketSorts.has(sort)) {
      updateParams({ s: 'bounty-amount', ct: selection })
    } else if (selection !== 'BOUNTIED_QUESTION' && bountySorts.has(sort)) {
      updateParams({ s: 'score', ct: selection })
    } else {
      updateParams({ ct: selection })
    }
    track('select contract type', { contractType: selection })
  }

  const togglePrizeMarket = () => {
    updateParams({
      p: isPrizeMarketString == '1' ? '0' : '1',
    })
  }

  const hideFilter =
    sort === 'resolve-date' ||
    sort === 'close-date' ||
    contractType === 'BOUNTIED_QUESTION'

  const filterLabel = getLabelFromValue(FILTERS, filter)
  const sortLabel = getLabelFromValue(SORTS, sort)
  const contractTypeLabel = getLabelFromValue(CONTRACT_TYPES, contractType)

  const sortItems =
    contractType == 'BOUNTIED_QUESTION'
      ? DEFAULT_BOUNTY_SORTS
      : contractType == 'POLL'
      ? DEFAULT_POLL_SORTS
      : DEFAULT_SORTS

  const [openFilterModal, setOpenFilterModal] = useState(false)

  const nonDefaultSort =
    !DEFAULT_SORTS.some((s) => s == sort) && sort !== DEFAULT_SORT
  const nonDefaultContractType =
    !DEFAULT_CONTRACT_TYPES.some((ct) => ct == contractType) &&
    contractType !== DEFAULT_CONTRACT_TYPE

  const forYou = params[FOR_YOU_KEY] === '1'
  const user = useUser()

  const toggleTier = (tier: MarketTierType) => {
    const tierIndex = tiers.indexOf(tier)
    if (tierIndex >= 0 && tierIndex < currentTiers.length) {
      const tiersArray = currentTiers.split('')
      tiersArray[tierIndex] = tiersArray[tierIndex] === '0' ? '1' : '0'
      updateParams({ mt: tiersArray.join('') as TierParamsType })
    }
  }

  return (
    <Col className={clsx('mb-1 mt-2 items-stretch gap-1 ', className)}>
      <Carousel labelsParentClassName="-ml-1.5 gap-1 items-center">
        <IconButton size="2xs" onClick={() => setOpenFilterModal(true)}>
          <FaSliders className="h-4 w-4" />
        </IconButton>
        {sortItems.map((sortValue) => (
          <FilterPill
            key={sortValue}
            selected={sortValue === sort}
            onSelect={() => {
              if (sort === sortValue) {
                selectSort(DEFAULT_SORT)
              } else {
                selectSort(sortValue as Sort)
              }
            }}
            type="sort"
          >
            {getLabelFromValue(SORTS, sortValue)}
          </FilterPill>
        ))}
        {user && !topicSlug && (
          <FilterPill
            selected={forYou}
            onSelect={() => {
              updateParams({
                [FOR_YOU_KEY]: forYou ? '0' : '1',
              })
            }}
            type="sort"
          >
            For You
          </FilterPill>
        )}
        <FilterDropdownPill
          selectFilter={selectFilter}
          currentFilter={filter}
        />
        {isPrizeMarketString === '1' && (
          <FilterPill
            selected={isPrizeMarketString === '1'}
            onSelect={togglePrizeMarket}
            type="spice"
            className="gap-1"
          >
            <div className="flex w-4 items-center">
              <SpiceCoin
                className={isPrizeMarketString !== '1' ? 'opacity-50' : ''}
              />
            </div>
            Prize
          </FilterPill>
        )}
        {!hideFilter && currentTiers !== DEFAULT_TIER && (
          <AdditionalFilterPill
            type="filter"
            onXClick={() =>
              updateParams({ mt: DEFAULT_TIER as TierParamsType })
            }
          >
            <Row className="items-center py-[3px]">
              {currentTiers.split('').map((tier, index) => {
                if (tier === '1') {
                  if (tiers[index] == 'plus') {
                    return <PlusTier key={index} />
                  }
                  if (tiers[index] == 'premium') {
                    return <PremiumTier key={index} />
                  }
                  if (tiers[index] == 'crystal') {
                    return <CrystalTier key={index} />
                  }
                }
              })}
            </Row>
          </AdditionalFilterPill>
        )}
        {nonDefaultSort && (
          <AdditionalFilterPill
            type="sort"
            onXClick={() => selectSort(DEFAULT_SORT)}
          >
            {sortLabel}
          </AdditionalFilterPill>
        )}
        {nonDefaultContractType && (
          <AdditionalFilterPill
            type="contractType"
            onXClick={() => selectContractType(DEFAULT_CONTRACT_TYPE)}
          >
            {contractTypeLabel}
          </AdditionalFilterPill>
        )}
        {!hideFilter &&
          DEFAULT_FILTERS.map((filterValue) => (
            <FilterPill
              key={filterValue}
              selected={filterValue === filter}
              onSelect={() => {
                if (filterValue === filter) {
                  selectFilter(DEFAULT_FILTER)
                } else {
                  selectFilter(filterValue as Filter)
                }
              }}
              type="filter"
            >
              {getLabelFromValue(FILTERS, filterValue)}
            </FilterPill>
          ))}
        {DEFAULT_CONTRACT_TYPES.map((contractValue) => (
          <FilterPill
            key={contractValue}
            selected={contractValue === contractType}
            onSelect={() => {
              if (contractValue === contractType) {
                selectContractType(DEFAULT_CONTRACT_TYPE)
              } else {
                selectContractType(contractValue as ContractTypeType)
              }
            }}
            type="contractType"
          >
            {getLabelFromValue(CONTRACT_TYPES, contractValue)}
          </FilterPill>
        ))}
      </Carousel>
      <FilterModal
        open={openFilterModal}
        setOpen={setOpenFilterModal}
        params={params}
        selectFilter={selectFilter}
        selectSort={selectSort}
        selectContractType={selectContractType}
        togglePrizeMarket={togglePrizeMarket}
        toggleTier={toggleTier}
        hideFilter={hideFilter}
      />
    </Col>
  )
}

function FilterModal(props: {
  open: boolean
  setOpen: (open: boolean) => void
  params: SearchParams
  selectFilter: (selection: Filter) => void
  selectSort: (selection: Sort) => void
  selectContractType: (selection: ContractTypeType) => void
  togglePrizeMarket: () => void
  toggleTier: (tier: MarketTierType) => void
  hideFilter: boolean
}) {
  const {
    open,
    setOpen,
    params,
    selectFilter,
    selectContractType,
    selectSort,
    togglePrizeMarket,
    toggleTier,
    hideFilter,
  } = props
  const {
    s: sort,
    f: filter,
    ct: contractType,
    p: isPrizeMarketString,
    mt: currentTiers,
  } = params

  const sortItems =
    contractType == 'BOUNTIED_QUESTION'
      ? BOUNTY_MARKET_SORTS
      : contractType == 'POLL'
      ? POLL_SORTS
      : contractType === 'ALL' || contractType === 'BINARY'
      ? PREDICTION_MARKET_PROB_SORTS
      : PREDICTION_MARKET_SORTS

  return (
    <Modal open={open} setOpen={setOpen}>
      <Col className={clsx(MODAL_CLASS, 'text-ink-600 text-sm')}>
        {!hideFilter && (
          <Col className="gap-2">
            <Row className="items-center gap-1 font-semibold">
              <FaFilter className="h-4 w-4" />
              Filters
            </Row>
            <Row className="flex-wrap gap-1">
              <FilterPill
                selected={isPrizeMarketString === '1'}
                onSelect={togglePrizeMarket}
                type="spice"
              >
                <Row className="items-center gap-1">
                  <SpiceCoin
                    className={isPrizeMarketString !== '1' ? 'opacity-50' : ''}
                  />
                  Prize
                </Row>
              </FilterPill>
              <TierDropdownPill
                toggleTier={toggleTier}
                currentTiers={currentTiers}
              />
              {!hideFilter &&
                FILTERS.map(({ label: filterLabel, value: filterValue }) => (
                  <FilterPill
                    key={filterValue}
                    selected={filterValue === filter}
                    onSelect={() => {
                      if (filterValue === filter) {
                        selectFilter(DEFAULT_FILTER)
                      } else {
                        selectFilter(filterValue as Filter)
                      }
                    }}
                    type="filter"
                  >
                    {filterLabel}
                  </FilterPill>
                ))}
            </Row>
          </Col>
        )}
        <Col className="gap-2">
          <Row className="items-center gap-1 font-semibold">
            <FaSortAmountDownAlt className="h-4 w-4" />
            Sorts
          </Row>
          <Row className="flex-wrap gap-1">
            {sortItems.map(({ label: sortLabel, value: sortValue }) => (
              <FilterPill
                key={sortValue}
                selected={sortValue === sort}
                onSelect={() => {
                  if (sortValue === sort) {
                    selectSort(DEFAULT_SORT)
                  } else {
                    selectSort(sortValue as Sort)
                  }
                }}
                type="sort"
              >
                {sortLabel}
              </FilterPill>
            ))}
          </Row>
        </Col>
        <Col className="gap-2">
          <Row className="items-center gap-1 font-semibold">
            <FaFileContract className="h-4 w-4" />
            Market Type
          </Row>
          <Row className="flex-wrap gap-1">
            {CONTRACT_TYPES.map(
              ({ label: contractTypeLabel, value: contractTypeValue }) => (
                <FilterPill
                  key={contractTypeValue}
                  selected={contractTypeValue === contractType}
                  onSelect={() => {
                    if (contractTypeValue === contractType) {
                      selectContractType(DEFAULT_CONTRACT_TYPE)
                    } else {
                      selectContractType(contractTypeValue as ContractTypeType)
                    }
                  }}
                  type="contractType"
                >
                  {contractTypeLabel}
                </FilterPill>
              )
            )}
          </Row>
        </Col>
      </Col>
    </Modal>
  )
}
