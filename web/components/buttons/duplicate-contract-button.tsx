import clsx from 'clsx'
import { Contract } from 'common/contract'
import { getMappedValue } from 'common/pseudo-numeric'
import { trackCallback } from 'web/lib/service/analytics'
import { buttonClass } from './button'
import Link from 'next/link'
import { NewQuestionParams } from 'web/components/new-contract/new-contract-panel'
import { getLinkTarget } from 'web/components/widgets/linkify'
import { getPrecision } from 'common/src/number'
import { randomString } from 'common/util/random'

export function DuplicateContractButton(props: { contract: Contract }) {
  const { contract } = props
  const href = duplicateContractHref(contract)
  return (
    <Link
      className={clsx(buttonClass('sm', 'indigo-outline'))}
      href={href}
      onClick={trackCallback('duplicate market')}
      target={getLinkTarget(href, true)}
    >
      Duplicate
    </Link>
  )
}

// Pass along the Uri to create a new contract
export function duplicateContractHref(contract: Contract) {
  const descriptionString = JSON.stringify(contract.description)
  // Don't set a closeTime that's in the past
  const closeTime =
    (contract?.closeTime ?? 0) <= Date.now() ? 0 : contract.closeTime
  const params = {
    q: contract.question,
    closeTime,
    outcomeType: contract.outcomeType,
    visibility: contract.visibility,
  } as NewQuestionParams

  // Not sure what description length is the true cutoff, but this seems to work
  if (descriptionString.length < 10000) {
    params.description = descriptionString
  } else {
    params.description = JSON.stringify({
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: `This contract's description is too long to duplicate.`,
        },
      ],
    })
  }

  if (contract.outcomeType === 'PSEUDO_NUMERIC') {
    params.min = contract.min
    params.max = contract.max
    if (contract.isLogScale) {
      // Conditional, because `?isLogScale=false` evaluates to `true`
      params.isLogScale = true
    }
    params.initValue = getMappedValue(contract, contract.initialProbability)
  }
  if (contract.outcomeType === 'NUMBER') {
    params.min = contract.min
    params.max = contract.max
    params.precision = getPrecision(
      contract.min,
      contract.max,
      contract.answers.length
    )
  }

  if (
    contract.outcomeType === 'MULTIPLE_CHOICE' ||
    contract.outcomeType === 'MULTI_NUMERIC' ||
    contract.outcomeType === 'DATE'
  ) {
    params.answers = contract.answers
      .filter((a) => !a.isOther)
      .map((a) => a.text)
  }
  if (
    contract.outcomeType === 'MULTI_NUMERIC' ||
    contract.outcomeType === 'DATE'
  ) {
    params.midpoints = contract.answers.map((a) => a.midpoint!)
  }
  if (contract.outcomeType === 'MULTI_NUMERIC') {
    params.unit = contract.unit
  }

  if (contract.mechanism === 'cpmm-multi-1') {
    params.addAnswersMode = contract.addAnswersMode
    params.shouldAnswersSumToOne = contract.shouldAnswersSumToOne
  }

  if (contract.groupSlugs && contract.groupSlugs.length > 0) {
    params.groupSlugs = contract.groupSlugs
  }

  // lets you duplicate a contract multiple times
  params.rand = randomString(6)

  return `/create?params=` + encodeURIComponent(JSON.stringify(params))
}
