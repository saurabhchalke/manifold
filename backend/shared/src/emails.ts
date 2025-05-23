import { DOMAIN, ENV_CONFIG } from 'common/envs/constants'
import { Bet } from 'common/bet'
import { getProbability } from 'common/calculate'
import {
  Contract,
  ContractToken,
  MultiContract,
  renderResolution,
} from 'common/contract'
import { PrivateUser, User } from 'common/user'
import {
  formatLargeNumber,
  formatMoney,
  formatSweepies,
  SWEEPIES_MONIKER,
} from 'common/util/format'
import { formatNumericProbability } from 'common/pseudo-numeric'
import { sendTemplateEmail, sendTextEmail } from './send-email'
import { contractUrl, getPrivateUser, getUser, log } from 'shared/utils'
import { getContractOGProps } from 'common/contract-seo'
import {
  notification_reason_types,
  NotificationReason,
} from 'common/notification'
import { chunk, Dictionary } from 'lodash'
import { getNotificationDestinationsForUser } from 'common/user-notification-preferences'
import { buildOgUrl } from 'common/util/og'
import { removeUndefinedProps } from 'common/util/object'
import { createSupabaseDirectClient } from 'shared/supabase/init'
import { HOUR_MS } from 'common/util/time'

export type PerContractInvestmentsData = {
  questionTitle: string
  questionUrl: string
  questionProb: string
  profitStyle: string
  currentValue: number
  pastValue: number
  profit: number
  token: ContractToken
}

export type OverallPerformanceData = {
  profit: string
  prediction_streak: string
  markets_traded: string
  profit_style: string
  likes_received: string
  markets_created: string
  unique_bettors: string
  league_rank: string
}

export const formatMoneyEmail = (
  amount: number,
  token: ContractToken = 'MANA'
) => {
  if (token === 'CASH') {
    return formatSweepies(amount).replace(SWEEPIES_MONIKER, 'S')
  }
  return formatMoney(amount).replace(ENV_CONFIG.moneyMoniker, 'M')
}

export const getMarketResolutionEmail = (
  reason: NotificationReason,
  privateUser: PrivateUser,
  userName: string,
  investment: number,
  payout: number,
  creator: User,
  creatorPayout: number,
  contract: Contract,
  resolution: string,
  resolutionProbability?: number,
  resolutions?: { [outcome: string]: number },
  answerId?: string
) => {
  const { sendToEmail, unsubscribeUrl } = getNotificationDestinationsForUser(
    privateUser,
    reason
  )
  if (!privateUser.email || !sendToEmail) return

  const outcome = toDisplayResolution(
    contract,
    resolution,
    resolutionProbability,
    resolutions,
    answerId
  )

  const creatorPayoutText =
    creatorPayout >= 1 && privateUser.id === creator.id
      ? ` (plus ${formatMoneyEmail(
          creatorPayout,
          contract.token
        )} in commissions)`
      : ''

  const correctedInvestment =
    Number.isNaN(investment) || investment < 0 ? 0 : investment

  const displayedInvestment = formatMoneyEmail(
    correctedInvestment,
    contract.token
  )
  const displayedPayout = formatMoneyEmail(payout, contract.token)

  const templateData: market_resolved_template = {
    userId: privateUser.id,
    name: userName,
    creatorName: creator.name,
    question: contract.question,
    outcome,
    investment: displayedInvestment,
    payout: displayedPayout + creatorPayoutText,
    url: `https://${DOMAIN}/${creator.username}/${contract.slug}`,
    unsubscribeUrl,
  }

  // Modify template here:
  // https://app.mailgun.com/app/sending/domains/mg.manifold.markets/templates/edit/market-resolved-bulk/initial

  return {
    entry: [privateUser.email, templateData] as EmailAndTemplateEntry,
    correctedInvestment,
  }
}

type market_resolved_template = {
  userId: string
  name: string
  creatorName: string
  question: string
  outcome: string
  investment: string
  payout: string
  url: string
  unsubscribeUrl: string
}

export const toDisplayResolution = (
  contract: Contract,
  resolution: string,
  resolutionProbability?: number,
  resolutions?: { [outcome: string]: number },
  answerId?: string
) => {
  const isMultiChoice =
    contract.outcomeType === 'MULTIPLE_CHOICE' ||
    contract.outcomeType === 'MULTI_NUMERIC' ||
    contract.outcomeType === 'DATE'
  if (resolution === 'CANCEL') return 'N/A'

  if (contract.outcomeType === 'BINARY') {
    const prob = resolutionProbability ?? getProbability(contract)
    return renderResolution(resolution, prob)
  }

  if (contract.outcomeType === 'PSEUDO_NUMERIC') {
    return contract.resolutionValue
      ? formatLargeNumber(contract.resolutionValue)
      : formatNumericProbability(
          resolutionProbability ?? getProbability(contract),
          contract
        )
  }
  if (contract.outcomeType === 'STONK') {
    return formatNumericProbability(getProbability(contract), contract)
  }

  if (contract.outcomeType === 'NUMBER') {
    if (!resolutions) return 'Invalid resolution data'

    const resolvedAnswerIds = Object.keys(resolutions)
    const resolvedAnswers = contract.answers.filter((a) =>
      resolvedAnswerIds.includes(a.id)
    )
    if (resolvedAnswers.length > 0) {
      return resolvedAnswers.map((a) => a.text).join(', ')
    }
    return 'MULTI'
  }

  const isIndependentMulti = isMultiChoice && !contract.shouldAnswersSumToOne
  if (isIndependentMulti && answerId) {
    const answer = contract.answers.find((a) => a.id === answerId)
    if (answer) {
      return `${answer.text} ${renderResolution(
        resolution,
        resolutionProbability ?? answer.prob
      )}`
    }
  }
  if ((resolution === 'MKT' && resolutions) || resolution === 'CHOOSE_MULTIPLE')
    return 'MULTI'

  const answer = (contract as MultiContract).answers.find(
    (a) => a.id === resolution
  )
  if (answer) return answer.text
  return resolution
}

export const sendWelcomeEmail = async (
  user: User,
  privateUser: PrivateUser
) => {
  if (!privateUser || !privateUser.email) return

  const { name } = user
  const firstName = name.split(' ')[0]

  const { unsubscribeUrl } = getNotificationDestinationsForUser(
    privateUser,
    'onboarding_flow'
  )

  return await sendTemplateEmail(
    privateUser.email,
    'Welcome to Manifold!',
    'welcome',
    {
      name: firstName,
      unsubscribeUrl,
    },
    {
      from: 'David from Manifold <david@manifold.markets>',
      'o:deliverytime': new Date(Date.now() + 2 * HOUR_MS).toUTCString(),
    }
  )
}

export type EmailAndTemplateData = { name: string; [key: string]: string }
export type EmailAndTemplateEntry = [string, EmailAndTemplateData]

export const sendBulkEmails = async (
  subject: string,
  template: string,
  recipients: EmailAndTemplateEntry[],
  from = `Manifold <no-reply@manifold.markets>`
) => {
  // Mailgun has a limit of 1000 recipients per batch
  const emailChunks = chunk(recipients, 1000)
  for (const chunk of emailChunks) {
    const mailgunDomain = 'mg.manifold.markets'
    const mailgunApiKey = process.env.MAILGUN_KEY as string
    const url = `https://api.mailgun.net/v3/${mailgunDomain}/messages`
    const data = new URLSearchParams()
    data.append('from', from)
    data.append('subject', subject)
    data.append('template', template)
    chunk.forEach(([recipientEmail, details]) => {
      data.append('to', `${details.name} <${recipientEmail}>`)
    })
    data.append(
      'recipient-variables',
      JSON.stringify(Object.fromEntries(chunk))
    )

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`api:${mailgunApiKey}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: data,
      })
      const json = await response.json()
      log('Sent bulk emails for subject: ' + subject, json)
    } catch (error) {
      log.error('Error sending emails for subject: ' + subject, {
        error,
      })
    }
  }
}

export const sendPersonalFollowupEmail = async (
  user: User,
  privateUser: PrivateUser,
  sendTime: string
) => {
  if (!privateUser || !privateUser.email) return

  const { name } = user
  const firstName = name.split(' ')[0]

  const emailBody = `Hi ${firstName},

Thanks for signing up! I'm one of the cofounders of Manifold, and was wondering how you've found your experience on the platform so far?

If you haven't already, I encourage you to try creating your own prediction market (https://manifold.markets/create) and joining our Discord chat (https://discord.com/invite/eHQBNBqXuh).

Feel free to reply to this email with any questions or concerns you have.

Cheers,

James
Cofounder of Manifold
https://manifold.markets
 `

  await sendTextEmail(
    privateUser.email,
    'How are you finding Manifold?',
    emailBody,
    {
      from: 'James from Manifold <james@manifold.markets>',
      'o:deliverytime': sendTime,
    }
  )
}

export const sendCreatorGuideEmail = async (
  user: User,
  privateUser: PrivateUser
) => {
  if (!privateUser || !privateUser.email) return

  const { name } = user
  const firstName = name.split(' ')[0]
  const { unsubscribeUrl, sendToEmail } = getNotificationDestinationsForUser(
    privateUser,
    'onboarding_flow'
  )
  if (!sendToEmail) return
  return await sendTemplateEmail(
    privateUser.email,
    'Create your own prediction market',
    'creating-market',
    {
      name: firstName,
      unsubscribeUrl,
    },
    {
      from: 'David from Manifold <david@manifold.markets>',
    }
  )
}

export const sendUnactivatedNewUserEmail = async (
  user: User,
  templateId: string
) => {
  const pg = createSupabaseDirectClient()
  const privateUser = await getPrivateUser(user.id, pg)
  if (!privateUser || !privateUser.email) return

  const { name } = user
  const firstName = name.split(' ')[0]
  const { unsubscribeUrl, sendToEmail } = getNotificationDestinationsForUser(
    privateUser,
    'onboarding_flow'
  )
  if (!sendToEmail) return
  return await sendTemplateEmail(
    privateUser.email,
    `Help improve Manifold + win $100 Amazon gift card`,
    templateId,
    {
      name: firstName,
      unsubscribeUrl,
    },
    {
      from: 'Ian from Manifold <ian@manifold.markets>',
    }
  )
}

export const sendThankYouEmail = async (
  user: User,
  privateUser: PrivateUser
) => {
  if (!privateUser || !privateUser.email) return

  const { name } = user
  const firstName = name.split(' ')[0]
  const { unsubscribeUrl, sendToEmail } = getNotificationDestinationsForUser(
    privateUser,
    'thank_you_for_purchases'
  )

  if (!sendToEmail) return
  return await sendTemplateEmail(
    privateUser.email,
    'Thanks for your Manifold purchase',
    'thank-you',
    {
      name: firstName,
      unsubscribeUrl,
    },
    {
      from: 'David from Manifold <david@manifold.markets>',
    }
  )
}

export const sendMarketCloseEmail = async (
  user: User,
  privateUser: PrivateUser,
  contract: Contract
) => {
  if (!privateUser.email) return
  if (contract.token === 'CASH') return

  const { username, name, id: userId } = user
  const firstName = name.split(' ')[0]

  const { question, slug, volume } = contract

  const url = `https://${DOMAIN}/${username}/${slug}`

  // We ignore if they were able to unsubscribe from market close emails, this is a necessary email
  return await sendTemplateEmail(
    privateUser.email,
    'Your market has closed',
    'market-close',
    {
      question,
      url,
      unsubscribeUrl: '',
      userId,
      name: firstName,
      volume: formatMoneyEmail(volume, contract.token),
    }
  )
}

export const getNewCommentEmail = (
  reason: NotificationReason,
  privateUser: PrivateUser,
  userName: string,
  commentCreator: User,
  contract: Contract,
  commentText: string,
  commentId: string,
  bet?: Bet
) => {
  const { sendToEmail, unsubscribeUrl } = getNotificationDestinationsForUser(
    privateUser,
    reason
  )
  if (!privateUser || !privateUser.email || !sendToEmail) return

  const marketUrl = `https://${DOMAIN}/${contract.creatorUsername}/${contract.slug}#${commentId}`

  const { name: commentorName, avatarUrl: commentorAvatarUrl } = commentCreator

  let betDescription = ''
  if (bet) {
    const { amount } = bet
    betDescription = `${amount < 0 ? 'sold' : 'bought'} ${formatMoneyEmail(
      Math.abs(amount),
      contract.token
    )}`
  }

  if (bet) {
    betDescription = `${betDescription} of ${toDisplayResolution(
      contract,
      bet.outcome
    )}`
  }
  return [
    privateUser.email,
    {
      name: userName,
      commentorName,
      commentorAvatarUrl: commentorAvatarUrl ?? '',
      comment: commentText,
      marketUrl,
      unsubscribeUrl,
      betDescription,
    },
  ] as EmailAndTemplateEntry
}

export const sendNewAnswerEmail = async (
  reason: NotificationReason,
  privateUser: PrivateUser,
  name: string,
  text: string,
  contract: Contract,
  avatarUrl?: string
) => {
  const { creatorId } = contract
  // Don't send the creator's own answers.
  if (privateUser.id === creatorId) return

  const { sendToEmail, unsubscribeUrl } = getNotificationDestinationsForUser(
    privateUser,
    reason
  )
  if (!privateUser.email || !sendToEmail) return

  const { question, creatorUsername, slug } = contract

  const marketUrl = `https://${DOMAIN}/${creatorUsername}/${slug}`

  const subject = `New answer on ${question}`
  const from = `${name} <info@manifold.markets>`

  return await sendTemplateEmail(
    privateUser.email,
    subject,
    'market-answer',
    {
      name,
      avatarUrl: avatarUrl ?? '',
      answer: text,
      marketUrl,
      unsubscribeUrl,
    },
    { from }
  )
}

export const sendInterestingMarketsEmail = async (
  userName: string,
  privateUser: PrivateUser,
  contractsToSend: Contract[]
) => {
  if (!privateUser || !privateUser.email) {
    log.error('No private user or email to send interesting markets email to', {
      userName,
    })
    return
  }

  const { unsubscribeUrl, sendToEmail } = getNotificationDestinationsForUser(
    privateUser,
    'trending_markets'
  )
  if (!sendToEmail) return

  const firstName = userName.split(' ')[0]

  await sendTemplateEmail(
    privateUser.email,
    `${contractsToSend[0].question} & 5 more interesting markets on Manifold`,
    'interesting-markets',
    {
      name: firstName,
      unsubscribeUrl,
      question1Title: contractsToSend[0].question,
      question1Link: contractUrl(contractsToSend[0]),
      question1ImgSrc: imageSourceUrl(contractsToSend[0]),
      question2Title: contractsToSend[1].question,
      question2Link: contractUrl(contractsToSend[1]),
      question2ImgSrc: imageSourceUrl(contractsToSend[1]),
      question3Title: contractsToSend[2].question,
      question3Link: contractUrl(contractsToSend[2]),
      question3ImgSrc: imageSourceUrl(contractsToSend[2]),
      question4Title: contractsToSend[3].question,
      question4Link: contractUrl(contractsToSend[3]),
      question4ImgSrc: imageSourceUrl(contractsToSend[3]),
      question5Title: contractsToSend[4].question,
      question5Link: contractUrl(contractsToSend[4]),
      question5ImgSrc: imageSourceUrl(contractsToSend[4]),
      question6Title: contractsToSend[5].question,
      question6Link: contractUrl(contractsToSend[5]),
      question6ImgSrc: imageSourceUrl(contractsToSend[5]),
    }
  )
}

export const sendBonusWithInterestingMarketsEmail = async (
  user: User,
  privateUser: PrivateUser,
  contractsToSend: Contract[],
  bonusAmount: number
) => {
  if (!privateUser || !privateUser.email) return
  let unsubscribeUrl = ''
  // This is email is of both types, so try either
  const { sendToEmail, unsubscribeUrl: unsub1 } =
    getNotificationDestinationsForUser(privateUser, 'onboarding_flow')
  const { sendToEmail: trendingSendToEmail, unsubscribeUrl: unsub2 } =
    getNotificationDestinationsForUser(privateUser, 'trending_markets')

  if (!sendToEmail && !trendingSendToEmail) return
  unsubscribeUrl = !sendToEmail ? unsub2 : unsub1

  const { name } = user
  const firstName = name.split(' ')[0]

  await sendTemplateEmail(
    privateUser.email,
    `Interesting questions on Manifold + ${bonusAmount} bonus mana`,
    'signup-bonus-with-interesting-markets',
    {
      name: firstName,
      unsubscribeUrl,
      bonusAmount: formatMoney(bonusAmount),
      question1Title: contractsToSend[0].question,
      question1Link: contractUrl(contractsToSend[0]),
      question1ImgSrc: imageSourceUrl(contractsToSend[0]),
      question2Title: contractsToSend[1].question,
      question2Link: contractUrl(contractsToSend[1]),
      question2ImgSrc: imageSourceUrl(contractsToSend[1]),
      question3Title: contractsToSend[2].question,
      question3Link: contractUrl(contractsToSend[2]),
      question3ImgSrc: imageSourceUrl(contractsToSend[2]),
      question4Title: contractsToSend[3].question,
      question4Link: contractUrl(contractsToSend[3]),
      question4ImgSrc: imageSourceUrl(contractsToSend[3]),
      question5Title: contractsToSend[4].question,
      question5Link: contractUrl(contractsToSend[4]),
      question5ImgSrc: imageSourceUrl(contractsToSend[4]),
      question6Title: contractsToSend[5].question,
      question6Link: contractUrl(contractsToSend[5]),
      question6ImgSrc: imageSourceUrl(contractsToSend[5]),
    }
  )
}

function imageSourceUrl(contract: Contract) {
  return buildOgUrl(
    removeUndefinedProps(getContractOGProps(contract)),
    'market'
  )
}
export const getNewFollowedMarketEmail = (
  reason: notification_reason_types,
  userName: string,
  privateUser: PrivateUser,
  contract: Contract
) => {
  const { sendToEmail, unsubscribeUrl } = getNotificationDestinationsForUser(
    privateUser,
    reason
  )
  if (!privateUser.email || !sendToEmail) return
  const firstName = userName.split(' ')[0]
  const creatorName = contract.creatorName

  const questionImgSrc = imageSourceUrl(contract)
  return [
    privateUser.email,
    {
      name: firstName,
      creatorName,
      unsubscribeUrl,
      questionTitle: contract.question,
      questionUrl: contractUrl(contract),
      questionImgSrc,
    },
  ] as EmailAndTemplateEntry
}

export const sendNewPrivateMarketEmail = async (
  reason: notification_reason_types,
  privateUser: PrivateUser,
  contract: Contract,
  groupName: string
) => {
  const { sendToEmail, unsubscribeUrl } = getNotificationDestinationsForUser(
    privateUser,
    reason
  )
  if (!privateUser.email || !sendToEmail) return
  const user = await getUser(privateUser.id)
  if (!user) return

  const { name } = user
  const firstName = name.split(' ')[0]
  const creatorName = contract.creatorName

  const questionImgSrc = imageSourceUrl(contract)
  console.log('questionImgSrc', questionImgSrc)
  return await sendTemplateEmail(
    privateUser.email,
    `${creatorName} asked ${contract.question} in private group, ${groupName}`,
    'new-market-from-private-group',
    {
      name: firstName,
      creatorName,
      unsubscribeUrl,
      questionTitle: contract.question,
      questionUrl: contractUrl(contract),
      questionImgSrc,
      groupName,
    },
    {
      from: `${creatorName} on Manifold <no-reply@manifold.markets>`,
    }
  )
}
export const sendNewUniqueBettorsEmail = async (
  reason: NotificationReason,
  privateUser: PrivateUser,
  contract: Contract,
  totalPredictors: number,
  newPredictors: User[],
  userBets: Dictionary<[Bet, ...Bet[]]>,
  bonusAmount: number
) => {
  const { sendToEmail, unsubscribeUrl } = getNotificationDestinationsForUser(
    privateUser,
    reason
  )
  if (!privateUser.email || !sendToEmail) return
  const user = await getUser(privateUser.id)
  if (!user) return

  const { name } = user
  const firstName = name.split(' ')[0]
  const creatorName = contract.creatorName
  // make the emails stack for the same contract
  const subject = `You made a popular market! ${
    contract.question.length > 50
      ? contract.question.slice(0, 50) + '...'
      : contract.question
  } just got ${
    newPredictors.length
  } new predictions. Check out who's predicting on it inside.`
  const templateData: Record<string, string> = {
    name: firstName,
    creatorName,
    totalPredictors: totalPredictors.toString(),
    marketTitle: contract.question,
    marketUrl: contractUrl(contract),
    bonusString: bonusAmount.toString(),
    unsubscribeUrl,
    newPredictors: newPredictors.length.toString(),
  }

  newPredictors.forEach((p, i) => {
    templateData[`bettor${i + 1}Name`] = p.name
    if (p.avatarUrl) templateData[`bettor${i + 1}AvatarUrl`] = p.avatarUrl
    const bet = userBets[p.id][0]
    if (bet) {
      const { amount } = bet
      templateData[`bet${i + 1}Description`] = `${
        amount < 0 ? 'sold' : 'bought'
      } ${formatMoneyEmail(Math.abs(amount), contract.token)}`
    }
  })

  return await sendTemplateEmail(
    privateUser.email,
    subject,
    // This template accepts 5 unique bettors
    'new-unique-traders',
    templateData,
    {
      from: `Manifold <no-reply@manifold.markets>`,
    }
  )
}

export const getWeeklyPortfolioUpdateEmail = (
  userName: string,
  privateUser: PrivateUser,
  investments: PerContractInvestmentsData[],
  overallPerformance: OverallPerformanceData,
  moversToSend: number
) => {
  if (!privateUser || !privateUser.email) return

  const { unsubscribeUrl, sendToEmail } = getNotificationDestinationsForUser(
    privateUser,
    'profit_loss_updates'
  )

  if (!sendToEmail) return

  const firstName = userName.split(' ')[0]
  const templateData: Record<string, string> = {
    name: firstName,
    unsubscribeUrl,
    ...overallPerformance,
  }
  for (let i = 0; i < moversToSend; i++) {
    const investment = investments[i]
    if (investment) {
      templateData[`question${i + 1}Title`] = investment.questionTitle
      templateData[`question${i + 1}Url`] = investment.questionUrl
      templateData[`question${i + 1}Prob`] = investment.questionProb
      templateData[`question${i + 1}Change`] = formatMoneyEmail(
        investment.profit,
        investment.token
      )
      templateData[`question${i + 1}ChangeStyle`] = investment.profitStyle
      templateData[`question${i + 1}Display`] = 'display: table-row'
    } else templateData[`question${i + 1}Display`] = 'display: none'
  }

  return [
    privateUser.email,
    // Math.random() > 0.5 ? 'iansphilips@gmail.com' : 'boawishbone@gmail.com',
    templateData,
  ] as EmailAndTemplateEntry
}

export type MarketMovementEmailData = {
  questionTitle: string
  questionUrl: string
  prob: string
  probChangeStyle: string
  startProb: number
  endProb: number
  answerText?: string
}

export const getMarketMovementEmail = (
  userName: string,
  privateUser: PrivateUser,
  marketMovements: MarketMovementEmailData[],
  movementsToSend: number
) => {
  if (!privateUser || !privateUser.email) return

  const { unsubscribeUrl, sendToEmail } = getNotificationDestinationsForUser(
    privateUser,
    'market_movements'
  )

  if (!sendToEmail) return

  const firstName = userName.split(' ')[0]
  const templateData: Record<string, string> = {
    name: firstName,
    unsubscribeUrl,
  }

  for (let i = 0; i < movementsToSend; i++) {
    const movement = marketMovements[i]
    if (movement) {
      templateData[`question${i + 1}Title`] = movement.questionTitle
      templateData[`question${i + 1}Url`] = movement.questionUrl
      templateData[`question${i + 1}Prob`] = movement.prob
      const arrowColor =
        movement.endProb > movement.startProb
          ? '#14b8a6' /* green-500 */
          : '#ef4444' /* red-500 */
      templateData[
        `question${i + 1}ArrowStyle`
      ] = `color: ${arrowColor}; font-weight: bold;`
      templateData[`question${i + 1}InitialProb`] = `${Math.round(
        movement.startProb * 100
      )}%`
      templateData[`question${i + 1}ChangeStyle`] = movement.probChangeStyle
      templateData[`question${i + 1}Display`] = 'display: table-row'

      // Add answer text to the template data if available
      if (movement.answerText) {
        // When answer exists
        templateData[`question${i + 1}AnswerText`] = movement.answerText
        templateData[`question${i + 1}AnswerDisplay`] = 'table-row'

        // Show probability on answer row when answer exists
        templateData[`question${i + 1}AnswerProbStyle`] = 'display: inline'

        // Hide probability on question row when answer exists
        templateData[`question${i + 1}ProbStyle`] = 'display: none'
      } else {
        // When no answer exists
        templateData[`question${i + 1}AnswerText`] = ''
        templateData[`question${i + 1}AnswerDisplay`] = 'none'

        // Hide probability on answer row when no answer
        templateData[`question${i + 1}AnswerProbStyle`] = 'display: none'

        // Show probability on question row when no answer
        templateData[`question${i + 1}ProbStyle`] = 'display: inline'
      }
    } else {
      // When question doesn't exist
      templateData[`question${i + 1}Display`] = 'display: none'
      templateData[`question${i + 1}AnswerDisplay`] = 'none'
      templateData[`question${i + 1}Title`] = ''
      templateData[`question${i + 1}AnswerText`] = ''
      templateData[`question${i + 1}ProbStyle`] = 'display: none'
      templateData[`question${i + 1}AnswerProbStyle`] = 'display: none'
    }
  }

  return [privateUser.email, templateData] as EmailAndTemplateEntry
}
