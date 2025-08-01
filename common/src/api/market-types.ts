import { JSONContent } from '@tiptap/core'
import { Answer, MAX_ANSWERS } from 'common/answer'
import { getAnswerProbability, getProbability } from 'common/calculate'
import {
  Contract,
  MAX_QUESTION_LENGTH,
  MultiContract,
  RESOLUTIONS,
  VISIBILITIES,
} from 'common/contract'
import { MINIMUM_BOUNTY } from 'common/economy'
import { DOMAIN } from 'common/envs/constants'
import { MAX_ID_LENGTH } from 'common/group'
import { MAX_MULTI_NUMERIC_ANSWERS } from 'common/multi-numeric'
import { getMappedValue } from 'common/pseudo-numeric'
import { liquidityTiers } from 'common/tier'
import { removeUndefinedProps } from 'common/util/object'
import { richTextToString } from 'common/util/parse'
import { randomStringRegex } from 'common/util/random'
import { z } from 'zod'
import { coerceBoolean, contentSchema } from './zod-types'

export type LiteMarket = {
  // Unique identifier for this market
  id: string

  // Attributes about the creator
  creatorId: string
  creatorUsername: string
  creatorName: string
  createdTime: number
  creatorAvatarUrl?: string

  // Market attributes. All times are in milliseconds since epoch
  closeTime?: number
  question: string
  slug: string
  url: string
  outcomeType: string
  mechanism: string

  pool?: { [outcome: string]: number }
  probability?: number
  p?: number
  totalLiquidity?: number
  // For pseudo-numeric
  value?: number
  min?: number
  max?: number

  volume: number
  volume24Hours: number

  isResolved: boolean
  resolution?: string
  resolutionTime?: number
  resolutionProbability?: number

  uniqueBettorCount: number
  lastUpdatedTime?: number
  lastBetTime?: number
  sportsStartTimestamp?: string
  sportsEventId?: string
  sportsLeague?: string
}
export type ApiAnswer = Omit<
  Answer & {
    probability: number
    pool: { YES: number; NO: number }
  },
  'prob' | 'poolYes' | 'poolNo'
>
export type FullMarket = LiteMarket & {
  // bets?: Bet[]
  // comments?: Comment[]

  // multi markets only
  answers?: ApiAnswer[]
  shouldAnswersSumToOne?: boolean
  addAnswersMode?: 'ANYONE' | 'ONLY_CREATOR' | 'DISABLED'

  // poll only
  options?: { text: string; votes: number }[]

  // bounty only
  totalBounty?: number
  bountyLeft?: number

  description: string | JSONContent
  textDescription: string // string version of description
  coverImageUrl?: string
  groupSlugs?: string[]
}

export function toLiteMarket(
  contract: Contract,
  includeLiteAnswers?: boolean
): LiteMarket {
  const {
    id,
    creatorId,
    creatorUsername,
    creatorName,
    createdTime,
    creatorAvatarUrl,
    closeTime,
    question,
    slug,
    outcomeType,
    mechanism,
    volume,
    volume24Hours,
    isResolved,
    resolution,
    resolutionTime,
    resolutionProbability,
    resolverId,
    uniqueBettorCount,
    lastUpdatedTime,
    lastBetTime,
    lastCommentTime,
    loverUserId1,
    loverUserId2,
    matchCreatorId,
    isLove,
    token,
    siblingContractId,
  } = contract

  const { p, totalLiquidity } = contract as any

  const probability =
    outcomeType === 'BINARY' || outcomeType === 'PSEUDO_NUMERIC'
      ? getProbability(contract)
      : undefined

  let numericValues = {}
  if (contract.outcomeType === 'PSEUDO_NUMERIC') {
    const value = getMappedValue(contract, contract.prob)
    const { min, max, isLogScale } = contract
    numericValues = { value, min, max, isLogScale }
  }
  const answers =
    includeLiteAnswers && contract.mechanism === 'cpmm-multi-1'
      ? contract.answers?.map((answer) => ({
          id: answer.id,
          text: answer.text,
          probability: getAnswerProbability(contract, answer.id),
        }))
      : undefined

  return removeUndefinedProps({
    id,
    creatorId,
    creatorUsername,
    creatorName,
    createdTime,
    creatorAvatarUrl,
    closeTime:
      resolutionTime && closeTime
        ? Math.min(resolutionTime, closeTime)
        : closeTime,
    question,
    slug,
    url: `https://${DOMAIN}/${creatorUsername}/${slug}`,
    pool: 'pool' in contract ? contract.pool : undefined,
    probability,
    p,
    totalLiquidity,
    outcomeType,
    mechanism,
    volume,
    volume24Hours,
    isResolved,
    resolution,
    resolutionTime,
    resolutionProbability,
    resolverId,
    uniqueBettorCount,
    lastUpdatedTime,
    lastBetTime,
    lastCommentTime,
    ...numericValues,
    token,
    siblingContractId,
    answers,

    // Manifold love props.
    loverUserId1,
    loverUserId2,
    matchCreatorId,
    isLove,
  })
}

export function toFullMarket(contract: Contract): FullMarket {
  const liteMarket = toLiteMarket(contract)
  const { outcomeType } = contract
  const answers =
    outcomeType === 'MULTIPLE_CHOICE' && contract.answers
      ? contract.answers.map((answer) =>
          augmentAnswerWithProbability(contract, answer)
        )
      : undefined

  let multiValues = {}
  if (outcomeType === 'MULTIPLE_CHOICE') {
    if (contract.mechanism === 'cpmm-multi-1') {
      multiValues = {
        shouldAnswersSumToOne: contract.shouldAnswersSumToOne,
        addAnswersMode: contract.addAnswersMode,
      }
    } else {
      multiValues = {
        shouldAnswersSumToOne: true,
        addAnswersMode: 'DISABLED',
      }
    }
  }
  const options =
    outcomeType === 'POLL'
      ? contract.options.map(({ text, votes }) => ({ text, votes }))
      : undefined

  const bountyValues =
    outcomeType === 'BOUNTIED_QUESTION'
      ? {
          totalBounty: contract.totalBounty,
          bountyLeft: contract.bountyLeft,
        }
      : {}

  const { description, coverImageUrl, groupSlugs } = contract

  return {
    ...liteMarket,
    ...bountyValues,
    ...multiValues,
    answers,
    options,
    description,
    coverImageUrl,
    groupSlugs,
    textDescription:
      typeof description === 'string'
        ? description
        : richTextToString(description),
  }
}

function augmentAnswerWithProbability(
  contract: MultiContract,
  answer: Answer
): ApiAnswer {
  const probability = getAnswerProbability(contract, answer.id)
  const { poolYes, poolNo, prob: _, ...other } = answer
  const pool = {
    YES: poolYes,
    NO: poolNo,
  }
  return {
    ...other,
    pool,
    probability,
  }
}

// ZOD TYPES

// create market

export const createBinarySchema = z.object({
  outcomeType: z.enum(['BINARY', 'STONK']),
  initialProb: z.number().min(1).max(99).optional(),
})

export const createNumericSchema = z.object({
  outcomeType: z.enum(['PSEUDO_NUMERIC']),
  min: z.number().safe(),
  max: z.number().safe(),
  initialValue: z.number().safe(),
  isLogScale: z.boolean().optional(),
})

export const createMultiSchema = z.object({
  outcomeType: z.enum(['MULTIPLE_CHOICE']),
  answers: z.array(z.string().trim().min(1)).max(MAX_ANSWERS),
  answerShortTexts: z
    .array(z.string().trim().min(1))
    .max(MAX_ANSWERS)
    .optional(),
  answerImageUrls: z
    .array(z.string().trim().min(1))
    .max(MAX_ANSWERS)
    .optional(),
  addAnswersMode: z
    .enum(['DISABLED', 'ONLY_CREATOR', 'ANYONE'])
    .default('DISABLED'),
  shouldAnswersSumToOne: z.boolean().optional(),
})

export const createNumberSchema = z.object({
  outcomeType: z.enum(['NUMBER']),
  min: z.number().safe(),
  max: z.number().safe(),
  precision: z.number().gt(0),
})

export const createMultiNumericSchema = z.object({
  outcomeType: z.enum(['MULTI_NUMERIC']),
  answers: z.array(z.string().trim().min(1)).max(MAX_MULTI_NUMERIC_ANSWERS),
  midpoints: z.array(z.number().safe()).max(MAX_MULTI_NUMERIC_ANSWERS),
  shouldAnswersSumToOne: z.boolean(),
  addAnswersMode: z.enum(['DISABLED']).default('DISABLED'),
  unit: z.string(),
})

export const createMultiDateSchema = z.object({
  outcomeType: z.enum(['DATE']),
  answers: z.array(z.string().trim().min(1)).max(MAX_MULTI_NUMERIC_ANSWERS),
  midpoints: z.array(z.number().safe()).max(MAX_MULTI_NUMERIC_ANSWERS),
  shouldAnswersSumToOne: z.boolean(),
  addAnswersMode: z.enum(['DISABLED']).default('DISABLED'),
  timezone: z.string(),
})

export const createBountySchema = z.object({
  outcomeType: z.enum(['BOUNTIED_QUESTION']),
  totalBounty: z.number().min(MINIMUM_BOUNTY),
  isAutoBounty: z.boolean().optional(),
})

export const createPollSchema = z.object({
  outcomeType: z.enum(['POLL']),
  answers: z.array(z.string().trim().min(1)).min(2).max(MAX_ANSWERS),
  voterVisibility: z.enum(['creator', 'everyone']).optional(),
})

export const createMarketProps = z
  .object({
    question: z.string().min(1).max(MAX_QUESTION_LENGTH),
    description: contentSchema.or(z.string()).optional(),
    descriptionHtml: z.string().optional(),
    descriptionMarkdown: z.string().optional(),
    descriptionJson: z.string().optional(),
    closeTime: z
      .union([z.date(), z.number()])
      .refine(
        (date) =>
          (typeof date === 'number' ? date : date.getTime()) > Date.now(),
        'Close time must be in the future.'
      )
      .optional(),
    groupIds: z.array(z.string().min(1).max(MAX_ID_LENGTH)).optional(),
    visibility: z.enum(VISIBILITIES).default('public').optional(),
    isTwitchContract: z.boolean().optional(),
    utcOffset: z.number().optional(),
    extraLiquidity: z.number().min(1).optional(),
    liquidityTier: z.number().min(liquidityTiers[0]),
    idempotencyKey: z.string().regex(randomStringRegex).length(10).optional(),
    sportsStartTimestamp: z.string().optional(),
    sportsEventId: z.string().optional(),
    sportsLeague: z.string().optional(),
    takerAPIOrdersDisabled: coerceBoolean.optional(),
  })
  .and(
    z.union([
      createMultiSchema,
      createNumericSchema,
      createBountySchema,
      createPollSchema,
      createBinarySchema,
      createNumberSchema,
      createMultiNumericSchema,
      createMultiDateSchema,
    ])
  )

export const updateMarketProps = z
  .object({
    contractId: z.string(),
    question: z.string().min(1).max(MAX_QUESTION_LENGTH).optional(),
    visibility: z.enum(['unlisted', 'public']).optional(),
    closeTime: z.number().optional(),
    addAnswersMode: z.enum(['ONLY_CREATOR', 'ANYONE']).optional(),
    coverImageUrl: z.string().or(z.null()).optional(),
    sort: z.string().optional(),
    description: z.string().optional(),
    descriptionHtml: z.string().optional(),
    descriptionMarkdown: z.string().optional(),
    descriptionJson: z.string().optional(),
    display: z.enum(['clock', 'default']).optional(),
  })
  .strict()

// resolve market

export const resolveBinarySchema = z
  .object({
    outcome: z.enum(RESOLUTIONS),
    probabilityInt: z.number().gte(0).lte(100).optional(),

    // To resolve one answer of multiple choice. Only independent answers supported (shouldAnswersSumToOne = false)
    answerId: z.string().optional(),
  })
  .passthrough() // overlaps with pseudo-numeric

// For multiple choice with shouldAnswersSumToOne = true
export const resolveMultiSchema = z.union([
  z.object({
    outcome: z.literal('CANCEL'),
  }),
  z.object({
    outcome: z.literal('CHOOSE_ONE'),
    answerId: z.string(),
  }),
  z.object({
    outcome: z.literal('CHOOSE_MULTIPLE'),
    resolutions: z.array(
      z.object({
        answerId: z.string(),
        pct: z.number().gte(0).lte(100),
      })
    ),
  }),
])

export const resolvePseudoNumericSchema = z.union([
  z.object({
    outcome: z.literal('CANCEL'),
  }),
  z.object({
    outcome: z.literal('MKT'),
    value: z.number(),
    probabilityInt: z.number().gte(0).lte(100),
  }),
])

export const resolveMarketProps = z
  .object({
    contractId: z.string(),
  })
  .and(
    z.union([
      resolveBinarySchema,
      resolveMultiSchema,
      resolvePseudoNumericSchema,
    ])
  )
