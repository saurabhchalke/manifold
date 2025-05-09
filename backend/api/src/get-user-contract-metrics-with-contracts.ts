import { APIHandler } from './helpers/endpoint'
import { getContractPrivacyWhereSQLFilter } from 'shared/supabase/contracts'
import { createSupabaseDirectClient } from 'shared/supabase/init'
import { ContractMetric, isSummary } from 'common/contract-metric'
import { calculateUpdatedMetricsForContracts } from 'common/calculate-metrics'
import { Dictionary, mapValues } from 'lodash'
import { convertContract } from 'common/supabase/contracts'
import { prefixedContractColumnsToSelect } from 'shared/utils'
import { MarketContract } from 'common/contract'

export const getUserContractMetricsWithContracts: APIHandler<
  'get-user-contract-metrics-with-contracts'
> = async (props, auth) => {
  const { userId, limit, offset = 0, perAnswer = false, inMani } = props
  const visibilitySQL = getContractPrivacyWhereSQLFilter(auth?.uid, 'c.id')
  const pg = createSupabaseDirectClient()
  const q = `
        SELECT 
          (select row_to_json(t) from (select ${prefixedContractColumnsToSelect}) t) as contract,
          jsonb_agg(ucm.data) as metrics
        FROM contracts c
        JOIN user_contract_metrics ucm ON c.id = ucm.contract_id
        WHERE ${visibilitySQL}
          AND ucm.user_id = $1
          and case when c.mechanism = 'cpmm-multi-1' then ucm.answer_id is not null else true end
          ${
            inMani
              ? "and c.data->>'siblingContractId' is not null and ucm.has_shares = true"
              : ''
          }
        GROUP BY c.id, ${prefixedContractColumnsToSelect}
        ORDER BY max((ucm.data->>'lastBetTime')::bigint) DESC NULLS LAST
        OFFSET $2 LIMIT $3
      `
  const results = await pg.map(q, [userId, offset, limit], (row) => ({
    contract: convertContract<MarketContract>(row.contract),
    metrics: row.metrics as ContractMetric[],
  }))

  const { metricsByContract: allMetrics } =
    calculateUpdatedMetricsForContracts(results)
  const metricsByContract = mapValues(allMetrics, (metrics) =>
    perAnswer ? metrics : metrics.filter((m) => isSummary(m))
  ) as Dictionary<ContractMetric[]>

  return {
    metricsByContract,
    contracts: results.map((r) => r.contract),
  }
}
