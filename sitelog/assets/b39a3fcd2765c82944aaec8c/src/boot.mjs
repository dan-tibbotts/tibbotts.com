// Keep this entry free of static imports so missing build modules can be reported.
export async function boot(
  load = async () => {
    const { services } = await import("./services.mjs");
    await services.initialize();
    return import("./app.mjs");
  },
) {
  try {
    await load();
  } catch (error) {
    const root = document.querySelector("#app");
    if (!root) return;
    const header = root.querySelector(".boot-header");
    const section = document.createElement("main");
    section.className = "boot";
    section.setAttribute("role", "alert");
    const title = document.createElement("h1");
    title.textContent = "SiteLog could not start";
    const message = document.createElement("p");
    const packaged = new URL(import.meta.url).pathname.includes(
      "/sitelog/assets/",
    );
    message.textContent =
      error?.code === "PRODUCTION_NOT_CONFIGURED"
        ? "This build selects Production services. The real authentication and business API adapters must be implemented before it can run. Mockup data has not been changed."
        : error?.code === "LOCAL_STORAGE_UNAVAILABLE"
          ? `Device storage could not be opened: ${error.message} Existing stored data has not been cleared.`
          : packaged
            ? "A required application file could not be loaded. Check your connection and retry. Your stored drafts and files have not been cleared."
            : "This page is serving source files instead of a complete SiteLog build. On the development Mac, use the local preview below. The public site needs the generated static build.";
    section.append(title, message);
    if (!packaged) {
      const link = document.createElement("a");
      link.href = "http://localhost:4173/sitelog/";
      link.className = "button primary";
      link.textContent = "Open local preview on this Mac";
      section.append(link);
    }
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "button";
    retry.textContent = "Retry loading";
    retry.addEventListener("click", () => location.reload());
    section.append(retry);
    root.replaceChildren(...(header ? [header, section] : [section]));
  }
}
if (typeof document !== "undefined") void boot();
