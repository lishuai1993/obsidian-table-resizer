// Mock Obsidian API for testing
export class Plugin {
  addCommand() {}
  registerEvent() {}
  registerStyleSheet() {}
  async loadData() {
    return {};
  }
  async saveData() {}
  app = {
    workspace: {
      getLeavesOfType: () => [],
      onReady: (callback: () => void) => callback(),
      on: () => {},
      getActiveViewOfType: () => null
    }
  };
}

export class MarkdownView {}

export class Notice {
  constructor(message: string) {}
}
