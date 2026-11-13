import { escape as e } from "./ui.mjs";

import { jobClient, jobSearchText } from "./job-labels.mjs";
export { jobClient, jobSearchText } from "./job-labels.mjs";
let sequence = 0;

// Keep the native select as the form value so existing change handlers and drafts work.
export function enhanceJobSelects(host, data) {
  for (const select of host.querySelectorAll('select[name="jobId"], select[data-filter="job"], select[data-job-search]')) {
    if (select.dataset.combobox) continue;
    select.dataset.combobox = "true";
    const wrapper = document.createElement("div");
    wrapper.className = "job-combobox";
    const id = `job-options-${++sequence}`;
    const label = select.closest("label")?.querySelector("span")?.textContent || "Job";
    wrapper.innerHTML = `<input type="text" role="combobox" aria-label="${e(label)}" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}" autocomplete="off" placeholder="Search jobs, addresses or clients…"><div class="job-options" id="${id}" role="listbox" hidden></div>`;
    select.after(wrapper);
    select.classList.add("sr-only");
    select.tabIndex = -1;
    const input = wrapper.querySelector("input"), list = wrapper.querySelector("[role=listbox]");
    if (select.dataset.jobSearch) input.id = "job-search";
    select.setAttribute("aria-hidden", "true");
    let matches = [], active = -1;
    const selectedText = () => select.selectedOptions[0]?.textContent || "";
    input.value = selectedText();
    const hide = () => { list.hidden = true; input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); active = -1; };
    const choose = (index) => {
      const option = matches[index];
      if (!option) return;
      select.value = option.value;
      input.value = option.textContent;
      hide();
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const draw = (query = "") => {
      matches = [...select.options].filter((o) => {
        const job = data.jobs.find((j) => j.id === o.value);
        return !o.disabled && (!select.dataset.jobSearch || o.value) && (job ? jobSearchText(job, data) : o.textContent).toLowerCase().includes(query.toLowerCase());
      });
      active = -1;
      input.removeAttribute("aria-activedescendant");
      list.innerHTML = matches.map((o, i) => {
        const job = data.jobs.find((j) => j.id === o.value);
        return `<div role="option" id="${id}-${i}" data-option="${i}" aria-selected="${o.value === select.value}"><strong>${e(o.textContent)}</strong>${job ? `<small>${e(job.address)}</small><small class="job-client">${e(jobClient(job, data))}</small>` : ""}</div>`;
      }).join("") || '<p class="form-help" role="status">No matching jobs</p>';
      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
    };
    input.addEventListener("focus", () => { input.select(); draw(); });
    input.addEventListener("click", () => { if (list.hidden) draw(); });
    input.addEventListener("input", () => draw(input.value));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); input.value = selectedText(); hide(); }
      else if (["ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        if (list.hidden) draw();
        if (!matches.length) return;
        active = active < 0 ? (event.key === "ArrowDown" ? 0 : matches.length - 1) : (active + (event.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length;
        for (const row of list.querySelectorAll("[role=option]")) row.classList.toggle("highlighted", row.id === `${id}-${active}`);
        input.setAttribute("aria-activedescendant", `${id}-${active}`);
        list.querySelector(`#${id}-${active}`)?.scrollIntoView({ block: "nearest" });
      } else if (event.key === "Enter" && !list.hidden) { event.preventDefault(); choose(active < 0 ? 0 : active); }
    });
    list.addEventListener("mousedown", (event) => event.preventDefault());
    list.addEventListener("click", (event) => {
      const row = event.target.closest("[data-option]");
      if (row) choose(Number(row.dataset.option));
    });
    wrapper.addEventListener("focusout", () => { input.value = selectedText(); hide(); });
    select.addEventListener("change", () => { input.value = selectedText(); });
  }
}
