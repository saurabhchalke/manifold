import { useState } from 'react'
import { Button } from '../buttons/button'
import { Modal } from '../layout/modal'
import { Col } from '../layout/col'
import { Row } from '../layout/row'
import { Contract } from 'common/contract'
import { useUser } from 'web/hooks/use-user'
import { api } from 'web/lib/api/api'
import { AddFundsModal } from '../add-funds-modal'
import toast from 'react-hot-toast'
import { BsRocketTakeoff } from 'react-icons/bs'
import { BOOST_COST_MANA } from 'common/economy'
import dayjs from 'dayjs'
import { Input } from '../widgets/input'
import { HOUR_MS } from 'common/util/time'
import { formatMoney } from 'common/util/format'
import { BoostAnalytics } from './boost-analytics'
import { useAdminOrMod } from 'web/hooks/use-admin'

export function AddBoostButton(props: {
  contract: Contract
  className?: string
}) {
  const { contract, className } = props
  const [showPurchase, setShowPurchase] = useState(false)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const user = useUser()

  if (!user) return null

  const disabled =
    contract.isResolved ||
    (contract.closeTime ?? Infinity) < Date.now() ||
    contract.visibility !== 'public'

  if (disabled) return null

  const handleButtonClick = () => {
    if (contract.boosted) {
      setShowAnalytics(true)
    } else {
      setShowPurchase(true)
    }
  }

  return (
    <>
      <Button
        onClick={handleButtonClick}
        color={contract.boosted ? 'indigo-outline' : 'gradient-pink'}
        size="sm"
        className={className}
        data-boost-button
      >
        <BsRocketTakeoff className="mr-1 h-5 w-5" />
        {contract.boosted ? 'Boosted' : 'Boost'}
      </Button>

      <BoostPurchaseModal
        open={showPurchase}
        setOpen={setShowPurchase}
        contract={contract}
      />

      {showAnalytics && (
        <Modal open={showAnalytics} setOpen={setShowAnalytics} size="md">
          <Col className="bg-canvas-0 gap-4 rounded-lg p-6">
            <Row className="items-center gap-2 text-xl font-semibold">
              <BsRocketTakeoff className="h-6 w-6" />
              Boost Analytics
            </Row>
            <BoostAnalytics contract={contract} />
          </Col>
        </Modal>
      )}
    </>
  )
}

function BoostPurchaseModal(props: {
  open: boolean
  setOpen: (open: boolean) => void
  contract: Contract
}) {
  const { open, setOpen, contract } = props
  const [loading, setLoading] = useState<string>()
  const [fundsModalOpen, setFundsModalOpen] = useState(false)
  const now = Date.now()
  const [startTime, setStartTime] = useState(now)
  const user = useUser()
  const isAdminOrMod = useAdminOrMod()

  if (!user) return null

  const notEnoughFunds = (user.balance ?? 0) < BOOST_COST_MANA

  const purchaseBoost = async (paymentMethod: 'mana' | 'cash') => {
    setLoading(paymentMethod)
    try {
      const result = (await api('purchase-boost', {
        contractId: contract.id,
        startTime,
        method: paymentMethod,
      })) as { success: boolean; checkoutUrl?: string }

      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl
        return
      }

      toast.success(
        'Market boosted! It will be featured on the homepage for 24 hours.'
      )
      setOpen(false)
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : 'Error purchasing boost')
    }
    setLoading(undefined)
  }

  const handleAdminFreeBoost = async () => {
    setLoading('admin-free')
    try {
      const result = (await api('purchase-boost', {
        contractId: contract.id,
        startTime,
        method: 'admin-free',
      })) as { success: boolean }

      if (result.success) {
        toast.success(
          'Market boosted for free! It will be featured on the homepage for 24 hours.'
        )
        setOpen(false)
      }
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : 'Error applying free boost')
    }
    setLoading(undefined)
  }

  return (
    <>
      <Modal open={open} setOpen={setOpen} size="sm">
        <Col className="bg-canvas-0 gap-4 rounded-lg p-6">
          <Row className="items-center gap-2 text-xl font-semibold">
            <BsRocketTakeoff className="h-6 w-6" />
            Boost this market
          </Row>

          <div className="text-ink-600">
            Boost this market's visibility on the homepage{' '}
            {Math.abs(startTime - now) < HOUR_MS
              ? 'for the next 24 hours'
              : `from ${dayjs(startTime).format('MMM D')} to ${dayjs(startTime)
                  .add(24, 'hours')
                  .format('MMM D')}`}
          </div>

          <Row className="items-center gap-2">
            <div className="text-ink-600">Start time:</div>
            <Input
              type={'date'}
              className="dark:date-range-input-white"
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                const start = dayjs(e.target.value).startOf('day').valueOf()
                if (start < Date.now()) {
                  setStartTime(Date.now())
                } else {
                  setStartTime(start)
                }
              }}
              min={dayjs().format('YYYY-MM-DD')}
              max="3000-12-31"
              disabled={!!loading}
              value={dayjs(startTime).format('YYYY-MM-DD')}
            />
          </Row>

          <Row className="gap-2">
            <Button
              color="indigo"
              onClick={() => purchaseBoost('mana')}
              loading={loading === 'mana'}
              disabled={!!loading || notEnoughFunds}
              className="flex-1"
            >
              Pay {formatMoney(BOOST_COST_MANA)}
            </Button>
            <Button
              color="indigo"
              onClick={() => purchaseBoost('cash')}
              loading={loading === 'cash'}
              className="flex-1"
              disabled={!!loading}
            >
              Pay $100
            </Button>
          </Row>

          {isAdminOrMod && (
            <Row className="gap-2">
              <Button
                color="indigo-outline"
                onClick={handleAdminFreeBoost}
                loading={loading === 'admin-free'}
                disabled={!!loading}
                className="flex-1"
              >
                <BsRocketTakeoff className="mr-1 h-5 w-5" />
                Free Admin Boost
              </Button>
            </Row>
          )}

          {notEnoughFunds && (
            <div className="text-ink-600 flex items-center gap-2 text-sm">
              <span className="text-error">Insufficient balance</span>
              <Button
                size="xs"
                color="gradient-pink"
                onClick={() => setFundsModalOpen(true)}
              >
                Get mana
              </Button>
            </div>
          )}
        </Col>
      </Modal>

      <AddFundsModal open={fundsModalOpen} setOpen={setFundsModalOpen} />
    </>
  )
}
