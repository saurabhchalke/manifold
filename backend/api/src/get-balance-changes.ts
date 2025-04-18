import { APIHandler } from 'api/helpers/endpoint'
import { createSupabaseDirectClient } from 'shared/supabase/init'
import { Bet } from 'common/bet'
import { orderBy } from 'lodash'
import { BetBalanceChange, TxnBalanceChange } from 'common/balance-change'
import { Txn } from 'common/txn'
import { filterDefined } from 'common/util/array'
import { charities } from 'common/charity'
import { convertTxn } from 'common/supabase/txns'
import { LiquidityProvision } from 'common/liquidity-provision'
import { getContractsDirect } from 'shared/supabase/contracts'

// market creation fees
export const getBalanceChanges: APIHandler<'get-balance-changes'> = async (
  props
) => {
  const { userId, before, after } = props
  const [betBalanceChanges, txnBalanceChanges, liquidityChanges] =
    await Promise.all([
      getBetBalanceChanges(before, after, userId),
      getTxnBalanceChanges(before, after, userId),
      getLiquidityBalanceChanges(before, after, userId),
    ])
  const allChanges = orderBy(
    [...betBalanceChanges, ...txnBalanceChanges, ...liquidityChanges],
    (change) => change.createdTime,
    'desc'
  )
  return allChanges
}

const getTxnBalanceChanges = async (
  before: number | undefined,
  after: number,
  userId: string
) => {
  const pg = createSupabaseDirectClient()
  const balanceChanges = [] as TxnBalanceChange[]

  const txns = await pg.map(
    `select *
    from txns
    where
      ($1 is null or created_time < millis_to_ts($1)) and
      created_time >= millis_to_ts($2)
      and (to_id = $3 or from_id = $3)
    order by created_time`,
    [before, after, userId],
    convertTxn
  )
  const contractIds = filterDefined(
    txns.map((txn) => getContractIdFromTxn(txn))
  )
  const userIds = filterDefined(
    txns.map((txn) => getOtherUserIdFromTxn(txn, userId))
  )
  const contracts = await getContractsDirect(contractIds, pg)
  const users = await pg.map(
    `select id, username, name from users
    where id = any($1)`,
    [userIds],
    (row) => row
  )
  for (const txn of txns) {
    const contract = contracts.find((c) => c.id === getContractIdFromTxn(txn))
    const user = users.find((u) => u.id === getOtherUserIdFromTxn(txn, userId))
    const balanceChange: TxnBalanceChange = {
      key: txn.id,
      type: txn.category,
      token: txn.token,
      amount: txn.toId === userId ? txn.amount : -txn.amount,
      createdTime: txn.createdTime,
      description: txn.description,
      contract: contract
        ? {
            question:
              contract.visibility === 'public'
                ? contract.question
                : '[unlisted question]',
            visibility: contract.visibility,
            slug: contract.visibility === 'public' ? contract.slug : '',
            creatorUsername: contract.creatorUsername,
            token: contract.token,
          }
        : undefined,
      questType: txn.data?.questType,
      user: user ? { username: user.username, name: user.name } : undefined,
      charity:
        txn.toType === 'CHARITY'
          ? {
              name: charities.find((c) => c.id === txn.toId)?.name ?? txn.toId,
              slug: txn.toId,
            }
          : undefined,
    }
    balanceChanges.push(balanceChange)
  }
  return balanceChanges
}

const getLiquidityBalanceChanges = async (
  before: number | undefined,
  after: number,
  userId: string
) => {
  const pg = createSupabaseDirectClient()
  const liquidityDocs = await pg.map(
    `select data from contract_liquidity
    where user_id = $1
    and created_time >= millis_to_ts($2)
    and ($3 is null or created_time < millis_to_ts($3))
    and data->>'answerId' is not null
    order by created_time desc nulls last`,
    [userId, after, before],
    (row) => row.data as LiquidityProvision
  )

  const contractIds = filterDefined(liquidityDocs.map((doc) => doc.contractId))
  const contracts = await getContractsDirect(contractIds, pg)
  const liquidityChanges = [] as TxnBalanceChange[]
  for (const doc of liquidityDocs) {
    const contract = contracts.find((c) => c.id === doc.contractId)
    if (!contract) continue
    // We just used the ante txns in the balance log, no need to duplicate them
    if (Math.abs(doc.createdTime - contract.createdTime) < 100) continue
    const balanceChange: TxnBalanceChange = {
      key: doc.id,
      type: 'ADD_SUBSIDY',
      token: 'M$',
      amount: -doc.amount,
      createdTime: doc.createdTime,
      contract: {
        question:
          contract.visibility === 'public'
            ? contract.question
            : '[unlisted question]',
        visibility: contract.visibility,
        slug: contract.visibility === 'public' ? contract.slug : '',
        creatorUsername: contract.creatorUsername,
        token: contract.token,
      },
      answerText:
        doc.answerId &&
        contract.visibility === 'public' &&
        contract.mechanism === 'cpmm-multi-1'
          ? contract.answers.find((a) => a.id === doc.answerId)?.text
          : undefined,
    }
    liquidityChanges.push(balanceChange)
  }
  return liquidityChanges
}

const getOtherUserIdFromTxn = (txn: Txn, userId: string) => {
  if (txn.toType === 'USER' && txn.toId !== userId) {
    return txn.toId
  } else if (txn.fromType === 'USER' && txn.fromId !== userId) {
    return txn.fromId
  }
  return undefined
}
const getContractIdFromTxn = (txn: Txn) => {
  if (txn.fromType === 'CONTRACT') {
    return txn.fromId
  } else if (txn.toType === 'CONTRACT') {
    return txn.toId
  } else if ('data' in txn && txn.data?.contractId) {
    return txn.data.contractId
  }

  return null
}

const getBetBalanceChanges = async (
  before: number | undefined,
  after: number,
  userId: string
) => {
  const pg = createSupabaseDirectClient()
  const contractToBets: {
    [contractId: string]: {
      bets: (Bet & { answerText?: string | undefined })[]
      contract: BetBalanceChange['contract']
    }
  } = {}
  await pg.map(
    `select
       json_agg(cb.data || jsonb_build_object('answerText', a.text)) as bets,
       c.id,
       c.question,
       c.slug,
       c.visibility,
       c.data->>'creatorUsername' as creator_username,
       c.token
     from contract_bets cb
        join contracts c on cb.contract_id = c.id
        left join answers a on a.id = cb.answer_id
     where
        ($1 is null or cb.updated_time < millis_to_ts($1))
        and cb.updated_time >= millis_to_ts($2)
        and cb.user_id = $3
     group by c.id;
    `,
    [before, after, userId],
    (row) => {
      contractToBets[row.id] = {
        bets: orderBy(row.bets, (bet) => bet.createdTime, 'asc'),
        contract: {
          question: row.question,
          slug: row.slug,
          visibility: row.visibility,
          creatorUsername: row.creator_username,
          token: row.token,
        },
      }
    }
  )

  const balanceChanges = [] as BetBalanceChange[]
  for (const contractId of Object.keys(contractToBets)) {
    const { bets, contract } = contractToBets[contractId]

    for (let i = 0; i < bets.length; i++) {
      const bet = bets[i]
      const { isRedemption, outcome, createdTime, amount, shares } = bet
      // Bets get their loan amount updated recently, we want to discard them
      if (bet.limitProb === undefined && bet.createdTime < after) continue

      const nextBetExists = i < bets.length - 1
      const nextBetIsRedemption = nextBetExists && bets[i + 1].isRedemption
      if (isRedemption && nextBetIsRedemption) continue
      if (isRedemption && amount === 0) continue

      const { question, visibility, creatorUsername, slug, token } = contract
      const balanceChangeProps = {
        key: bet.id,
        bet: {
          outcome,
          shares,
        },
        contract: {
          question: visibility === 'public' ? question : '[unlisted question]',
          slug: visibility === 'public' ? slug : '',
          visibility,
          creatorUsername,
          token,
        },
        answer:
          bet.answerText && bet.answerId
            ? { text: bet.answerText, id: bet.answerId }
            : undefined,
      }
      if (bet.limitProb !== undefined && bet.fills) {
        const fillsInTimeframe = bet.fills.filter(
          (fill) => fill.timestamp > after
        )
        for (const fill of fillsInTimeframe) {
          const balanceChange = {
            ...balanceChangeProps,
            key: `${bet.id}-${fill.timestamp}`,
            type: 'fill_bet',
            amount: -fill.amount,
            createdTime: fill.timestamp,
          } as BetBalanceChange
          balanceChanges.push(balanceChange)
        }
      } else {
        const changeToBalance = isRedemption ? Math.abs(shares) : -amount
        const balanceChange = {
          ...balanceChangeProps,
          type: isRedemption
            ? 'redeem_shares'
            : amount < 0
            ? 'sell_shares'
            : 'create_bet',
          amount: changeToBalance,
          createdTime,
        } as BetBalanceChange

        balanceChanges.push(balanceChange)
        if (!!bet.loanAmount && bet.loanAmount < 0) {
          balanceChanges.push({
            ...balanceChangeProps,
            key: `${bet.id}-loan-payment`,
            type: 'loan_payment',
            amount:
              bet.loanAmount +
              (isRedemption ? bets[i - 1]?.loanAmount ?? 0 : 0),
            createdTime: createdTime,
          } as BetBalanceChange)
        }
      }
    }
  }
  return balanceChanges
}
