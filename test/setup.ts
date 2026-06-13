// Jest setup file
import 'jest';
import { TextEncoder, TextDecoder } from 'util';

// Polyfill for jsdom
global.TextEncoder = TextEncoder as any;
global.TextDecoder = TextDecoder as any;

// Mock Obsidian API
jest.mock('obsidian', () => {
  return {
    Plugin: class Plugin {
      addCommand() {}
      registerEvent() {}
      registerStyleSheet() {}
      loadData() {
        return Promise.resolve({});
      }
      saveData() {
        return Promise.resolve();
      }
      app = {
        workspace: {
          getLeavesOfType: jest.fn(() => []),
          onReady: jest.fn((callback) => callback()),
          on: jest.fn(),
          getActiveViewOfType: jest.fn(() => null)
        }
      };
    },
    MarkdownView: class MarkdownView {},
    Notice: class Notice {
      constructor(message: string) {}
    }
  };
});

// Setup DOM environment
Object.defineProperty(window, 'getComputedStyle', {
  value: () => ({
    getPropertyValue: () => ''
  })
});
