export class InstallController {
  constructor(onChange = () => {}) {
    this.onChange = onChange;
    this.deferred = null;
    this.installed = false;
    this.display = matchMedia("(display-mode: standalone)");
    this.display.addEventListener("change", () => this.onChange());
    addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      this.deferred = event;
      this.onChange();
    });
    addEventListener("appinstalled", () => {
      this.installed = true;
      this.deferred = null;
      this.onChange();
    });
  }
  get standalone() {
    return (
      this.installed || this.display.matches || navigator.standalone === true
    );
  }
  get canPrompt() {
    return !!this.deferred && !this.standalone;
  }
  get label() {
    return this.standalone ? "App installed" : "Install Wild Links";
  }
  async prompt() {
    if (!this.canPrompt) return null;
    const event = this.deferred;
    this.deferred = null;
    try {
      await event.prompt();
      const choice = await event.userChoice;
      this.onChange();
      return choice.outcome;
    } catch {
      this.onChange();
      return "unavailable";
    }
  }
}
