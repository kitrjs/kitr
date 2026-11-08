/**
 * The overlay's stylesheet. It is injected inside a shadow root, so the variables live on `:host`
 * and the root element, and the theme is picked by `data-theme` on that root element.
 * Contributed panels can use every `kitr-dt-*` class and the `--dt-*` variables.
 */
export const styles: string = `
:host,.kitr-dt{--dt-bg:#fcfcfd;--dt-surface:#f4f4f6;--dt-surface-2:#e9e9ed;--dt-border:#dcdce1;--dt-fg:#18181b;--dt-muted:#5f5f69;--dt-accent:#2368ee;--dt-accent-fg:#fff;--dt-ok:#12703a;--dt-warn:#8a5200;--dt-error:#c42323;--dt-info:#1f5fd0;--dt-string:#16703c;--dt-number:#9a4a00;--dt-boolean:#8a2fb0;--dt-null:#5f5f69;--dt-key:#1f5fd0;--dt-font-ui:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;--dt-font-mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;--dt-radius:8px;--dt-size:12px;--dt-hit:28px;--dt-shadow:0 8px 30px rgba(0,0,0,.18);--f:linear-gradient(90deg,#000 calc(100% - 20px),transparent)}
[data-theme="dark"]{--dt-bg:#0f0f10;--dt-surface:#18181a;--dt-surface-2:#232326;--dt-border:#2c2c30;--dt-fg:#ededf0;--dt-muted:#9b9ba5;--dt-accent:#6e9bff;--dt-accent-fg:#0b0b0c;--dt-ok:#4cc57d;--dt-warn:#e8ac45;--dt-error:#ff7070;--dt-info:#7aa6ff;--dt-string:#6fd49a;--dt-number:#e8ac45;--dt-boolean:#d79bf2;--dt-null:#9b9ba5;--dt-key:#8db4ff;--dt-shadow:0 8px 30px rgba(0,0,0,.6)}
@media (max-width:640px),(pointer:coarse) and (max-height:500px){:host,.kitr-dt{--dt-size:13px}}
@media (pointer:coarse){:host,.kitr-dt{--dt-hit:44px}}
.kitr-dt{font:var(--dt-size)/1.45 var(--dt-font-ui);color:var(--dt-fg);color-scheme:light;-webkit-text-size-adjust:100%}
.kitr-dt[data-theme="dark"]{color-scheme:dark}
.kitr-dt *{box-sizing:border-box}
.kitr-dt button,.kitr-dt input,.kitr-dt summary{-webkit-tap-highlight-color:transparent}
.kitr-dt :focus-visible{outline:2px solid var(--dt-accent);outline-offset:1px}
.kitr-dt-trigger{position:fixed;z-index:2147483000;width:36px;height:36px;border-radius:999px;border:1px solid var(--dt-border);background:var(--dt-bg);color:var(--dt-accent);cursor:pointer;box-shadow:var(--dt-shadow);display:flex;align-items:center;justify-content:center;padding:0;touch-action:none;margin:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}
.kitr-dt-trigger:hover{background:var(--dt-surface)}
@media (pointer:coarse){.kitr-dt-trigger{width:44px;height:44px}}
.kitr-dt-trigger-badge{position:absolute;top:-4px;right:-4px;background:var(--dt-error);color:var(--dt-bg);border-radius:999px;font:700 10px/1 var(--dt-font-ui);min-width:16px;height:16px;padding:0 4px;display:flex;align-items:center;justify-content:center}
.kitr-dt-panel,.kitr-dt-sheet{position:fixed;z-index:2147483000;background:var(--dt-bg);color:var(--dt-fg);display:flex;flex-direction:column;box-shadow:var(--dt-shadow);overflow:hidden;min-height:0}
.kitr-dt-panel{left:0;right:0;bottom:0;height:var(--kitr-dt-height,45vh);border-top:1px solid var(--dt-border)}
.kitr-dt-panel[data-dock="right"]{left:auto;top:0;width:var(--kitr-dt-width,420px);height:auto;border-top:0;border-left:1px solid var(--dt-border)}
.kitr-dt-sheet{left:0;right:0;bottom:0;height:var(--kitr-dt-height,50dvh);border:1px solid var(--dt-border);border-bottom:0;border-radius:16px 16px 0 0;padding-bottom:env(safe-area-inset-bottom);transition:height .2s ease}
.kitr-dt-handle{flex:none;height:22px;display:flex;align-items:center;justify-content:center;touch-action:none;cursor:grab}.kitr-dt-handle::before{content:'';width:36px;height:5px;border-radius:99px;background:var(--dt-border)}
.kitr-dt-resize{position:absolute;z-index:1;background:transparent;touch-action:none}
.kitr-dt-resize:hover,.kitr-dt-resize:active{background:var(--dt-accent)}
.kitr-dt-resize-y{left:0;right:0;top:-2px;height:5px;cursor:ns-resize}
.kitr-dt-resize-x{top:0;bottom:0;left:-2px;width:5px;cursor:ew-resize}
.kitr-dt-header{display:flex;align-items:center;gap:4px;padding:4px 8px;border-bottom:1px solid var(--dt-border);background:var(--dt-bg);flex:none}
.kitr-dt-tabs{display:flex;align-items:center;gap:2px;flex:1;min-width:0;overflow-x:auto;touch-action:pan-x;scrollbar-width:none;-webkit-mask-image:var(--f);mask-image:var(--f)}
.kitr-dt-tabs::-webkit-scrollbar,.kitr-dt-chips::-webkit-scrollbar{display:none}
.kitr-dt-tab{background:transparent;border:0;color:var(--dt-muted);padding:0 10px;min-height:var(--dt-hit);border-radius:var(--dt-radius);cursor:pointer;font:inherit;white-space:nowrap;display:flex;gap:6px;align-items:center;flex:none}
.kitr-dt-tab:hover{color:var(--dt-fg);background:var(--dt-surface)}
.kitr-dt-tab-active{color:var(--dt-fg);background:var(--dt-surface-2);font-weight:600}
.kitr-dt-spacer{flex:1}
.kitr-dt-body{flex:1;min-height:0;overflow:auto;padding:10px 12px;overscroll-behavior:contain}
.kitr-dt-stack{display:flex;flex-direction:column;gap:14px}
.kitr-dt-h{margin:0 0 6px;font-size:.92em;font-weight:600;color:var(--dt-muted);text-transform:uppercase;letter-spacing:.05em}
.kitr-dt-muted{color:var(--dt-muted)}
.kitr-dt-table{border-collapse:collapse;width:100%}
.kitr-dt-table td{padding:3px 8px 3px 0;vertical-align:top;border-bottom:1px solid var(--dt-border)}
.kitr-dt-key{color:var(--dt-key);white-space:nowrap;font-family:var(--dt-font-mono)}
.kitr-dt-table td.kitr-dt-key{width:1%;padding-right:16px}
.kitr-dt-string,.kitr-dt-number,.kitr-dt-boolean,.kitr-dt-undefined,.kitr-dt-object,.kitr-dt-error,.kitr-dt-pre,.kitr-dt-time,.kitr-dt-data,.kitr-dt-preview{font-family:var(--dt-font-mono)}
.kitr-dt-string{color:var(--dt-string)}.kitr-dt-number{color:var(--dt-number)}.kitr-dt-boolean{color:var(--dt-boolean)}.kitr-dt-undefined,.kitr-dt-object{color:var(--dt-null)}.kitr-dt-error{color:var(--dt-error)}
.kitr-dt-toggle{background:none;border:0;color:var(--dt-muted);cursor:pointer;font:inherit;padding:0;display:inline-flex;align-items:center;gap:2px}
@media (pointer:coarse){.kitr-dt-toggle{padding:10px 8px;margin:-10px -8px;min-height:36px}}
.kitr-dt-indent{padding-left:14px;border-left:1px solid var(--dt-border);margin-left:5px}
.kitr-dt-pre{margin:0;white-space:pre-wrap;word-break:break-all;max-height:160px;overflow:auto;color:var(--dt-fg)}
.kitr-dt-btn{background:var(--dt-surface);border:1px solid var(--dt-border);color:var(--dt-fg);border-radius:6px;padding:0 10px;min-height:var(--dt-hit);cursor:pointer;font:inherit;display:inline-flex;align-items:center;justify-content:center;gap:6px}
.kitr-dt-btn:hover:not(:disabled){background:var(--dt-surface-2)}
.kitr-dt-btn:disabled{opacity:.5;cursor:not-allowed}
.kitr-dt-btn-danger{color:var(--dt-error);border-color:currentColor;background:transparent}
.kitr-dt-btn-icon{width:var(--dt-hit);padding:0}
.kitr-dt-toolbar{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:8px}
.kitr-dt-input{background:var(--dt-surface);border:1px solid var(--dt-border);color:var(--dt-fg);border-radius:6px;padding:0 10px;min-height:var(--dt-hit);font:inherit;min-width:160px}
.kitr-dt-input::placeholder{color:var(--dt-muted)}
.kitr-dt-badge,.kitr-dt-chip,.kitr-dt-stat{--t:var(--dt-muted)}
.kitr-dt-badge-ok,.kitr-dt-chip-ok,.kitr-dt-stat-ok{--t:var(--dt-ok)}.kitr-dt-badge-warn,.kitr-dt-chip-warn,.kitr-dt-stat-warn{--t:var(--dt-warn)}.kitr-dt-badge-error,.kitr-dt-chip-error,.kitr-dt-stat-error{--t:var(--dt-error)}.kitr-dt-badge-info,.kitr-dt-chip-info,.kitr-dt-stat-info{--t:var(--dt-info)}
.kitr-dt-badge{display:inline-block;border-radius:999px;padding:0 7px;font-size:.85em;line-height:18px;background:color-mix(in srgb,var(--t) 14%,transparent);color:var(--t);font-weight:600;white-space:nowrap}
.kitr-dt-chips{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:2px 0;margin-bottom:8px;-webkit-mask-image:var(--f);mask-image:var(--f)}
.kitr-dt-chip{flex:none;display:inline-flex;align-items:center;gap:5px;min-height:24px;padding:0 10px;border-radius:999px;border:1px solid var(--dt-border);background:transparent;color:var(--t);font:inherit;cursor:pointer;white-space:nowrap}
.kitr-dt-chip:hover{background:var(--dt-surface)}
.kitr-dt-chip-on{background:color-mix(in srgb,var(--t) 14%,transparent);border-color:var(--t);font-weight:600}
.kitr-dt-chip:not(.kitr-dt-chip-ok):not(.kitr-dt-chip-warn):not(.kitr-dt-chip-error):not(.kitr-dt-chip-info){color:var(--dt-fg)}
.kitr-dt-chip-count{color:var(--dt-muted);font-variant-numeric:tabular-nums}
.kitr-dt-stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px}
.kitr-dt-stat{background:var(--dt-surface);border:1px solid var(--dt-border);border-radius:var(--dt-radius);padding:8px 10px;display:flex;flex-direction:column;gap:2px;min-width:0}
.kitr-dt-stat>span:first-child{color:var(--dt-muted);font-size:.9em}
.kitr-dt-stat>span:last-child{font-size:1.5em;font-weight:600;line-height:1.2;font-variant-numeric:tabular-nums;overflow:hidden;text-overflow:ellipsis}
.kitr-dt-stat-ok>span:last-child,.kitr-dt-stat-warn>span:last-child,.kitr-dt-stat-error>span:last-child,.kitr-dt-stat-info>span:last-child{color:var(--t)}
.kitr-dt-section{border:1px solid var(--dt-border);border-radius:var(--dt-radius);background:var(--dt-surface)}
.kitr-dt-section>summary{cursor:pointer;list-style:none;padding:0 10px;min-height:var(--dt-hit);display:flex;align-items:center;gap:6px;font-weight:600}
.kitr-dt-section>summary::-webkit-details-marker{display:none}
.kitr-dt-section>summary::before{content:"";border:4px solid transparent;border-left-color:var(--dt-muted);margin-right:2px;transition:transform .15s}
.kitr-dt-section[open]>summary::before{transform:rotate(90deg)}
.kitr-dt-section>div{padding:4px 10px 10px}
.kitr-dt-empty{color:var(--dt-muted);padding:16px 4px;text-align:center}
.kitr-dt-empty code{font-family:var(--dt-font-mono);background:var(--dt-surface-2);color:var(--dt-fg);border-radius:4px;padding:1px 5px}
.kitr-dt-log{display:flex;flex-direction:column}
.kitr-dt-row{border-bottom:1px solid var(--dt-border)}
.kitr-dt-row-line{display:flex;align-items:center;gap:8px;min-width:0}
.kitr-dt-row-line>.kitr-dt-row-head{flex:1}
.kitr-dt-row-head{display:flex;align-items:center;gap:8px;min-height:var(--dt-hit);width:100%;background:none;border:0;color:inherit;font:inherit;text-align:left;cursor:pointer;padding:2px 0;min-width:0}
.kitr-dt-row-head:hover{background:var(--dt-surface)}
.kitr-dt-row-body{padding:2px 0 8px 12px;overflow-x:auto}
.kitr-dt-time{color:var(--dt-muted);flex:none;font-variant-numeric:tabular-nums}
.kitr-dt-channel{flex:none;border:1px solid var(--dt-border);background:var(--dt-surface);color:var(--dt-fg);border-radius:999px;padding:0 8px;font:inherit;font-size:.9em;line-height:18px}
button.kitr-dt-channel{cursor:pointer}
button.kitr-dt-channel:hover{background:var(--dt-surface-2)}
.kitr-dt-label{flex:none;max-width:50%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kitr-dt-data{min-width:0}
.kitr-dt-preview{color:var(--dt-muted);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kitr-dt-count{color:var(--dt-muted);font-variant-numeric:tabular-nums;flex:none}
.kitr-dt-mark{display:flex;align-items:center;gap:8px;color:var(--dt-muted);font-size:.9em;padding:6px 0}
.kitr-dt-mark::before,.kitr-dt-mark::after{content:"";flex:1;height:1px;background:var(--dt-border)}
.kitr-dt-level-warn .kitr-dt-label{color:var(--dt-warn)}.kitr-dt-level-error .kitr-dt-label{color:var(--dt-error)}.kitr-dt-level-debug .kitr-dt-label{color:var(--dt-muted)}
.kitr-dt-palette{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:flex-start;justify-content:center;padding:12vh 8px 0;z-index:2147483001}
.kitr-dt-palette-box{width:min(560px,100%);max-height:70dvh;display:flex;flex-direction:column;background:var(--dt-bg);border:1px solid var(--dt-border);border-radius:12px;overflow:hidden;color:var(--dt-fg);box-shadow:var(--dt-shadow)}
.kitr-dt-palette-box input{width:100%;background:transparent;border:0;border-bottom:1px solid var(--dt-border);color:var(--dt-fg);padding:12px;font:inherit;font-size:max(16px,1em);outline:none}
.kitr-dt-palette-section{padding:8px 12px 2px;color:var(--dt-muted);font-size:.85em;text-transform:uppercase;letter-spacing:.05em}
.kitr-dt-palette-item{padding:0 12px;min-height:var(--dt-hit);cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px}
.kitr-dt-palette-item:hover,.kitr-dt-palette-item-active{background:var(--dt-surface-2)}
.kitr-dt-kbd{font:.85em var(--dt-font-mono);border:1px solid var(--dt-border);border-bottom-width:2px;border-radius:4px;padding:0 5px;color:var(--dt-muted);background:var(--dt-surface)}
.kitr-dt-menu{position:absolute;z-index:2147483002;min-width:180px;background:var(--dt-bg);border:1px solid var(--dt-border);border-radius:var(--dt-radius);box-shadow:var(--dt-shadow);padding:4px}
.kitr-dt-menu-item{display:flex;align-items:center;gap:8px;width:100%;min-height:var(--dt-hit);padding:0 10px;background:none;border:0;border-radius:6px;color:var(--dt-fg);font:inherit;text-align:left;cursor:pointer}
.kitr-dt-menu-item:hover{background:var(--dt-surface-2)}
.kitr-dt-masked{display:inline-flex;align-items:center;gap:6px;font-family:var(--dt-font-mono)}
@media (prefers-reduced-motion:reduce){.kitr-dt *{transition:none!important;animation:none!important}}

.kitr-dt-sticky{position:sticky;top:0;z-index:1;background:var(--dt-bg);margin:0 -12px;padding:0 12px 4px}
.kitr-dt-sep{width:1px;height:16px;background:var(--dt-border);flex:none;margin:0 4px}
.kitr-dt-letter{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border-radius:4px;background:var(--dt-surface-2);color:var(--dt-muted);font:600 9px/1 var(--dt-font-ui);flex:none}
@media (max-width:640px),(pointer:coarse) and (max-height:500px){
.kitr-dt-ms{display:none}
.kitr-dt-row-line{flex-wrap:wrap}
.kitr-dt-row-line>.kitr-dt-row-head{flex-basis:100%;padding-left:0}
.kitr-dt-label{white-space:normal;word-break:break-word}
.kitr-dt-header .kitr-dt-btn-icon{width:36px}
.kitr-dt-tab{padding:0 8px}
.kitr-dt-tab:not(.kitr-dt-tab-active) .kitr-dt-tab-label{display:none}
}
`
