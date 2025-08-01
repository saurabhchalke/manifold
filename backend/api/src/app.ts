import { API, type APIPath } from 'common/api/schema'
import { APIError, pathWithPrefix } from 'common/api/utils'
import { randomString } from 'common/util/random'
import { assertUnreachable } from 'common/util/types'
import * as compression from 'compression'
import * as cors from 'cors'
import * as express from 'express'
import { ErrorRequestHandler, RequestHandler } from 'express'
import { hrtime } from 'node:process'
import { withMonitoringContext } from 'shared/monitoring/context'
import { log, metrics } from 'shared/utils'
import { typedEndpoint } from './helpers/endpoint'
import { handleMcpRequest } from './mcp'
import { addOldRoutes } from './old-routes'
import { handlers } from './routes'

export const allowCorsUnrestricted: RequestHandler = cors({
  origin: '*',
  maxAge: 86400, // 24 hours
})

function cacheController(policy?: string): RequestHandler {
  return (_req, res, next) => {
    if (policy) res.appendHeader('Cache-Control', policy)
    next()
  }
}
const ignoredEndpoints = [
  '/get-channel-messages',
  '/v0/user/by-id/',
  '/get-channel-memberships',
  '/v0/get-mod-reports',
  '/get-channel-seen-time',
]

const requestMonitoring: RequestHandler = (req, res, next) => {
  const traceContext = req.get('X-Cloud-Trace-Context')
  const traceId = traceContext ? traceContext.split('/')[0] : randomString(12)
  const { method, path: endpoint, url } = req
  const baseEndpoint = getBaseName(endpoint)
  const context = { endpoint, traceId, baseEndpoint }
  withMonitoringContext(context, () => {
    if (method == 'OPTIONS') {
      next()
      return
    }
    const startTs = hrtime.bigint()
    const isLocalhost = req.get('host')?.includes('localhost')
    if (!isLocalhost) {
      log(`${method} ${url} ${process.env.PORT}`)
    } else if (!ignoredEndpoints.some((e) => endpoint.startsWith(e))) {
      log(`${method} ${url}`)
    }
    metrics.inc('http/request_count', { baseEndpoint, method })
    res.on('close', () => {
      const endTs = hrtime.bigint()
      const latencyMs = Number(endTs - startTs) / 1e6 // Convert to milliseconds
      metrics.push('http/request_latency', latencyMs, {
        method,
        baseEndpoint,
      })
    })
    next()
  })
}

const getBaseName = (path: string) => {
  const parts = path.split('/').filter(Boolean)
  if (parts.length < 2) return path
  const base = parts[1]
  if (parts.length === 2) return `/${base}`
  const specificPaths = ['bet', 'user', 'group', 'market']
  if (specificPaths.includes(base)) {
    return `/${base}/*`
  }
  return base
}

export const apiErrorHandler: ErrorRequestHandler = (
  error,
  _req,
  res,
  _next
) => {
  if (error instanceof APIError) {
    log.info(error)
    if (!res.headersSent) {
      const output: { [k: string]: unknown } = { message: error.message }
      if (error.details != null) {
        output.details = error.details
      }
      res.status(error.code).json(output)
    }
  } else {
    log.error(error)
    if (!res.headersSent) {
      res.status(500).json({ message: error.stack, error })
    }
  }
}

export const app = express()
app.use(compression())
app.use(requestMonitoring)

app.options('*', allowCorsUnrestricted)

Object.entries(handlers).forEach(([path, handler]) => {
  const api = API[path as APIPath]
  const cache = cacheController((api as any).cache)
  const url = '/' + pathWithPrefix(path as APIPath)

  const apiRoute = [
    url,
    express.json(),
    allowCorsUnrestricted,
    cache,
    typedEndpoint(path as any, handler as any),
    apiErrorHandler,
  ] as const

  if (api.method === 'POST') {
    app.post(...apiRoute)
  } else if (api.method === 'GET') {
    app.get(...apiRoute)
    // } else if (api.method === 'PUT') {
    //   app.put(...apiRoute)
  } else {
    assertUnreachable(api, 'Unsupported API method')
  }
})

// Add MCP POST endpoint
app.post('/v0/mcp', express.json(), allowCorsUnrestricted, handleMcpRequest)

addOldRoutes(app)
