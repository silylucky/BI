import { useEffect, useState } from 'react'

interface PluginTool {
  id: string
  agent_name: string
  description: string
  enabled: boolean
  requires_confirmation: boolean
  compatibility_status: string
  error_message?: string
}

interface Plugin {
  id: string
  name: string
  version: string
  display_name: string
  description: string
  install_path: string
  enabled: boolean
  status: string
  health_message?: string
  config: Record<string, unknown>
  tools: PluginTool[]
}

interface PluginManagerProps {
  onClose: () => void
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options)
  const body = await response.json()
  if (!response.ok) throw new Error(body.detail || '请求失败')
  return body as T
}

export function PluginManager({ onClose }: PluginManagerProps) {
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [path, setPath] = useState('')
  const [copyToManaged, setCopyToManaged] = useState(false)
  const [configText, setConfigText] = useState('{}')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const loadPlugins = async () => {
    try {
      const data = await request<{ plugins: Plugin[] }>('/plugins')
      setPlugins(data.plugins)
      setSelectedId((current) => current && data.plugins.some((plugin) => plugin.id === current) ? current : data.plugins[0]?.id ?? null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '加载插件失败')
    }
  }

  useEffect(() => { loadPlugins() }, [])

  const selected = plugins.find((plugin) => plugin.id === selectedId) ?? null

  useEffect(() => {
    if (selected) setConfigText(JSON.stringify(selected.config, null, 2))
  }, [selectedId, selected])

  const runAction = async (action: () => Promise<unknown>, successMessage: string) => {
    setLoading(true)
    setMessage('')
    try {
      await action()
      setMessage(successMessage)
      await loadPlugins()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '操作失败')
    } finally {
      setLoading(false)
    }
  }

  const installFromPath = () => runAction(async () => {
    await request('/plugins/install/path', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, copy_to_managed: copyToManaged }) })
    setPath('')
  }, '插件已识别并完成预检。')

  const uploadPlugin = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    await runAction(async () => {
      const formData = new FormData()
      formData.append('file', file)
      await request('/plugins/install/upload', { method: 'POST', body: formData })
    }, '插件包已上传、安装并完成预检。')
    event.target.value = ''
  }

  const saveConfig = () => runAction(async () => {
    if (!selected) return
    const config = JSON.parse(configText) as Record<string, unknown>
    await request(`/plugins/${selected.id}/config`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config }) })
  }, '配置已保存。')

  return (
    <div className="plugin-modal-overlay" onClick={onClose}>
      <section className="plugin-manager" onClick={(event) => event.stopPropagation()}>
        <header className="plugin-manager-header">
          <div><h2>插件管理</h2><p>仅安装可信来源的本地 JavaScript 插件包。</p></div>
          <button className="plugin-icon-btn" onClick={onClose} aria-label="关闭">×</button>
        </header>

        <div className="plugin-install-form">
          <label>本地插件目录</label>
          <div className="plugin-install-row">
            <input value={path} onChange={(event) => setPath(event.target.value)} placeholder="例如：C:\agent\universal_agent\vitalspan-v0.3.1" />
            <button disabled={loading || !path.trim()} onClick={installFromPath}>识别并添加</button>
          </div>
          <label className="plugin-checkbox"><input type="checkbox" checked={copyToManaged} onChange={(event) => setCopyToManaged(event.target.checked)} />复制到受控插件目录（推荐）</label>
          <label className="plugin-upload-label">或上传插件 ZIP<input type="file" accept=".zip" onChange={uploadPlugin} disabled={loading} /></label>
        </div>

        {message && <div className="plugin-message">{message}</div>}

        <div className="plugin-manager-content">
          <aside className="plugin-list">
            {plugins.length === 0 ? <div className="plugin-empty">尚未添加插件</div> : plugins.map((plugin) => (
              <button key={plugin.id} className={`plugin-list-item ${plugin.id === selectedId ? 'selected' : ''}`} onClick={() => setSelectedId(plugin.id)}>
                <strong>{plugin.display_name}</strong><span>{plugin.version} · {plugin.status === 'ready' ? (plugin.enabled ? '已启用' : '未启用') : '预检失败'}</span>
              </button>
            ))}
          </aside>

          <main className="plugin-detail">
            {!selected ? <div className="plugin-empty">选择一个插件查看详情</div> : <>
              <div className="plugin-detail-title"><div><h3>{selected.display_name} <small>v{selected.version}</small></h3><p>{selected.description}</p></div><span className={`plugin-status ${selected.status}`}>{selected.status === 'ready' ? (selected.enabled ? '已启用' : '未启用') : '预检失败'}</span></div>
              {selected.health_message && <p className="plugin-health">预检：{selected.health_message}</p>}
              <div className="plugin-actions">
                <button disabled={loading || selected.status === 'unhealthy'} onClick={() => runAction(() => request(`/plugins/${selected.id}/${selected.enabled ? 'disable' : 'enable'}`, { method: 'POST' }), selected.enabled ? '插件已停用。' : '插件已启用。')}>{selected.enabled ? '停用插件' : '启用插件'}</button>
                <button disabled={loading} onClick={() => runAction(() => request(`/plugins/${selected.id}/health-check`, { method: 'POST' }), '预检完成。')}>重新预检</button>
                <button className="danger" disabled={loading} onClick={() => { if (window.confirm(`确定完全卸载 ${selected.display_name} 吗？插件文件与配置将被删除。`)) runAction(() => request(`/plugins/${selected.id}`, { method: 'DELETE' }), '插件已卸载。') }}>卸载</button>
              </div>
              <h4>运行配置（JSON）</h4>
              <textarea className="plugin-config-editor" value={configText} onChange={(event) => setConfigText(event.target.value)} spellCheck={false} />
              <button disabled={loading} onClick={saveConfig}>保存配置</button>
              <h4>工具</h4>
              <div className="plugin-tools">{selected.tools.map((tool) => <div className="plugin-tool" key={tool.id}><div><strong>{tool.agent_name}</strong><p>{tool.description}</p>{tool.error_message && <em>{tool.error_message}</em>}</div><span>{tool.compatibility_status === 'compatible' ? (tool.requires_confirmation ? '高风险确认' : tool.enabled ? '可用' : '未启用') : '需手动适配'}</span></div>)}</div>
            </>}
          </main>
        </div>
      </section>
    </div>
  )
}
