#!/usr/bin/env node
/**
 * Patch VS-AI-SPEC customViz examples for Payload v1 + vs-cv-payload-update only.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const examplesDir = path.join(root, "docs/api/vs-ai-spec/examples");

function qHost(id) {
  return `(host||document).querySelector('#${id}')`;
}

const RUNTIME_HELPERS =
  "var host=document.currentScript&&document.currentScript.parentElement;" +
  "function readPayload(){if(host&&host.vsCv&&host.vsCv.getPayload)return host.vsCv.getPayload();var n=(host||document).querySelector('.vs-cv-payload');if(!n||!n.textContent)return null;try{return JSON.parse(n.textContent)}catch(e){return null}}" +
  "function bindingStatusOf(p){if(!p)return 'unbound';return p.bindingStatus||((p.rows&&p.rows.length)?'bound':'unbound')}" +
  "function statusHint(p){var st=bindingStatusOf(p);if(st==='error')return(p&&p.error)||'数据加载失败';if(st==='empty')return'暂无数据';if(st==='unbound')return'请在右侧绑定数据集与字段';return null}" +
  "function attachPayloadListener(render){render();if(host&&host.vsCv&&host.vsCv.onPayload){host.vsCv.onPayload(function(p){render(p)});return}if(host&&host.classList.contains('vs-custom-viz-host')){host.addEventListener('vs-cv-payload-update',function(e){render(e.detail||readPayload())})}}";

const LAYOUT_LISTENER =
  "function attachLayoutListener(render){if(host&&host.vsCv&&host.vsCv.onLayout){host.vsCv.onLayout(function(){render(readPayload())});return}if(typeof ResizeObserver!=='undefined'&&host){new ResizeObserver(function(){render(readPayload())}).observe(host)}}";

const MOUNT_BOOT =
  "function boot(render){if(host&&host.vsCv&&host.vsCv.mount){host.vsCv.mount(function(p){render(p)});return}attachPayloadListener(function(p){render(p||readPayload())});attachLayoutListener(function(){render(readPayload())})}";

const BUNDLE_SCRIPT =
  "(function(){" +
  RUNTIME_HELPERS +
  LAYOUT_LISTENER +
  MOUNT_BOOT +
  "function rowsFromPayload(p){var st=bindingStatusOf(p);if(st!=='bound'||!p||!p.rows||!p.rows.length)return null;var cols=p.columns||[];var di=cols.findIndex(function(c){return c!=='sum'&&c!=='count'});var mi=cols.findIndex(function(c,i){return i!==di});if(di<0)di=0;if(mi<0)mi=1;return p.rows.map(function(r){return{n:String(r[di]),v:Number(r[mi])||0}})}" +
  "function render(){var p=readPayload();var st=(p&&p.style)||{};var root=" +
    qHost("vs-cv-root") +
    ";if(!root)return;var hint=statusHint(p);var data=rowsFromPayload(p);root.innerHTML='';if(hint||!data){var msg=document.createElement('div');msg.style.cssText='padding:12px;font-size:12px;color:var(--dashboard-text-muted,#98a2b3);text-align:center';msg.textContent=hint||'暂无数据';root.appendChild(msg);return}var max=Math.max.apply(null,data.map(function(d){return d.v}).concat([1]));var compact=st.layoutMode==='compact';var show=st.showValue!==false;var prefix=String(st.valuePrefix||'');var labelVisible=st.labelShow!==false;data.forEach(function(d){var row=document.createElement('div');row.className='row'+(compact?' compact':'');if(labelVisible){var lbl=document.createElement('span');lbl.className='lbl';lbl.textContent=d.n;row.appendChild(lbl)}var bar=document.createElement('div');bar.className='bar';bar.style.width=(d.v/max*100)+'%';row.appendChild(bar);if(show){var val=document.createElement('span');val.className='val';val.textContent=prefix+d.v;row.appendChild(val)}root.appendChild(row)})}" +
  "boot(render)})();";

const D3_SCRIPT =
  "(function(){" +
  RUNTIME_HELPERS +
  LAYOUT_LISTENER +
  MOUNT_BOOT +
  "function dataFromPayload(p){var st=bindingStatusOf(p);if(st!=='bound'||!p||!p.rows||!p.rows.length)return null;var cols=p.columns||[];var di=cols.findIndex(function(c){return c!=='sum'&&c!=='count'});var mi=cols.findIndex(function(c,i){return i!==di});if(di<0)di=0;if(mi<0)mi=1;return p.rows.map(function(r){return{n:String(r[di]),v:Number(r[mi])||0}})}" +
  "function tickShowMap(p,dataLen){var show={};var ticks=p&&p.axisPlan&&p.axisPlan.categoryTickIndices;if(ticks&&ticks.length){ticks.forEach(function(i){show[i]=true});return show}var layout=(p&&p.layout)||{};var iw=Math.max((layout.width||320)-56,8);var vsCv=host&&host.vsCv;var thin=vsCv&&vsCv.helpers&&vsCv.helpers.thinCategoryTickIndices?vsCv.helpers.thinCategoryTickIndices(dataLen,iw,56):null;if(thin){thin.forEach(function(i){show[i]=true})}return show}" +
  "function render(p){p=p||readPayload();var vsCv=host&&host.vsCv;var d3=vsCv&&vsCv.d3;var svgEl=" +
  qHost("vs-cv-chart") +
  ";if(!svgEl||!d3)return;var hint=statusHint(p);var data=dataFromPayload(p);var svg=d3.select(svgEl);svg.selectAll('*').remove();if(hint||!data){svg.attr('width','100%').attr('height','100%');svg.append('text').attr('x','50%').attr('y','50%').attr('text-anchor','middle').attr('fill','var(--dashboard-text-muted,#98a2b3)').attr('font-size',12).text(hint||'暂无数据');return}var layout=(p&&p.layout)||{};var w=layout.width||svgEl.clientWidth||320,h=layout.height||svgEl.clientHeight||200,pad=28,iw=Math.max(w-pad*2,8),ih=Math.max(h-pad*2,8);svg.attr('width',w).attr('height',h).attr('viewBox','0 0 '+w+' '+h);var g=svg.append('g').attr('transform','translate('+pad+','+pad+')');var x=d3.scaleBand().domain(data.map(function(d){return d.n})).range([0,iw]).padding(0.2);var y=d3.scaleLinear().domain([0,d3.max(data,function(d){return d.v})||1]).nice().range([ih,0]);g.selectAll('rect').data(data).join('rect').attr('x',function(d){return x(d.n)}).attr('y',function(d){return y(d.v)}).attr('width',x.bandwidth()).attr('height',function(d){return ih-y(d.v)}).attr('fill','var(--vs-palette-0,var(--vs-d3-accent,#2563eb))').attr('rx',3);var show=tickShowMap(p,data.length);g.selectAll('text.lbl').data(data.map(function(d,i){return {d:d,i:i}}).filter(function(row){return !Object.keys(show).length||show[row.i]})).join('text').attr('class','lbl').attr('x',function(row){return (x(row.d.n)||0)+x.bandwidth()/2}).attr('y',ih+16).attr('text-anchor','middle').attr('fill','var(--vs-style-label-color,var(--dashboard-text-primary,#e2e8f0))').text(function(row){return row.d.n})}" +
  "boot(render)})();";

const PULSE_KPI = {
  manifest: {
    id: "pulse-kpi-ribbon-v1",
    displayName: "脉冲 KPI 指标带",
    version: "1.0.0",
    entry: "index.html",
    fieldSlots: {
      dimensions: { min: 1, max: 1, label: "指标名称" },
      metrics: { min: 1, max: 1, label: "指标数值" },
    },
    styleSchema: {
      type: "object",
      properties: {
        accentColor: { type: "string", format: "color" },
        glowIntensity: { type: "number", minimum: 0, maximum: 100 },
        cardGap: { type: "number", minimum: 4, maximum: 32 },
      },
    },
    defaultStyle: { accentColor: "#38bdf8", glowIntensity: 40, cardGap: 12 },
    rendererHint: "vanilla",
    runtime: "html",
  },
  files: {},
};

const pulseHtml =
  '<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;background:transparent;color:var(--dashboard-text-primary,#e2e8f0);font-family:system-ui,sans-serif}#vs-cv-kpi{display:flex;gap:var(--vs-style-card-gap,12px);padding:12px;height:100%;box-sizing:border-box;align-items:stretch}.card{flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:14px 10px;background:var(--dashboard-widget-surface,#1e293b);border:1px solid var(--dashboard-widget-border,#344054);border-radius:8px;min-width:0}.lbl{font-size:12px;color:var(--dashboard-text-muted,#98a2b3);margin-bottom:6px}.val{font-size:22px;font-weight:700}.hint{padding:12px;font-size:12px;color:var(--dashboard-text-muted,#98a2b3);text-align:center;width:100%}</style></head><body><div id="vs-cv-kpi"></div><script>' +
  "(function(){" +
  RUNTIME_HELPERS +
  LAYOUT_LISTENER +
  MOUNT_BOOT +
  "function cardsFromPayload(p){var st=bindingStatusOf(p);if(st!=='bound'||!p||!p.rows||!p.rows.length)return null;var cols=p.columns||[];var di=0;var mi=cols.length>1?1:0;return p.rows.map(function(r){return{n:String(r[di]),v:String(r[mi])}})}" +
  "function render(){var p=readPayload();var root=" +
    qHost("vs-cv-kpi") +
    ";if(!root)return;var hint=statusHint(p);var cards=cardsFromPayload(p);root.innerHTML='';if(hint||!cards){var msg=document.createElement('div');msg.className='hint';msg.textContent=hint||'暂无数据';root.appendChild(msg);return}cards.forEach(function(c){var el=document.createElement('div');el.className='card';var lbl=document.createElement('div');lbl.className='lbl';lbl.textContent=c.n;el.appendChild(lbl);var val=document.createElement('div');val.className='val';val.textContent=c.v;el.appendChild(val);root.appendChild(el)})}" +
  "attachPayloadListener(render)})();" +
  "</script></body></html>";

PULSE_KPI.files["index.html"] = normalizeExampleHostCss(pulseHtml);

function patchHtmlScript(html, newScript) {
  return html.replace(/<script>[\s\S]*<\/script>/, `<script>${newScript}</script>`);
}

/** 官方示例：透明底 + 优先消费看板配色 token */
function normalizeExampleHostCss(html) {
  return html
    .replace(
      /html,body\{margin:0;height:100%;background:[^;]+;color:[^}]+\}/,
      "html,body{margin:0;height:100%;background:transparent;color:var(--dashboard-text-primary,#e2e8f0);font-family:system-ui,sans-serif}",
    )
    .replace(
      /background:var\(--vs-style-accent-color,#2563eb\)/g,
      "background:var(--vs-palette-0,var(--vs-style-accent-color,#2563eb))",
    )
    .replace(
      /stroke':'var\(--vs-style-accent-color,#818cf8\)'/g,
      "stroke':'var(--vs-palette-0,var(--vs-style-accent-color,#818cf8))'",
    )
    .replace(
      /\.val\{font-size:22px;font-weight:700\}/,
      ".val{font-size:22px;font-weight:700;color:var(--vs-palette-0,var(--vs-style-accent-color,#38bdf8))}",
    );
}

function patchExampleHtml(html, newScript) {
  return normalizeExampleHostCss(patchHtmlScript(html, newScript));
}

function patchFile(relPath, mutator) {
  const full = path.join(examplesDir, relPath);
  const doc = JSON.parse(fs.readFileSync(full, "utf8"));
  mutator(doc);
  fs.writeFileSync(full, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  console.log("patched", relPath);
}

patchFile("custom-viz-bundle.json", (doc) => {
  doc.manifest.runtime = "html";
  doc.files["index.html"] = patchExampleHtml(doc.files["index.html"], BUNDLE_SCRIPT);
});

patchFile("custom-viz-d3-bundle.json", (doc) => {
  doc.manifest.runtime = "d3";
  doc.files["index.html"] = patchExampleHtml(doc.files["index.html"], D3_SCRIPT);
});

const RING_PROGRESS_SCRIPT =
  "(function(){" +
  RUNTIME_HELPERS +
  LAYOUT_LISTENER +
  MOUNT_BOOT +
  "var NS='http://www.w3.org/2000/svg';" +
  "function rowsFromPayload(p){var st=bindingStatusOf(p);if(st!=='bound'||!p||!p.rows||!p.rows.length)return null;var cols=p.columns||[];var di=cols.findIndex(function(c){return c!=='sum'&&c!=='count'});var mi=cols.findIndex(function(c,i){return i!==di});if(di<0)di=0;if(mi<0)mi=1;return p.rows.map(function(r){return{n:String(r[di]),v:Math.min(100,Math.max(0,Number(r[mi])||0))}})}" +
  "function ringSvg(pct,th){var size=72,r=(size-th)/2,c=2*Math.PI*r,off=c*(1-pct/100);var svg=document.createElementNS(NS,'svg');svg.setAttribute('width',String(size));svg.setAttribute('height',String(size));svg.setAttribute('viewBox','0 0 '+size+' '+size);var track=document.createElementNS(NS,'circle');track.setAttribute('cx',String(size/2));track.setAttribute('cy',String(size/2));track.setAttribute('r',String(r));track.setAttribute('fill','none');track.setAttribute('stroke','var(--vs-style-track-color,#334155)');track.setAttribute('stroke-width',String(th));svg.appendChild(track);var arc=document.createElementNS(NS,'circle');arc.setAttribute('cx',String(size/2));arc.setAttribute('cy',String(size/2));arc.setAttribute('r',String(r));arc.setAttribute('fill','none');arc.setAttribute('stroke','var(--vs-palette-0,var(--vs-style-accent-color,#818cf8))');arc.setAttribute('stroke-width',String(th));arc.setAttribute('stroke-linecap','round');arc.setAttribute('stroke-dasharray',String(c));arc.setAttribute('stroke-dashoffset',String(off));arc.setAttribute('transform','rotate(-90 '+size/2+' '+size/2+')');svg.appendChild(arc);if(pct>=0){var txt=document.createElementNS(NS,'text');txt.setAttribute('x',String(size/2));txt.setAttribute('y',String(size/2+4));txt.setAttribute('text-anchor','middle');txt.setAttribute('fill','var(--dashboard-text-primary,#e2e8f0)');txt.setAttribute('font-size','13');txt.setAttribute('font-weight','600');txt.textContent=Math.round(pct)+'%';svg.appendChild(txt)}return svg}" +
  "function render(){var root=" +
    qHost("vs-cv-rings") +
    ";if(!root)return;var p=readPayload();var hint=statusHint(p);var st=(p&&p.style)||{};var th=Number(st.ringThickness)||8;var show=st.showPercent!==false;var data=rowsFromPayload(p);root.innerHTML='';if(hint||!data){var msg=document.createElement('div');msg.style.cssText='padding:12px;font-size:12px;color:var(--dashboard-text-muted,#98a2b3);text-align:center;width:100%';msg.textContent=hint||'暂无数据';root.appendChild(msg);return}data.slice(0,8).forEach(function(d){var wrap=document.createElement('div');wrap.className='item';var svg=ringSvg(d.v,th);if(!show){var t=svg.querySelector('text');if(t)t.remove()}wrap.appendChild(svg);var lbl=document.createElement('div');lbl.className='lbl';lbl.textContent=d.n;wrap.appendChild(lbl);root.appendChild(wrap)})}" +
  "boot(render)})();";

const ALERT_FEED_SCRIPT =
  "(function(){" +
  RUNTIME_HELPERS +
  LAYOUT_LISTENER +
  MOUNT_BOOT +
  "function rowsFromPayload(p){var st=bindingStatusOf(p);if(st!=='bound'||!p||!p.rows||!p.rows.length)return null;var cols=p.columns||[];var di=cols.findIndex(function(c){return c!=='sum'&&c!=='count'});var mi=cols.findIndex(function(c,i){return i!==di});if(di<0)di=0;if(mi<0)mi=1;return p.rows.map(function(r){return{n:String(r[di]),v:Number(r[mi])||0}})}" +
  "function levelClass(v){if(v>=3)return'danger';if(v>=2)return'warn';return''}" +
  "function levelLabel(v){if(v>=3)return'严重';if(v>=2)return'警告';if(v>=1)return'提示';return'信息'}" +
  "function render(){var track=" +
    qHost("vs-cv-track") +
    ";if(!track)return;var p=readPayload();var hint=statusHint(p);var st=(p&&p.style)||{};var speed=Number(st.scrollSpeed)||48;track.style.setProperty('--vs-style-scroll-speed',speed+'s');track.innerHTML='';if(hint){var msg=document.createElement('div');msg.style.cssText='padding:12px;font-size:12px;color:var(--dashboard-text-muted,#98a2b3);text-align:center';msg.textContent=hint;track.style.animation='none';track.appendChild(msg);return}track.style.animation='';var data=rowsFromPayload(p);if(!data){var empty=document.createElement('div');empty.style.cssText='padding:12px;font-size:12px;color:var(--dashboard-text-muted,#98a2b3);text-align:center';empty.textContent='暂无数据';track.appendChild(empty);return}var maxVis=Number(st.maxVisible)||6;var slice=data.slice(0,maxVis*2);slice.concat(slice).forEach(function(d){var row=document.createElement('div');row.className='row '+levelClass(d.v);var badge=document.createElement('span');badge.className='badge';badge.textContent=levelLabel(d.v);row.appendChild(badge);var msg=document.createElement('span');msg.className='msg';msg.textContent=d.n;row.appendChild(msg);track.appendChild(row)})}" +
  "boot(render)})();";

patchFile("custom-viz-ring-progress.json", (doc) => {
  doc.manifest.runtime = "html";
  doc.files["index.html"] = patchExampleHtml(doc.files["index.html"], RING_PROGRESS_SCRIPT);
});

patchFile("custom-viz-alert-feed.json", (doc) => {
  doc.manifest.runtime = "html";
  doc.files["index.html"] = patchExampleHtml(doc.files["index.html"], ALERT_FEED_SCRIPT);
});

fs.writeFileSync(
  path.join(examplesDir, "custom-viz-pulse-kpi.json"),
  `${JSON.stringify(PULSE_KPI, null, 2)}\n`,
  "utf8",
);
console.log("wrote custom-viz-pulse-kpi.json");
