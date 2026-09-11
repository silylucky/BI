import { Activity, BarChart3, Database, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

export const LOGIN_PAGE_COPYRIGHT = "© VitalSpan · 北京智能语义软件有限公司";

const FEATURES = [
  { icon: BarChart3, label: "自研可视化" },
  { icon: Database, label: "多源接入" },
  { icon: MapPin, label: "离线地图" },
] as const;

function LoginBrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)} aria-label="VitalSpan">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-lg shadow-brand-600/25 ring-1 ring-white/20">
        <Activity className="size-5" strokeWidth={2.25} aria-hidden />
      </span>
      <span className="text-lg font-semibold tracking-tight text-white">VitalSpan</span>
    </span>
  );
}

function BrandPreviewCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "login-brand-preview pointer-events-none w-full max-w-[19rem] shrink-0 self-center",
        className,
      )}
      aria-hidden
    >
      <div className="login-brand-preview-enter relative rounded-2xl border border-white/15 bg-white/[0.07] p-4 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.45)] backdrop-blur-xl ring-1 ring-inset ring-white/10">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-white/45">
            运营看板
          </span>
          <span className="flex gap-1">
            <span className="size-1.5 rounded-full bg-emerald-400/90" />
            <span className="size-1.5 rounded-full bg-white/25" />
            <span className="size-1.5 rounded-full bg-white/25" />
          </span>
        </div>
        <div className="mb-4 grid grid-cols-3 gap-2">
          {["12.4k", "98.2%", "↑18%"].map((val, i) => (
            <div
              key={val}
              className="rounded-lg bg-white/[0.06] px-2 py-2 ring-1 ring-inset ring-white/8"
              style={{ animationDelay: `${120 + i * 80}ms` }}
            >
              <p className="text-[9px] text-white/40">{["访问量", "转化", "同比"][i]}</p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-white/95">{val}</p>
            </div>
          ))}
        </div>
        <div className="relative flex h-24 items-end gap-1.5 rounded-lg bg-white/[0.04] px-3 pb-2 pt-3 ring-1 ring-inset ring-white/6">
          {[38, 52, 44, 68, 58, 76, 62, 84].map((h, i) => (
            <span
              key={i}
              className="login-brand-bar flex-1 rounded-sm bg-gradient-to-t from-brand-600/80 to-brand-300/90"
              style={{ height: `${h}%`, animationDelay: `${200 + i * 50}ms` }}
            />
          ))}
          <svg
            className="login-brand-line pointer-events-none absolute bottom-2 left-3 right-3 h-10 text-cyan-300/70"
            viewBox="0 0 200 40"
            fill="none"
            preserveAspectRatio="none"
          >
            <path
              d="M0 32 C30 28 40 8 70 18 S120 38 150 12 S190 6 200 16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

export function LoginBrandAside({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        "login-brand-aside relative hidden min-h-screen flex-1 flex-col overflow-hidden lg:flex",
        className,
      )}
      aria-hidden
    >
      <div className="absolute inset-0 bg-[#0b1020]" />
      <div className="absolute inset-0 bg-gradient-to-br from-[#121a35] via-[#0f1630] to-[#0a0e1a]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_20%_0%,rgba(70,95,255,0.28),transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_90%_100%,rgba(56,189,248,0.12),transparent_50%)]" />
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: "radial-gradient(rgb(255 255 255 / 0.12) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />
      <div className="pointer-events-none absolute -left-32 top-1/4 size-[28rem] rounded-full bg-brand-500/20 blur-[100px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 size-[24rem] rounded-full bg-cyan-400/10 blur-[80px]" />

      <header className="relative z-10 shrink-0 px-10 pt-8 xl:px-14 xl:pt-10">
        <LoginBrandMark />
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 items-center px-10 py-10 xl:px-14">
        <div className="login-brand-fade grid w-full max-w-4xl grid-cols-1 items-center gap-10 xl:grid-cols-[minmax(0,1fr)_auto] xl:gap-12">
          <div className="max-w-md space-y-6">
            <div className="space-y-3">
              <p className="text-sm font-medium tracking-wide text-brand-200/90">
                政企可视化分析平台
              </p>
              <h1 className="text-[1.75rem] font-semibold leading-snug tracking-tight text-white xl:text-[2.125rem]">
                从数据接入到看板发布
              </h1>
              <p className="text-[15px] leading-relaxed text-white/55">
                自研 BI 引擎，零第三方运行时依赖；面向行业与政企 IT 团队的全链路可控分析体验。
              </p>
            </div>

            <ul className="flex flex-wrap gap-2">
              {FEATURES.map(({ icon: Icon, label }, i) => (
                <li
                  key={label}
                  className="login-brand-chip inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur-sm"
                  style={{ animationDelay: `${80 + i * 60}ms` }}
                >
                  <Icon className="size-3.5 shrink-0 text-brand-300" aria-hidden />
                  {label}
                </li>
              ))}
            </ul>
          </div>

          <BrandPreviewCard className="hidden xl:block" />
        </div>
      </div>

      <footer className="relative z-10 shrink-0 px-10 pb-8 xl:px-14">
        <p className="text-[11px] text-white/30">{LOGIN_PAGE_COPYRIGHT}</p>
      </footer>
    </aside>
  );
}

/** 移动端右侧表单顶栏品牌标（左上角） */
export function LoginMobileBrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)} aria-label="VitalSpan">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white shadow-theme-xs">
          <Activity className="size-5" strokeWidth={2.25} aria-hidden />
        </span>
        <span className="text-base font-semibold text-gray-900 dark:text-white">VitalSpan</span>
    </span>
  );
}
