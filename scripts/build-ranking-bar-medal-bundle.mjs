import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "docs/api/vs-ai-spec/examples/custom-viz-ranking-bar-medal.json");

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;background:transparent;color:var(--dashboard-text-primary,#e2e8f0);font-family:system-ui,sans-serif}#vs-cv-root{padding:12px;box-sizing:border-box;height:100%;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-start}.row{display:flex;align-items:center;gap:12px;margin-bottom:var(--vs-style-gap,12px);flex-shrink:0}.row:last-child{margin-bottom:0}.badge{width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:calc(var(--vs-style-font-size,14)*1px);flex-shrink:0}.badge.circle{border-radius:50%}.badge.square{border-radius:6px}.badge.medal{border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.15)}.badge.rank-1{background:linear-gradient(135deg,#ffd700,#ffed4e);color:#b8860b}.badge.rank-2{background:linear-gradient(135deg,#c0c0c0,#e8e8e8);color:#696969}.badge.rank-3{background:linear-gradient(135deg,#cd7f32,#daa520);color:#8b4513}.badge.rank-other{background:var(--dashboard-widget-surface,#334155);color:var(--dashboard-text-muted,#98a2b3)}.body{flex:1;display:flex;align-items:center;gap:12px;min-width:0}.lbl{font-size:calc(var(--vs-style-font-size,14)*1px);color:var(--vs-style-label-color,var(--dashboard-text-primary,#e2e8f0));max-width:var(--vs-style-label-max-width,120px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0}.track{flex:1;height:var(--vs-style-bar-height,28px);background:var(--dashboard-widget-surface,#334155);border-radius:999px;overflow:hidden}.fill{height:100%;background:var(--vs-palette-0,var(--vs-style-accent-color,#3b82f6));border-radius:999px;transition:width .6s ease}.val{font-size:calc(var(--vs-style-font-size,14)*1px);color:var(--dashboard-text-muted,#98a2b3);min-width:3rem;text-align:right;flex-shrink:0}.hint{padding:12px;font-size:12px;color:var(--dashboard-text-muted,#98a2b3);text-align:center;flex:1;display:flex;align-items:center;justify-content:center}</style></head><body><div id="vs-cv-root"></div><script>(function(){var host=document.currentScript&&document.currentScript.parentElement;function readPayload(){if(host&&host.vsCv&&host.vsCv.getPayload)return host.vsCv.getPayload();var n=(host||document).querySelector('.vs-cv-payload');if(!n||!n.textContent)return null;try{return JSON.parse(n.textContent)}catch(e){return null}}function bindingStatusOf(p){if(!p)return 'unbound';return p.bindingStatus||((p.rows&&p.rows.length)?'bound':'unbound')}function statusHint(p){var st=bindingStatusOf(p);if(st==='error')return(p&&p.error)||'数据加载失败';if(st==='empty')return'暂无数据';if(st==='unbound')return'请在右侧绑定数据集与字段';return null}function boot(render){if(host&&host.vsCv&&host.vsCv.mount){host.vsCv.mount(function(p){render(p)});return}render(readPayload());if(host&&host.vsCv&&host.vsCv.onPayload){host.vsCv.onPayload(function(p){render(p)})}}function rowsFromPayload(p){if(bindingStatusOf(p)!=='bound'||!p||!p.rows||!p.rows.length)return null;var cols=p.columns||[];var di=cols.findIndex(function(c){return c!=='sum'&&c!=='count'});var mi=cols.findIndex(function(c,i){return i!==di});if(di<0)di=0;if(mi<0)mi=1;return p.rows.map(function(r){return{n:String(r[di]),v:Number(r[mi])||0}})}function formatValue(v,fmt){var n=Number(v)||0;switch(fmt){case 'thousands':return n>=1000?(n/1000).toFixed(1)+'k':String(n);case 'percent':return(n*100).toFixed(1)+'%';case 'decimal1':return n.toFixed(1);case 'decimal2':return n.toFixed(2);default:return n.toLocaleString()}}function render(p){p=p||readPayload();var st=(p&&p.style)||{};var root=(host||document).querySelector('#vs-cv-root');if(!root)return;var hint=statusHint(p);var data=rowsFromPayload(p);root.innerHTML='';if(hint||!data){var msg=document.createElement('div');msg.className='hint';msg.textContent=hint||'暂无数据';root.appendChild(msg);return}var gap=Math.max(4,Math.min(24,Number(st.gap)||12));var fontSize=Math.max(10,Math.min(24,Number(st.fontSize)||14));var barHeight=Math.max(16,Math.min(48,Number(st.barHeight)||28));var showValue=st.showValue!==false;var showBadge=st.showRankBadge!==false;var badgeStyle=st.rankBadgeStyle||'medal';var fmt=st.valueFormatter||'raw';var animate=st.showAnimation!==false;var layoutH=(p.layout&&p.layout.height)||240;var layoutW=(p.layout&&p.layout.width)||320;var rowUnit=Math.max(barHeight,32)+gap;var fitByHeight=Math.max(3,Math.floor((layoutH-24)/rowUnit));var cap=Math.max(3,Math.min(20,Number(st.maxItems)||10));var maxItems=Math.min(cap,fitByHeight);var labelMax=Math.max(48,Math.min(160,Math.floor(layoutW*0.22)));if(st.accentColor)root.style.setProperty('--vs-style-accent-color',String(st.accentColor));root.style.setProperty('--vs-style-gap',gap+'px');root.style.setProperty('--vs-style-font-size',String(fontSize));root.style.setProperty('--vs-style-bar-height',barHeight+'px');root.style.setProperty('--vs-style-label-max-width',labelMax+'px');data.sort(function(a,b){return b.v-a.v});data=data.slice(0,maxItems);var max=Math.max.apply(null,data.map(function(d){return d.v}).concat([1]));data.forEach(function(d,i){var row=document.createElement('div');row.className='row';if(animate)row.style.opacity='0';var rank=i+1;if(showBadge){var badge=document.createElement('div');badge.className='badge '+badgeStyle+' rank-'+(rank<=3?String(rank):'other');badge.textContent=String(rank);row.appendChild(badge)}var body=document.createElement('div');body.className='body';var lbl=document.createElement('div');lbl.className='lbl';lbl.title=d.n;lbl.textContent=d.n;body.appendChild(lbl);var track=document.createElement('div');track.className='track';var fill=document.createElement('div');fill.className='fill';fill.style.width=animate?'0%':((d.v/max*100)+'%');track.appendChild(fill);body.appendChild(track);if(showValue){var val=document.createElement('div');val.className='val';val.textContent=formatValue(d.v,fmt);body.appendChild(val)}row.appendChild(body);root.appendChild(row);if(animate){setTimeout(function(){row.style.opacity='1';fill.style.width=(d.v/max*100)+'%'},80+i*60)}})}boot(render)})();</script></body></html>`;

const bundle = {
  manifest: {
    id: "ranking-bar-medal-v1",
    displayName: "排名条(带序号)-降序",
    version: "1.0.0",
    entry: "index.html",
    runtime: "html",
    rendererHint: "vanilla",
    fieldSlots: {
      dimensions: { min: 1, max: 1, label: "类别" },
      metrics: { min: 1, max: 1, label: "数值" },
    },
    styleSchema: {
      type: "object",
      "x-styleSections": [
        { title: "条形外观", properties: ["accentColor", "barHeight", "gap", "fontSize"] },
        {
          title: "排名与数值",
          properties: ["showRankBadge", "rankBadgeStyle", "showValue", "valueFormatter", "maxItems", "showAnimation"],
        },
      ],
      properties: {
        accentColor: { type: "string", format: "color", title: "条形主题色" },
        barHeight: { type: "number", minimum: 16, maximum: 48, title: "条形高度" },
        gap: { type: "number", minimum: 4, maximum: 24, title: "条形间距" },
        fontSize: { type: "number", minimum: 10, maximum: 24, title: "字体大小" },
        showValue: { type: "boolean", title: "显示数值" },
        showRankBadge: { type: "boolean", title: "显示排名徽章" },
        rankBadgeStyle: {
          type: "string",
          enum: ["circle", "square", "medal"],
          enumNames: ["圆形", "方形", "奖牌"],
          title: "徽章样式",
        },
        valueFormatter: {
          type: "string",
          enum: ["raw", "thousands", "percent", "decimal1", "decimal2"],
          enumNames: ["原始值", "千分位", "百分比", "1位小数", "2位小数"],
          title: "数值格式",
        },
        maxItems: { type: "number", minimum: 3, maximum: 20, title: "最大显示条数" },
        showAnimation: { type: "boolean", title: "入场动画" },
      },
    },
    defaultStyle: {
      accentColor: "#3b82f6",
      barHeight: 28,
      gap: 12,
      fontSize: 14,
      showValue: true,
      showRankBadge: true,
      rankBadgeStyle: "medal",
      valueFormatter: "raw",
      maxItems: 10,
      showAnimation: true,
    },
  },
  files: { "index.html": html },
};

writeFileSync(out, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
console.log(`wrote ${out}`);
