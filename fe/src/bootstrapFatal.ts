import { dismissBootSplash } from "./bootSplash";

function isDarkDocument(): boolean {
  return document.documentElement.classList.contains("dark");
}

export function showBootstrapFatal(root: HTMLElement, message: string): void {
  dismissBootSplash();
  root.replaceChildren();

  const dark = isDarkDocument();
  const shell = document.createElement("div");
  shell.setAttribute("role", "alert");
  shell.style.cssText = [
    "display:flex",
    "min-height:100vh",
    "align-items:center",
    "justify-content:center",
    "padding:24px",
    "font-family:Outfit,system-ui,sans-serif",
    `background:${dark ? "#101828" : "#f9fafb"}`,
    `color:${dark ? "#e4e7ec" : "#344054"}`,
  ].join(";");

  const card = document.createElement("div");
  card.style.cssText = "max-width:420px;text-align:center;";

  const title = document.createElement("p");
  title.textContent = "应用加载失败";
  title.style.cssText = `font-weight:600;margin:0 0 8px;color:${dark ? "#f9fafb" : "#101828"};`;

  const detail = document.createElement("p");
  detail.textContent = message;
  detail.style.cssText = `font-size:14px;margin:0 0 16px;color:${dark ? "#98a2b3" : "#667085"};`;

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "刷新页面";
  button.style.cssText = [
    "padding:8px 16px",
    "border-radius:8px",
    "cursor:pointer",
    `border:1px solid ${dark ? "#344054" : "#d0d5dd"}`,
    `background:${dark ? "#1a2231" : "#fff"}`,
    `color:${dark ? "#e4e7ec" : "#344054"}`,
  ].join(";");
  button.addEventListener("click", () => {
    window.location.reload();
  });

  card.append(title, detail, button);
  shell.append(card);
  root.append(shell);
}
