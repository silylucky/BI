#!/usr/bin/env node
/**
 * 输出最小 html customViz 模板（stdout 或 --out）。
 * 用法：node scripts/scaffold-custom-viz-html.mjs --id my-widget-v1 --name "我的组件"
 */
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    id: { type: "string", default: "my-custom-viz-v1" },
    name: { type: "string", default: "我的自定义组件" },
    out: { type: "string" },
  },
});

const manifest = {
  id: values.id,
  displayName: values.name,
  version: "1.0.0",
  entry: "index.html",
  runtime: "html",
  fieldSlots: {
    dimensions: { min: 1, max: 1, label: "类别" },
    metrics: { min: 1, max: 1, label: "数值" },
  },
  styleSchema: {
    type: "object",
    properties: {
      accentColor: { type: "string", format: "color", title: "主题色" },
      showValue: { type: "boolean", title: "显示数值" },
    },
  },
  defaultStyle: {
    accentColor: "#3b82f6",
    showValue: true,
  },
  styleHooks: {
    accentColor: { selectors: [".fill"], property: "background" },
    showValue: { hideWhenFalse: true, hideSelectors: [".val"] },
  },
};

const indexHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
html,body{margin:0;height:100%;background:transparent;color:var(--dashboard-text-primary,#e2e8f0);font-family:system-ui,sans-serif}
#vs-cv-root{padding:12px;height:100%;box-sizing:border-box}
.row{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.fill{flex:1;height:20px;border-radius:999px;background:var(--vs-palette-0,var(--vs-style-accent-color,#3b82f6))}
.val{font-size:12px;color:var(--dashboard-text-muted,#98a2b3)}
.hint{padding:12px;font-size:12px;color:var(--dashboard-text-muted,#98a2b3);text-align:center}
</style></head><body><div id="vs-cv-root"></div><script>(function(){
var host=document.currentScript&&document.currentScript.parentElement;
function readPayload(){if(host&&host.vsCv&&host.vsCv.getPayload)return host.vsCv.getPayload();return null}
function render(p){
  p=p||readPayload();var root=(host||document).querySelector('#vs-cv-root');if(!root)return;
  var st=(p&&p.style)||{};var rows=(p&&p.rows)||[];
  if(!rows.length){root.innerHTML='<div class="hint">请绑定数据</div>';return}
  root.innerHTML='';rows.slice(0,10).forEach(function(r){
    var row=document.createElement('div');row.className='row';
    var fill=document.createElement('div');fill.className='fill';
    var val=document.createElement('div');val.className='val';val.textContent=String(r[1]??'');
    row.appendChild(fill);if(st.showValue!==false)row.appendChild(val);root.appendChild(row);
  });
}
if(host&&host.vsCv&&host.vsCv.mount){host.vsCv.mount(render)}else{render(readPayload())}
})();</script></body></html>`;

const bundle = { manifest, files: { "index.html": indexHtml } };
const json = `${JSON.stringify(bundle, null, 2)}\n`;

if (values.out) {
  writeFileSync(values.out, json, "utf8");
  console.error(`Wrote ${values.out}`);
} else {
  process.stdout.write(json);
}
