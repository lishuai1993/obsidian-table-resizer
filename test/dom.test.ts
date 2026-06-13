import TableResizerPlugin from '../main';

describe('Table Resizer Plugin', () => {
  let plugin: TableResizerPlugin;

  beforeEach(async () => {
    plugin = new TableResizerPlugin();
    await plugin.onload();
  });

  describe('Plugin Initialization', () => {
    it('should initialize with default settings', () => {
      expect(plugin.settings).toBeDefined();
      expect(plugin.settings.enableResizer).toBe(true);
      expect(plugin.settings.minColumnWidth).toBe(50);
      expect(plugin.settings.maxColumnWidth).toBe(800);
    });

    it('should load saved settings', async () => {
      plugin.loadData = jest.fn().mockResolvedValue({
        enableResizer: false,
        minColumnWidth: 100,
        maxColumnWidth: 600
      });
      
      await plugin.loadSettings();
      expect(plugin.settings.enableResizer).toBe(false);
      expect(plugin.settings.minColumnWidth).toBe(100);
      expect(plugin.settings.maxColumnWidth).toBe(600);
    });
  });

  describe('Settings Management', () => {
    it('should save settings', async () => {
      const saveDataSpy = jest.spyOn(plugin, 'saveData').mockResolvedValue();
      
      plugin.settings = {
        enableResizer: false,
        minColumnWidth: 100,
        maxColumnWidth: 600,
        saveWidths: false
      };
      
      await plugin.saveSettings();
      expect(saveDataSpy).toHaveBeenCalled();
    });
  });

  describe('Resizer Handles', () => {
    let table: HTMLTableElement;
    let row: HTMLTableRowElement;
    let cell: HTMLTableCellElement;

    beforeEach(() => {
      table = document.createElement('table');
      row = document.createElement('tr');
      cell = document.createElement('th');
      row.appendChild(cell);
      table.appendChild(row);
      document.body.appendChild(table);
    });

    afterEach(() => {
      if (document.body.contains(table)) {
        document.body.removeChild(table);
      }
    });

    it('should add resizer handle to cell', () => {
      plugin['enableResizing'](table);
      
      const handle = cell.querySelector('.table-resizer-handle');
      expect(handle).toBeTruthy();
      expect(handle?.getAttribute('data-column')).toBe('0');
    });

    it('should not add duplicate handles', () => {
      plugin['enableResizing'](table);
      plugin['enableResizing'](table);
      
      const handles = cell.querySelectorAll('.table-resizer-handle');
      expect(handles.length).toBe(1);
    });

    it('should remove handles on disable', () => {
      plugin['enableResizing'](table);
      plugin['disableResizing'](table);
      
      const handle = cell.querySelector('.table-resizer-handle');
      expect(handle).toBeFalsy();
      expect(table.classList.contains('table-resizer-active')).toBe(false);
    });
  });

  describe('Drag Functionality', () => {
    let table: HTMLTableElement;
    let row: HTMLTableRowElement;
    let cell1: HTMLTableCellElement;
    let cell2: HTMLTableCellElement;

    beforeEach(() => {
      table = document.createElement('table');
      row = document.createElement('tr');
      cell1 = document.createElement('th');
      cell2 = document.createElement('th');
      
      row.appendChild(cell1);
      row.appendChild(cell2);
      table.appendChild(row);
      document.body.appendChild(table);
      
      // Mock offsetWidth
      Object.defineProperty(cell1, 'offsetWidth', { value: 100, configurable: true });
      Object.defineProperty(cell2, 'offsetWidth', { value: 100, configurable: true });
    });

    afterEach(() => {
      if (document.body.contains(table)) {
        document.body.removeChild(table);
      }
    });

    it('should apply width during drag', () => {
      plugin['applyColumnWidth'](table, 0, 150);
      
      expect(cell1.style.width).toBe('150px');
      expect(cell1.style.minWidth).toBe('150px');
    });

    it('should clamp width to min/max values', async () => {
      await plugin.onload();
      
      plugin['applyColumnWidth'](table, 0, 10);
      expect(cell1.style.width).toBe('10px');
      
      plugin['applyColumnWidth'](table, 0, 1000);
      expect(cell1.style.width).toBe('1000px');
    });
  });

  describe('Plugin Lifecycle', () => {
    it('should remove event listeners', () => {
      const removeEventListenerSpy = jest.spyOn(document, 'removeEventListener');
      
      plugin.onunload();
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));
    });
  });
});
