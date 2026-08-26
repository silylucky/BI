const fs = require('fs')
const path = require('path')

function send(payload, code = 0) {
  process.stdout.write(JSON.stringify(payload))
  process.exit(code)
}

function readInput() {
  const raw = fs.readFileSync(0, 'utf8')
  return raw ? JSON.parse(raw) : {}
}

function safeModulePath(pluginRoot, modulePath) {
  const root = path.resolve(pluginRoot)
  const resolved = path.resolve(root, modulePath)
  if (!resolved.startsWith(root + path.sep) && resolved !== root) throw new Error('模块路径越出插件目录')
  return resolved
}

function normalizeParameters(parameters) {
  if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) return { type: 'object', properties: {} }
  if (!parameters.type) return { type: 'object', properties: parameters }
  return parameters
}

function discover(payload) {
  const mod = require(safeModulePath(payload.pluginRoot, payload.modulePath))
  if (mod.tool && typeof mod.tool.info === 'function' && typeof mod.tool.run === 'function') {
    const info = mod.tool.info() || {}
    return { ok: true, protocol: 'deeptalk_tool', tool: { ...info, parameters: normalizeParameters(info.parameters) } }
  }
  if (typeof mod.run === 'function') {
    return { ok: true, protocol: 'exec_tool', tool: { name: path.basename(payload.modulePath, path.extname(payload.modulePath)), description: '外部插件执行工具', parameters: { type: 'object', properties: {} } } }
  }
  if (mod.manifest && typeof mod.execute === 'function') {
    return { ok: true, protocol: 'standard', tool: { ...mod.manifest, parameters: normalizeParameters(mod.manifest.parameters) } }
  }
  throw new Error('未发现可支持的导出：tool.info/tool.run、run 或 manifest/execute')
}

async function invoke(payload) {
  const mod = require(safeModulePath(payload.pluginRoot, payload.modulePath))
  const context = payload.context || {}
  const suppliedConfig = context.pluginConfig || {}
  const config = suppliedConfig.vitalspan && typeof suppliedConfig.vitalspan === 'object' ? suppliedConfig.vitalspan : suppliedConfig
  const oldEnv = {}
  const mappings = { VITALSPAN_API: config.api_base || config.apiBaseUrl, VITALSPAN_FE: config.fe_base || config.feAdminUrl, VITALSPAN_USERNAME: config.username, VITALSPAN_DEV_ADMIN_PASSWORD: config.password }
  for (const [key, value] of Object.entries(mappings)) {
    oldEnv[key] = process.env[key]
    if (typeof value === 'string' && value) process.env[key] = value
  }
  try {
    let result
    if (payload.protocol === 'deeptalk_tool') {
      result = await mod.tool.run({ workspaceRoot: context.workspaceRoot || payload.pluginRoot }, { id: `agent-${Date.now()}`, input: payload.args || {} })
      if (result && result.isError) throw new Error(result.content || '插件执行失败')
      result = result && Object.prototype.hasOwnProperty.call(result, 'content') ? { content: result.content } : result
    } else if (payload.protocol === 'exec_tool') {
      result = await mod.run(payload.args || {}, { signal: new AbortController().signal, workspaceRoot: context.workspaceRoot || payload.pluginRoot, pluginConfig: config })
      if (result && result.ok === false) throw new Error(result.error || '插件执行失败')
    } else if (payload.protocol === 'standard') {
      result = await mod.execute(payload.args || {}, { ...context, pluginRoot: payload.pluginRoot })
    } else {
      throw new Error(`不支持的协议：${payload.protocol}`)
    }
    return { ok: true, result: result ?? {} }
  } finally {
    for (const [key, value] of Object.entries(oldEnv)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

;(async () => {
  try {
    const payload = readInput()
    if (process.argv[2] === 'discover') send(discover(payload))
    if (process.argv[2] === 'invoke') send(await invoke(payload))
    throw new Error('未知命令')
  } catch (error) {
    send({ ok: false, error: error instanceof Error ? error.message : String(error) }, 1)
  }
})()
