import { ERROR_CODES } from "../protocol/index.js";

export function createEvaluationErrorPanel(error: Error): HTMLDivElement {
  const copy = getEvaluationErrorCopy(error);
  const panel = document.createElement("div");
  const title = document.createElement("h2");
  const message = document.createElement("p");

  panel.setAttribute("role", "alert");
  panel.setAttribute("aria-live", "assertive");
  panel.dataset.rasterexEvaluationError = "true";
  panel.style.cssText = [
    "position:absolute",
    "inset:0",
    "z-index:1",
    "display:flex",
    "flex-direction:column",
    "align-items:center",
    "justify-content:center",
    "box-sizing:border-box",
    "padding:24px",
    "background:#fff",
    "color:#1f2937",
    "font-family:system-ui,sans-serif",
    "text-align:center"
  ].join(";");
  title.textContent = copy.title;
  title.style.cssText = "margin:0 0 12px;font-size:20px;font-weight:600";
  message.textContent = copy.message;
  message.style.cssText = "max-width:480px;margin:0;font-size:14px;line-height:1.5";
  panel.append(title, message);

  return panel;
}

export function showEvaluationErrorPanel(
  iframe: HTMLIFrameElement | null,
  error: Error
): void {
  const container = iframe?.parentElement;

  if (
    !container ||
    container.querySelector("[data-rasterex-evaluation-error='true']")
  ) {
    return;
  }

  if (window.getComputedStyle(container).position === "static") {
    container.style.position = "relative";
  }

  container.appendChild(createEvaluationErrorPanel(error));
}

function getEvaluationErrorCopy(error: Error): { title: string; message: string } {
  const code = "code" in error ? error.code : undefined;

  if (code === ERROR_CODES.evaluationExpired) {
    return {
      title: "Your Rasterex Viewer evaluation has expired",
      message: "Contact Rasterex to continue using Rasterex Viewer."
    };
  }

  if (code === ERROR_CODES.invalidToken) {
    return {
      title: "Your Rasterex Viewer evaluation is invalid",
      message: "Contact Rasterex for assistance with this evaluation."
    };
  }

  if (code === ERROR_CODES.evaluationRegistrationRequired) {
    return {
      title: "Registration details required",
      message: "Provide a company name and email address to start a Rasterex Viewer evaluation."
    };
  }

  return {
    title: "Rasterex Viewer could not be started",
    message: "We could not verify the evaluation. Check your network connection and reload the page."
  };
}
